'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type TipoInimigo = 'normal'|'arqueiro'|'tanque'|'velocista'|'mago_ini';
type Projetil      = { x:number; y:number; vx:number; vy:number; tipo:string; angulo:number; dano:number; dp?:number; homing?:boolean };
type AtaqueMelee   = { ativo:boolean; anguloAtual:number; duracao:number; dano:number };
type Monstro = {
  id:number; x:number; y:number; hp:number; maxHp:number; size:number;
  cor:string; isBoss?:boolean; isFinalBoss?:boolean;
  tipo:TipoInimigo;
  breathe:number; breatheDir:number; breatheSpeed:number;
  corVariante:string; corBrilho:string; corOlho:string;
  hitTimer:number; bubbletimer:number;
  ataqueCd:number; ataqueCdMax:number;
  tentaculoAng?: number;
  raioCooldown?: number;
};
type ProjetilInimigo = { x:number; y:number; vx:number; vy:number; vida:number; dano:number; cor:string; corBrilho:string; homingTimer:number };
type RaioBoss      = { x:number; y:number; vx:number; vy:number; angulo:number; vida:number; homingTimer:number };
type SombraGuardada = { tipo:TipoInimigo; size:number; maxHp:number; ordemMorte:number };
type SlimeAliado   = { id:number; x:number; y:number; hp:number; maxHp:number; size:number; breathe:number; breatheSpeed:number; hitTimer:number; anguloAtaque:number; cooldownAtaque:number; spawnTimer:number; tipo:TipoInimigo };
type MonstroMorto  = { hp:number; maxHp:number; size:number; x:number; y:number; tipo:TipoInimigo };
type SlashDomain   = { x:number; y:number; angulo:number; vel:number; vida:number; maxVida:number; tipo:'dismantle'|'cleave'; comprimento:number };
type ParticulaDomain = { x:number; y:number; vx:number; vy:number; vida:number; maxVida:number; r:number; cor:string };
type ExplosaoArea  = { x:number; y:number; timer:number; maxTimer:number };
type CorteSomb     = { ativo:boolean; timer:number; duracao:number; anguloBase:number };
type JogadorRemoto = { id:string; nome:string; classe:string; x:number; y:number; hp:number; hpMax:number; direcaoRad:number };

const SLIME_PALETAS = [
  { base:'#7f1d1d', variante:'#450a0a', brilho:'#ef4444', olho:'#fca5a5' },
  { base:'#14532d', variante:'#052e16', brilho:'#4ade80', olho:'#bbf7d0' },
  { base:'#1e1b4b', variante:'#0f0a2e', brilho:'#818cf8', olho:'#c7d2fe' },
  { base:'#78350f', variante:'#431407', brilho:'#fb923c', olho:'#fed7aa' },
  { base:'#164e63', variante:'#083344', brilho:'#22d3ee', olho:'#a5f3fc' },
];
const PALETA_ARQUEIRO = { base:'#1a3a1a', variante:'#0a200a', brilho:'#86efac', olho:'#bbf7d0' };
const PALETA_TANQUE   = { base:'#1c1c2e', variante:'#0a0a1a', brilho:'#6366f1', olho:'#c7d2fe' };
const PALETA_VELOC    = { base:'#7f1d00', variante:'#400e00', brilho:'#fb923c', olho:'#fed7aa' };
const PALETA_MAGO_INI = { base:'#2e1065', variante:'#1a0040', brilho:'#e879f9', olho:'#f5d0fe' };

const WORLD_WIDTH = 3000, WORLD_HEIGHT = 2000;

function useImagem(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const i = new Image(); i.crossOrigin = 'anonymous'; i.src = src;
    i.onload = () => setImg(i);
  }, [src]);
  return img;
}

export default function Jogo2D() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef({ x: 450, y: 300 });
  const socketRef  = useRef<Socket | null>(null);
  const remotosRef = useRef<Record<string, JogadorRemoto>>({});
  const [online, setOnline] = useState(false);
  const [qtJog, setQtJog]   = useState(1);

  const [status] = useState(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_classe') || 'guerreiro').toLowerCase() : 'guerreiro';
    const classe = (raw === 'mago' || raw === 'sombrio') ? raw : 'guerreiro';
    return { nome: typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_nome') || 'Herói') : 'Herói', classe, str:10, agi:10, int:10, vit:10, hpMax:200 };
  });

  const LINKS: Record<string,string> = {
    guerreiro: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/46a9374d-e7fd-4bca-9214-7e3976a050d0/dgfzl3p-11e8a47e-8122-4792-80d4-27f9b491ce2f.png/v1/fill/w_800,h_999/sukuna_png_by_vortexkun_dgfzl3p-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MTM1MCIsInBhdGgiOiIvZi80NmE5Mzc0ZC1lN2ZkLTRiY2EtOTIxNC03ZTM5NzZhMDUwZDAvZGdmemwzcC0xMWU4YTQ3ZS04MTIyLTQ3OTItODBkNC0yN2Y5YjQ5MWNlMmYucG5nIiwid2lkdGgiOiI8PTEwODAifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.vLzUOZUOZgaduP0pKUxjxW_nsjgXnKVAx5JjHjt5P3M',
    mago:      'https://upload.wikimedia.org/wikipedia/pt/0/02/Satoru_Gojo.png?_=20220310211630',
    sombrio:   'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6c3d567d-af2b-469e-b10c-d5b135964ab2/dg06u31-77d706fb-6721-4a63-9fa3-a41bd55079d2.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82YzNkNTY3ZC1hZjJiLTQ2OWUtYjEwYy1kNWIxMzU5NjRhYjIvZGcwNnUzMS03N2Q3MDZmYi02NzIxLTRhNjMtOWZhMy1hNDFiZDU1MDc5ZDIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5GyTWvKNS9dRXrc3pTv-MOq1Lbhnj8sk3CcXhxPUx88',
  };
  const imgPlayer    = useImagem(LINKS[status.classe] ?? null);
  const imgArmaGuerr = useImagem('https://png.pngtree.com/png-clipart/20211018/ourmid/pngtree-fire-burning-realistic-red-flame-png-image_3977689.png');
  const imgArmaMago  = useImagem('https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png');
  const imgCenario   = useImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg');
  const imgGuerreiro = useImagem(LINKS.guerreiro);
  const imgMago      = useImagem('');
  const imgSombrio   = useImagem(LINKS.sombrio);

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ['websocket'] });
    socketRef.current = s;
    const codigoSala = typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_sala') || 'default') : 'default';
    s.on('connect', () => {
      setOnline(true);
      s.emit('entrar_no_jogo', { codigo: codigoSala, nome: status.nome, classe: status.classe, x: 1500, y: 1000 });
    });
    s.on('disconnect', () => setOnline(false));
    s.on('lista_jogadores', (lista: JogadorRemoto[]) => {
      lista.forEach(j => { if (j.id !== s.id) remotosRef.current[j.id] = j; });
      setQtJog(1 + Object.keys(remotosRef.current).length);
    });
    s.on('novo_jogador_conectado', (j: JogadorRemoto) => { remotosRef.current[j.id] = j; setQtJog(q => q + 1); });
    s.on('jogador_moveu', (d: { id:string; x:number; y:number; direcaoRad:number }) => {
      if (remotosRef.current[d.id]) { remotosRef.current[d.id].x=d.x; remotosRef.current[d.id].y=d.y; remotosRef.current[d.id].direcaoRad=d.direcaoRad; }
    });
    s.on('hp_jogador', (d: { id:string; hp:number; hpMax:number }) => {
      if (remotosRef.current[d.id]) { remotosRef.current[d.id].hp=d.hp; remotosRef.current[d.id].hpMax=d.hpMax; }
    });
    s.on('jogador_saiu', (id: string) => { delete remotosRef.current[id]; setQtJog(q => Math.max(1, q - 1)); });
    return () => { s.disconnect(); };
  }, [status.nome, status.classe]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cl = status.classe;

    const projectiles: Projetil[] = [];
    let projetilInimigos: ProjetilInimigo[] = [];
    let melee: AtaqueMelee = { ativo:false, anguloAtual:0, duracao:0, dano: 20 + status.str };
    let playerHp = status.hpMax, ondaAtual = 1;
    let estadoJogo: 'jogando'|'vitoria'|'gameover' = 'jogando';
    let contadorMorte = 0;

    let ryoikiLimpouOnda = false, ryoikiDelayTimer = 0;
    const RYOIKI_DELAY = 120;

    const RAIO_CD_MAX=600, RAIO_DANO=120+status.int*3, RAIO_AREA=120, RAIO_DUR=40;
    let raioCooldown=0, raioAtivo=false, raioTimer=0, raioAlvo={x:0,y:0};

    const FUR_CD_MAX=1800, FUR_DUR=200, FUR_DANO_TICK=4, FUR_ALCANCE=160, FUR_VEL=2.0;
    let furacaoCooldown=0, furacaoAtivo=false, furacaoTimer=0, furacaoAngulo=0;

    const RYO_CD_MAX=14400, RYO_DUR=600, RYO_SLASH_INT=8;
    let ryoikiCooldown=0, ryoikiAtivo=false, ryoikiTimer=0;
    let slashesDomain: SlashDomain[] = [];
    const particulasDomain: ParticulaDomain[] = [];

    const RAIO_BOSS_CD=180, RAIO_BOSS_DANO=50, RAIO_BOSS_VEL=7, RAIO_BOSS_VIDA=1000;
    let raioBossArr: RaioBoss[] = [];

    // Sombrio constants
    const RESSURR_CD_MAX=1800, KILLS_NEEDED=5, MAX_SOMBRAS=8, MAX_ALIADOS=5;
    const ALIADO_DANO=8, ALIADO_ALCANCE=55, ALIADO_CD=40;
    const ALIADO_PROJ_DANO=12, ALIADO_PROJ_RANGE=350, ALIADO_PROJ_CD=80;
    let ressurrCooldown=0, killsAcum=0;
    let sombrasFila: SombraGuardada[] = [];
    let aliados: SlimeAliado[] = [];
    let mortos: MonstroMorto[] = [];
    let projetiisAliados: ProjetilInimigo[] = [];
    let corte: CorteSomb = { ativo:false, timer:0, duracao:14, anguloBase:0 };
    const CORTE_ALC=150, CORTE_LARG=1.1, CORTE_DANO=18+status.agi;
    const SOMB_ALC=320, SOMB_AREA=80;
    let explosoesArea: ExplosaoArea[] = [];
    let syncMovTick=0;

    // ── HOLLOW PURPLE (Z mago) ──
    const HOLLOW_CD_MAX   = 900; // cooldown maior
    const HOLLOW_DANO     = 60;  // dano reduzido
    const RYOIKI_M_CD_MAX = 14400;
    const RYOIKI_M_DUR    = 420;
    const RYOIKI_M_KILL_T = 180;

    let hollowCooldown   = 0;
    let hollowFase: 'idle' | 'carregando' | 'disparando' = 'idle';
    let hollowTimer      = 0;
    let hollowEsferaAzul = { x: 0, y: 0, alpha: 0 };
    let hollowEsferaVerm = { x: 0, y: 0, alpha: 0 };

    let ryoikiMagoAtivo    = false;
    let ryoikiMagoTimer    = 0;
    let ryoikiMagoCooldown = 0;
    let ryoikiMagoKilled   = false;
    const infoTexts = ['∞', '∅', 'Ω', 'π', '∂', 'Σ', '∇', '∆', 'λ', 'ξ', 'ψ', 'φ'];
    let floatingInfos: { x:number; y:number; vy:number; alpha:number; txt:string; color:string }[] = [];

    // ── GUERREIRO — projétil guiado pelo mouse ──
    const GUERR_PROJ_CD  = 20;
    const GUERR_PROJ_VEL = 14;
    const GUERR_PROJ_DAN = 35 + status.str * 2;
    let guerrProjCooldown = 0;

    // ── MAGO — projétil Red (clique esquerdo) ──
    const RED_VEL = 16;
    const RED_DANO = 25 + Math.floor(status.int * 1.2);
    const RED_CD = 25; // cooldown em ticks (~0.4s a 60fps)
    const RED_RAIO_EXPLO = 60; // raio da explosão de repulsão
    let redCooldown = 0;
    let redExplosoes: { x:number; y:number; timer:number; maxTimer:number }[] = [];

    // ── SOMBRIO — ARISE cutscene ──
    const ARISE_DUR = 150;
    let ariseAtivo    = false;
    let ariseTimer    = 0;
    let ariseAliados: { x:number; y:number; nome:string; alpha:number; scale:number; vy:number }[] = [];
    let ariseParticulas: { x:number; y:number; vx:number; vy:number; vida:number; r:number; cor:string }[] = [];

    // ── SOMBRIO X — Invocação Igris + Beru ──
    const INVOC_CD_MAX = 18000;
    const INVOC_DUR    = 360;
    const INVOC_KILL_T = 180;
    let invocCooldown  = 0;
    let invocAtivo     = false;
    let invocTimer     = 0;
    let invocKilled    = false;
    let igrisPos = { x:0, y:0, alpha:0, scale:0 };
    let beruPos  = { x:0, y:0, alpha:0, scale:0 };
    let invocParticulas: { x:number; y:number; vx:number; vy:number; vida:number; r:number; cor:string }[] = [];

    let cenarioPtrn: CanvasPattern | null = null;
    if (imgCenario) cenarioPtrn = ctx.createPattern(imgCenario, 'repeat');

    const TOTAL_ONDAS = 20;

    // ─── HELPERS ────────────────────────────────────────────────────────────
    function iconeTipo(tipo: string): string {
      if(tipo==='arqueiro') return '🏹';
      if(tipo==='tanque')   return '🛡';
      if(tipo==='velocista') return '⚡';
      if(tipo==='mago_ini') return '🔮';
      return 'SLIME';
    }

    function criarMonstro(id:number, tipo:TipoInimigo, onda:number, x?:number, y?:number): Monstro {
      const rx = x ?? Math.random()*WORLD_WIDTH;
      const ry = y ?? Math.random()*WORLD_HEIGHT;
      const op = SLIME_PALETAS[Math.floor(Math.random()*SLIME_PALETAS.length)];
      const defs: Record<string, { hpM:number; sizeM:number; pal:typeof op; cdMax:number }> = {
        normal:    { hpM:1.0, sizeM:1.0, pal:op,              cdMax:999 },
        arqueiro:  { hpM:0.6, sizeM:0.8, pal:PALETA_ARQUEIRO, cdMax:120 },
        tanque:    { hpM:3.0, sizeM:1.6, pal:PALETA_TANQUE,   cdMax:999 },
        velocista: { hpM:0.5, sizeM:0.7, pal:PALETA_VELOC,    cdMax:999 },
        mago_ini:  { hpM:0.8, sizeM:0.9, pal:PALETA_MAGO_INI, cdMax:160 },
      };
      const d = defs[tipo];
      const hpBase = 180 + onda * 180;
      const hp = Math.floor(hpBase * d.hpM);
      const sizeBase = 48 + onda * 5;
      const size = Math.floor(sizeBase * d.sizeM);
      return {
        id, x:rx, y:ry, hp, maxHp:hp, size,
        cor:d.pal.base, corVariante:d.pal.variante, corBrilho:d.pal.brilho, corOlho:d.pal.olho,
        tipo, isBoss:false, isFinalBoss:false,
        breathe:Math.random()*Math.PI*2, breatheDir:1, breatheSpeed:.025+Math.random()*.02,
        hitTimer:0, bubbletimer:Math.floor(Math.random()*80),
        ataqueCd:Math.floor(Math.random()*d.cdMax), ataqueCdMax:d.cdMax,
      };
    }

    function gerarOnda(onda: number): Monstro[] {
      if (onda === 20) return [{
        id:9999, x:WORLD_WIDTH/2, y:WORLD_HEIGHT/2,
        hp:22000, maxHp:22000, size:320,
        cor:'#040008', corVariante:'#010003', corBrilho:'#ff00cc', corOlho:'#ff88ff',
        tipo:'normal', isBoss:true, isFinalBoss:true,
        breathe:0, breatheDir:1, breatheSpeed:.008, hitTimer:0, bubbletimer:999,
        ataqueCd:80, ataqueCdMax:80, raioCooldown:80
      }];
      if (onda === 15) return [{
        id:997, x:Math.random()*(WORLD_WIDTH-300)+150, y:Math.random()*(WORLD_HEIGHT-300)+150,
        hp:9500, maxHp:9500, size:260, cor:'#1a0030', corVariante:'#0d0020', corBrilho:'#9900ff', corOlho:'#dd88ff',
        tipo:'normal', isBoss:true,
        breathe:0, breatheDir:1, breatheSpeed:.014, hitTimer:0, bubbletimer:999,
        ataqueCd:90, ataqueCdMax:90
      }];
      if (onda === 10) return [{
        id:998, x:Math.random()*(WORLD_WIDTH-300)+150, y:Math.random()*(WORLD_HEIGHT-300)+150,
        hp:5500, maxHp:5500, size:230, cor:'#200000', corVariante:'#0f0000', corBrilho:'#ff3300', corOlho:'#ff9988',
        tipo:'normal', isBoss:true,
        breathe:0, breatheDir:1, breatheSpeed:.016, hitTimer:0, bubbletimer:999,
        ataqueCd:90, ataqueCdMax:90
      }];
      if (onda === 5) return [{
        id:999, x:Math.random()*(WORLD_WIDTH-300)+150, y:Math.random()*(WORLD_HEIGHT-300)+150,
        hp:2200, maxHp:2200, size:210, cor:'#7f1d1d', corVariante:'#1c0404', corBrilho:'#ef4444', corOlho:'#fecaca',
        tipo:'normal', isBoss:true,
        breathe:0, breatheDir:1, breatheSpeed:.018, hitTimer:0, bubbletimer:999,
        ataqueCd:90, ataqueCdMax:90
      }];

      const qt = onda <= 10 ? 4 + onda * 4 : 44 + (onda - 10) * 7;
      const lista: Monstro[] = [];
      for (let i = 0; i < qt; i++) {
        let tipo: TipoInimigo = 'normal';
        const r = Math.random();
        if (onda >= 2 && r < .2)       tipo = 'arqueiro';
        else if (onda >= 3 && r < .35) tipo = 'tanque';
        else if (onda >= 4 && r < .5)  tipo = 'velocista';
        else if (onda >= 6 && r < .65) tipo = 'mago_ini';
        lista.push(criarMonstro(i, tipo, onda));
      }
      return lista;
    }

    let monstros = gerarOnda(ondaAtual);
    const player = {
      x:WORLD_WIDTH/2, y:WORLD_HEIGHT/2,
      speed:3+status.agi*.15, size:80,
      direcaoRad:0,
      color:cl==='mago'?'#a855f7':cl==='guerreiro'?'#ef4444':'#10b981',
      cooldownAtaque:0
    };
    const camera = { x:0, y:0 };
    const teclas: Record<string,boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = true; };
    const onKeyUp   = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = false; };
    const onMouse   = (e: MouseEvent)    => { const r=canvas.getBoundingClientRect(); mouseRef.current={x:e.clientX-r.left,y:e.clientY-r.top}; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('mousemove', onMouse);

    // Clique esquerdo: dispara Red (apenas mago)
    const onMouseDown = (e: MouseEvent) => {
      if(cl !== 'mago') return;
      if(e.button !== 0) return;
      if(redCooldown > 0) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left + camera.x;
      const my = e.clientY - r.top  + camera.y;
      // será processado no loop pelo flag
      redClickPendente = { x: mx, y: my };
    };
    canvas.addEventListener('mousedown', onMouseDown);
    let redClickPendente: { x:number; y:number } | null = null;

    let tick=0, animId=0;

    // ═══════════════════════════════════════════════════
    // DRAW HELPERS
    // ═══════════════════════════════════════════════════

    function desenharJogadorRemoto(jr: JogadorRemoto) {
      const imgMap: Record<string, HTMLImageElement|null> = { guerreiro:imgGuerreiro, mago:imgMago, sombrio:imgSombrio };
      const img = imgMap[jr.classe] ?? null;
      if (img) ctx.drawImage(img, jr.x, jr.y, 80, 80);
      else { ctx.fillStyle=jr.classe==='mago'?'#a855f7':jr.classe==='guerreiro'?'#ef4444':'#10b981'; ctx.fillRect(jr.x,jr.y,80,80); }
      ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#fff';
      ctx.fillText(jr.nome, jr.x+40, jr.y-22);
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(jr.x,jr.y-14,80,6);
      ctx.fillStyle='#4ade80'; ctx.fillRect(jr.x,jr.y-14,80*Math.max(0,jr.hp/(jr.hpMax||200)),6);
    }

    function desenharSlime(m: Monstro) {
      const cx=m.x+m.size/2, cy=m.y+m.size/2, r=m.size/2;
      const bs=1+Math.sin(m.breathe)*.07;
      const hox=m.hitTimer>0?(Math.random()-.5)*8:0, hoy=m.hitTimer>0?(Math.random()-.5)*8:0;
      if(m.hitTimer>0) m.hitTimer--;
      ctx.save(); ctx.translate(cx+hox,cy+hoy); ctx.scale(bs,2-bs);
      // sombra chão
      ctx.save(); ctx.scale(1,.2); ctx.translate(0,r*4.5);
      const sg=ctx.createRadialGradient(0,0,0,0,0,r);
      sg.addColorStop(0,'rgba(0,0,0,.5)'); sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,0,r*.9,r*.5,0,0,Math.PI*2); ctx.fill(); ctx.restore();
      // corpo gradiente radial
      const bg=ctx.createRadialGradient(-r*.25,-r*.25,r*.05,0,0,r*1.2);
      bg.addColorStop(0,m.corBrilho); bg.addColorStop(.35,m.cor); bg.addColorStop(1,m.corVariante);
      ctx.fillStyle=bg;
      if(m.isBoss) { ctx.shadowColor=m.corBrilho; ctx.shadowBlur=50; }
      ctx.beginPath();
      if(m.tipo==='tanque'){
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/2;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
        ctx.closePath();
      } else if(m.tipo==='velocista'){
        ctx.moveTo(0,-r*1.1); ctx.lineTo(r*.6,-r*.2); ctx.lineTo(r*.9,r*.7);
        ctx.lineTo(0,r*.5); ctx.lineTo(-r*.9,r*.7); ctx.lineTo(-r*.6,-r*.2); ctx.closePath();
      } else if(m.tipo==='mago_ini'){
        for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2-Math.PI/2,ri=i%2===0?r:r*.5;ctx.lineTo(Math.cos(a)*ri,Math.sin(a)*ri);}
        ctx.closePath();
      } else if(m.isBoss) {
        ctx.moveTo(0,-r*1.1);
        for(let i=0;i<5;i++){const a=(-Math.PI/2)+(i-2)*.35,s=r*(i%2===0?1.4:1.0);ctx.lineTo(Math.cos(a)*s*.6,Math.sin(a)*s);}
        ctx.bezierCurveTo(r*1.3,-r*.3,r*1.3,r*.5,r*.8,r);
        ctx.bezierCurveTo(r*.4,r*1.2,-r*.4,r*1.2,-r*.8,r);
        ctx.bezierCurveTo(-r*1.3,r*.5,-r*1.3,-r*.3,0,-r*1.1);
        ctx.closePath();
      } else {
        ctx.moveTo(0,-r*.9); ctx.bezierCurveTo(r*.4,-r*1.0,r*.85,-r*.7,r*1.0,-r*.1);
        ctx.bezierCurveTo(r*1.0,r*.4,r*.8,r*.85,r*.5,r*1.05);
        ctx.lineTo(r*.3,r*.85);ctx.lineTo(r*.1,r*1.05);ctx.lineTo(-r*.1,r*.85);ctx.lineTo(-r*.3,r*1.05);ctx.lineTo(-r*.5,r*.85);
        ctx.bezierCurveTo(-r*.8,r*.85,-r*1.0,r*.4,-r*1.0,-r*.1);
        ctx.bezierCurveTo(-r*.85,-r*.7,-r*.4,-r*1.0,0,-r*.9);
        ctx.closePath();
      }
      ctx.fill(); ctx.shadowBlur=0;
      // highlight
      const hl=ctx.createRadialGradient(-r*.3,-r*.4,0,-r*.15,-r*.25,r*.5);
      hl.addColorStop(0,'rgba(255,255,255,.5)'); hl.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=hl; ctx.beginPath(); ctx.ellipse(-r*.25,-r*.35,r*.32,r*.22,-.4,0,Math.PI*2); ctx.fill();
      // olhos (boss ou normal)
      if(m.isBoss) {
        ctx.fillStyle='#fef2f2'; ctx.beginPath(); ctx.ellipse(0,-r*.2,r*.45,r*.35,0,0,Math.PI*2); ctx.fill();
        const ig=ctx.createRadialGradient(0,-r*.2,0,0,-r*.2,r*.28);
        ig.addColorStop(0,'#7f1d1d'); ig.addColorStop(.6,'#dc2626'); ig.addColorStop(1,'#fca5a5');
        ctx.fillStyle=ig; ctx.shadowColor='#dc2626'; ctx.shadowBlur=20;
        ctx.beginPath(); ctx.ellipse(0,-r*.2,r*.28,r*.28,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,-r*.2,r*.06,r*.25,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(r*.1,-r*.32,r*.06,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1c1917'; ctx.beginPath(); ctx.ellipse(0,r*.35,r*.55,r*.22,0,0,Math.PI); ctx.fill();
        ctx.fillStyle='#fafaf9';
        for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.18,r*.35);ctx.lineTo(i*r*.18-r*.07,r*.56);ctx.lineTo(i*r*.18+r*.07,r*.56);ctx.closePath();ctx.fill();}
      } else {
        [-r*.28,r*.28].forEach(ox=>{
          const oy=-r*.25;
          ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(ox,oy,r*.17,r*.2,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=m.corBrilho; ctx.beginPath(); ctx.ellipse(ox,oy,r*.11,r*.14,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(ox,oy,r*.04,r*.12,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ox+r*.05,oy-r*.07,r*.04,0,Math.PI*2); ctx.fill();
        });
        ctx.strokeStyle=m.corOlho; ctx.lineWidth=2.2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-r*.4,r*.22); ctx.bezierCurveTo(-r*.2,r*.08,r*.2,r*.08,r*.4,r*.22); ctx.stroke();
      }
      // detalhe por tipo
      if(m.tipo==='arqueiro'){
        ctx.strokeStyle='#86efac'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.arc(r*.5,-r*.2,r*.3,-Math.PI*.6,Math.PI*.6); ctx.stroke();
        ctx.strokeStyle='#fff'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(r*.5,-r*.5); ctx.lineTo(r*.5,r*.1); ctx.stroke();
      }
      if(m.tipo==='mago_ini'){
        ctx.shadowColor=m.corBrilho; ctx.shadowBlur=12;
        ctx.fillStyle=m.corBrilho; ctx.globalAlpha=.7;
        ctx.beginPath(); ctx.arc(-r*.5,-r*.5,r*.18,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.shadowBlur=0;
      }
      if(m.tipo==='tanque'){
        ctx.strokeStyle='#818cf8'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.ellipse(0,r*.2,r*.4,r*.4,0,0,Math.PI*2); ctx.stroke();
      }
      if(m.tipo==='velocista'){
        ctx.strokeStyle='#fb923c'; ctx.lineWidth=2; ctx.lineCap='round';
        for(let t=0;t<3;t++){ctx.beginPath();ctx.moveTo(-r*(0.5+t*.15),-r*.1+t*r*.2);ctx.lineTo(r*(0.5+t*.15),-r*.1+t*r*.2);ctx.stroke();}
      }
      ctx.restore();
      // barra de hp
      const bw=m.size*1.1, bx2=m.x-bw*.05, by2=m.y-18;
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(bx2,by2,bw,7,4); ctx.fill();
      const hg=ctx.createLinearGradient(bx2,0,bx2+bw,0);
      if(m.isBoss){hg.addColorStop(0,'#7f1d1d');hg.addColorStop(.5,'#ef4444');hg.addColorStop(1,'#fca5a5');}
      else{hg.addColorStop(0,m.corVariante);hg.addColorStop(1,m.corBrilho);}
      ctx.fillStyle=hg; ctx.beginPath(); ctx.roundRect(bx2,by2,bw*Math.max(0,m.hp/m.maxHp),7,4); ctx.fill();
      ctx.fillStyle=m.isBoss?'#fca5a5':'rgba(255,255,255,.7)';
      ctx.font=`bold ${m.isBoss?13:10}px monospace`; ctx.textAlign='center';
      ctx.fillText(m.isBoss?'☠ BOSS ☠':iconeTipo(m.tipo), cx, by2-4);
    }

    function desenharFinalBoss(m: Monstro) {
      const cx=m.x+m.size/2, cy=m.y+m.size/2, r=m.size/2;
      const bs=1+Math.sin(m.breathe)*.05;
      const hox=m.hitTimer>0?(Math.random()-.5)*12:0, hoy=m.hitTimer>0?(Math.random()-.5)*12:0;
      if(m.hitTimer>0) m.hitTimer--;
      ctx.save(); ctx.translate(cx+hox,cy+hoy); ctx.scale(bs,2-bs);
      const rR=r*1.6+Math.sin(tick*.04)*8;
      const aG=ctx.createRadialGradient(0,0,rR*.5,0,0,rR);
      aG.addColorStop(0,'rgba(255,0,144,.08)'); aG.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=aG; ctx.beginPath(); ctx.arc(0,0,rR,0,Math.PI*2); ctx.fill();
      ctx.shadowColor='#ff0090'; ctx.shadowBlur=50;
      ctx.fillStyle='#0c0010';
      ctx.beginPath();
      for(let i=0;i<=12;i++){
        const a=(i/12)*Math.PI*2-Math.PI/2, s=i%2===0?r*1.15:r*(.7+.2*Math.sin(tick*.06+i)), w=Math.sin(tick*.05+i*.8)*8;
        if(i===0) ctx.moveTo(Math.cos(a)*(s+w),Math.sin(a)*(s+w));
        else ctx.lineTo(Math.cos(a)*(s+w),Math.sin(a)*(s+w));
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
      ctx.globalAlpha=.4+.2*Math.sin(tick*.08);
      for(let v=0;v<5;v++){
        const va=(v/5)*Math.PI*2+tick*.01;
        ctx.strokeStyle=v%2===0?'#ff0090':'#9900ff'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(va)*r*.1,Math.sin(va)*r*.1);
        ctx.bezierCurveTo(Math.cos(va+.5)*r*.5,Math.sin(va+.5)*r*.5,Math.cos(va-.5)*r*.7,Math.sin(va-.5)*r*.7,Math.cos(va)*r*.95,Math.sin(va)*r*.95);
        ctx.stroke();
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='#1a001a'; ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.55,r*.42,0,0,Math.PI*2); ctx.fill();
      const iG=ctx.createRadialGradient(0,-r*.15,0,0,-r*.15,r*.35);
      iG.addColorStop(0,'#ff0090'); iG.addColorStop(.5,'#9900ff'); iG.addColorStop(1,'#ff0090');
      ctx.fillStyle=iG; ctx.shadowColor='#ff0090'; ctx.shadowBlur=25;
      ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.35,r*.32,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.28,r*.06,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,200,255,.9)'; ctx.beginPath(); ctx.arc(r*.12,-r*.28,r*.07,0,Math.PI*2); ctx.fill();
      [{x:-r*.55,y:-r*.52},{x:r*.55,y:-r*.52},{x:-r*.7,y:r*.1},{x:r*.7,y:r*.1}].forEach((op,oi)=>{
        ctx.fillStyle='#0d000d'; ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.14,r*.12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=oi%2===0?'#ff0090':'#cc00ff';
        ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.08,r*.08,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.025,r*.07,0,0,Math.PI*2); ctx.fill();
      });
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,r*.42,r*.72,r*.28,0,0,Math.PI); ctx.fill();
      for(let t=0;t<7;t++){
        const tx=(t/6-.5)*r*1.2, ph=r*(t%2===0?.26:.16)+Math.sin(tick*.08+t)*4;
        ctx.fillStyle=t%3===0?'#ff6fff':'#e0aaff';
        ctx.beginPath(); ctx.moveTo(tx-r*.06,r*.42); ctx.lineTo(tx,r*.42+ph); ctx.lineTo(tx+r*.06,r*.42); ctx.closePath(); ctx.fill();
      }
      for(let s=0;s<5;s++){
        const sa=(-Math.PI/2)+(s-2)*.28, sl=r*(s%2===0?.55:.35)+Math.sin(tick*.07+s)*6;
        ctx.strokeStyle=s%2===0?'#cc00ff':'#ff0090'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(Math.cos(sa)*r*.85,Math.sin(sa)*r*.85); ctx.lineTo(Math.cos(sa)*(r*.85+sl),Math.sin(sa)*(r*.85+sl)); ctx.stroke();
      }
      ctx.restore();
      const bw=m.size*1.3, bx2=m.x-(bw-m.size)/2, by2=m.y-28;
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(bx2,by2,bw,11);
      const hpG=ctx.createLinearGradient(bx2,0,bx2+bw,0);
      hpG.addColorStop(0,'#4c0070'); hpG.addColorStop(.5,'#cc00ff'); hpG.addColorStop(1,'#ff6fff');
      ctx.fillStyle=hpG; ctx.fillRect(bx2,by2,bw*Math.max(0,m.hp/m.maxHp),11);
      ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.fillStyle='#ff6fff';
      ctx.shadowColor='#9900ff'; ctx.shadowBlur=8; ctx.fillText('💀 BOSS FINAL 💀',cx,by2-5); ctx.shadowBlur=0;
      ctx.font='bold 10px monospace'; ctx.fillStyle='#e9d5ff';
      ctx.fillText(`${Math.max(0,Math.floor(m.hp))} / ${m.maxHp}`,cx,by2+20);
    }

    function desenharProjetilInimigo(p: ProjetilInimigo) {
      ctx.save(); ctx.translate(p.x,p.y);
      const al=Math.min(1,p.vida/15);
      ctx.globalAlpha=al;
      const pg=ctx.createRadialGradient(0,0,0,0,0,10);
      pg.addColorStop(0,'#fff'); pg.addColorStop(.4,p.corBrilho); pg.addColorStop(1,p.cor);
      ctx.shadowColor=p.corBrilho; ctx.shadowBlur=12;
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore();
    }

    function desenharAliado(a: SlimeAliado) {
      const cx=a.x+a.size/2, cy=a.y+a.size/2, r=a.size/2, bs=1+Math.sin(a.breathe)*.07;
      // aura roxa
      const auraG=ctx.createRadialGradient(cx,cy,0,cx,cy,r*2.2);
      auraG.addColorStop(0,'rgba(168,85,247,0.35)'); auraG.addColorStop(.5,'rgba(109,40,217,0.18)'); auraG.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=auraG; ctx.beginPath(); ctx.arc(cx,cy,r*2.2,0,Math.PI*2); ctx.fill();
      // partículas orbitando
      for(let p=0;p<4;p++){
        const pa=tick*0.08+p*(Math.PI/2);
        const px2=cx+Math.cos(pa)*r*1.6, py2=cy+Math.sin(pa)*r*1.6*0.5;
        ctx.save(); ctx.globalAlpha=0.7+0.3*Math.sin(tick*0.12+p);
        ctx.fillStyle=p%2===0?'#e879f9':'#a855f7'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.arc(px2,py2,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.translate(cx,cy); ctx.scale(bs,2-bs);
      ctx.shadowColor='#a855f7'; ctx.shadowBlur=18;
      // forma baseada no tipo
      const bg=ctx.createRadialGradient(-r*.25,-r*.25,r*.05,0,0,r*1.2);
      bg.addColorStop(0,'#e879f9'); bg.addColorStop(.4,'#7e22ce'); bg.addColorStop(1,'#3b0764');
      ctx.fillStyle=bg;
      ctx.beginPath();
      if(a.tipo==='tanque'){
        for(let i=0;i<6;i++){const an=(i/6)*Math.PI*2-Math.PI/2;ctx.lineTo(Math.cos(an)*r,Math.sin(an)*r);}
        ctx.closePath();
      } else if(a.tipo==='velocista'){
        ctx.moveTo(0,-r*1.1); ctx.lineTo(r*.6,-r*.2); ctx.lineTo(r*.9,r*.7);
        ctx.lineTo(0,r*.5); ctx.lineTo(-r*.9,r*.7); ctx.lineTo(-r*.6,-r*.2); ctx.closePath();
      } else if(a.tipo==='mago_ini'){
        for(let i=0;i<10;i++){const an=(i/10)*Math.PI*2-Math.PI/2,ri=i%2===0?r:r*.5;ctx.lineTo(Math.cos(an)*ri,Math.sin(an)*ri);}
        ctx.closePath();
      } else {
        ctx.moveTo(0,-r*.9); ctx.bezierCurveTo(r*.4,-r*1.0,r*.85,-r*.7,r*1.0,-r*.1);
        ctx.bezierCurveTo(r*1.0,r*.4,r*.8,r*.85,r*.5,r*1.05);
        ctx.lineTo(r*.3,r*.85);ctx.lineTo(r*.1,r*1.05);ctx.lineTo(-r*.1,r*.85);ctx.lineTo(-r*.3,r*1.05);ctx.lineTo(-r*.5,r*.85);
        ctx.bezierCurveTo(-r*.8,r*.85,-r*1.0,r*.4,-r*1.0,-r*.1); ctx.bezierCurveTo(-r*.85,-r*.7,-r*.4,-r*1.0,0,-r*.9);
        ctx.closePath();
      }
      ctx.fill(); ctx.shadowBlur=0;
      ctx.globalAlpha=.3; ctx.fillStyle='#f0abfc';
      ctx.beginPath(); ctx.ellipse(-r*.25,-r*.35,r*.32,r*.22,-.4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      [-r*.28,r*.28].forEach(ox=>{
        ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(ox,-r*.25,r*.17,r*.2,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#e879f9'; ctx.beginPath(); ctx.ellipse(ox,-r*.25,r*.11,r*.14,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(ox,-r*.25,r*.04,r*.12,0,0,Math.PI*2); ctx.fill();
      });
      ctx.restore();
      // barra hp
      const bw=a.size*1.1, bx2=a.x-bw*.05, by2=a.y-18;
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx2,by2,bw,6);
      const hg=ctx.createLinearGradient(bx2,0,bx2+bw,0); hg.addColorStop(0,'#581c87'); hg.addColorStop(1,'#e879f9');
      ctx.fillStyle=hg; ctx.fillRect(bx2,by2,bw*Math.max(0,a.hp/a.maxHp),6);
      ctx.fillStyle='#e9d5ff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
      ctx.fillText(`👁 ${iconeTipo(a.tipo)}`,cx,by2-3);
    }

    function desenharCorteSombrio(px:number, py:number, anguloBase:number, timer:number, duracao:number) {
      const cx=px+40, cy=py+40, prog=timer/duracao, alpha=prog<.25?prog/.25:1-(prog-.25)/.75;
      const ai=anguloBase-CORTE_LARG/2, af=anguloBase+CORTE_LARG/2;
      ctx.save(); ctx.translate(cx,cy);
      ctx.globalAlpha=alpha*.2; ctx.strokeStyle='#7c3aed'; ctx.lineWidth=18; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.9,ai,af); ctx.stroke();
      ctx.globalAlpha=alpha*.9; ctx.strokeStyle='#f0e6ff'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.86,ai,af); ctx.stroke();
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharProjetilSombrio(p: Projetil) {
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angulo);
      ctx.globalAlpha=.65; ctx.strokeStyle='#c084fc'; ctx.lineWidth=9; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,0,13,-.65,.65); ctx.stroke();
      ctx.globalAlpha=1; ctx.strokeStyle='#fff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(18,0); ctx.stroke();
      ctx.fillStyle='#f0abfc'; ctx.beginPath(); ctx.arc(13,0,4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function desenharProjetilGuerreiro(p: Projetil) {
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angulo);
      for(let t=1;t<=8;t++){
        const tx=-p.vx/Math.hypot(p.vx,p.vy)*t*8, ty=-p.vy/Math.hypot(p.vx,p.vy)*t*8;
        ctx.save(); ctx.translate(tx,ty); ctx.globalAlpha=0.45*(1-t/8);
        const fg=ctx.createRadialGradient(0,0,0,0,0,10-t);
        fg.addColorStop(0,'#fff'); fg.addColorStop(0.3,'#fbbf24'); fg.addColorStop(1,'rgba(239,68,68,0)');
        ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(0,0,10-t*0.8,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha=1;
      const g=ctx.createRadialGradient(0,0,0,0,0,16);
      g.addColorStop(0,'#ffffff'); g.addColorStop(0.2,'#fcd34d'); g.addColorStop(0.6,'#ef4444'); g.addColorStop(1,'rgba(127,29,29,0)');
      ctx.shadowColor='#fbbf24'; ctx.shadowBlur=24;
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.restore();
    }

    function desenharExplosaoArea(ex: ExplosaoArea) {
      const prog=ex.timer/ex.maxTimer, alpha=prog<.3?prog/.3:1-(prog-.3)/.7, raio=SOMB_AREA*(.3+prog*.7);
      ctx.save();
      ctx.globalAlpha=alpha*.6; ctx.strokeStyle='#e879f9'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(ex.x,ex.y,raio,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=alpha*.25; ctx.fillStyle='#a855f7';
      ctx.beginPath(); ctx.arc(ex.x,ex.y,raio*.8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.restore(); ex.timer++;
    }

    function desenharRaio(wx:number, wy:number, prog:number) {
      const fase=prog<.3?prog/.3:1-(prog-.3)/.7, alpha=Math.max(0,fase);
      const origemY=wy-600;
      const pts:{x:number;y:number}[]=[{x:wx+(Math.random()-.5)*4,y:origemY}];
      for(let i=1;i<8;i++){const t=i/8;pts.push({x:wx+(1-t)*35*(Math.random()-.5),y:origemY+(wy-origemY)*t});}
      pts.push({x:wx,y:wy});
      ctx.save();
      ctx.globalAlpha=alpha*.7; ctx.strokeStyle='#a5b4fc'; ctx.lineWidth=6; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); pts.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);}); ctx.stroke();
      ctx.globalAlpha=alpha; ctx.strokeStyle='#fff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); pts.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);}); ctx.stroke();
      if(prog>.2){
        const ia=alpha*(prog<.5?1:1-(prog-.5)/.5);
        const og=ctx.createRadialGradient(wx,wy,0,wx,wy,RAIO_AREA*1.3);
        og.addColorStop(0,`rgba(232,121,249,${ia*.5})`); og.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalAlpha=1; ctx.fillStyle=og; ctx.beginPath(); ctx.arc(wx,wy,RAIO_AREA*1.3,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharFuracao(px:number, py:number, ang:number, timer:number) {
      const cx=px+40, cy=py+40, prog=timer/FUR_DUR;
      const al=prog<.1?prog/.1:prog>.85?1-(prog-.85)/.15:1;
      ctx.save();
      for(let a=0;a<3;a++){ctx.globalAlpha=al*(.15+a*.06);ctx.strokeStyle=a%2===0?'#fde68a':'#fbbf24';ctx.lineWidth=3-a*.5;ctx.beginPath();ctx.ellipse(cx,cy,FUR_ALCANCE*(.3+a*.2),FUR_ALCANCE*(.3+a*.2)*.45,ang*(1+a*.3)+(a*Math.PI*2)/3,0,Math.PI*1.7);ctx.stroke();}
      for(let p=0;p<10;p++){const t=(p/10)*Math.PI*2+ang*2.5,d=FUR_ALCANCE*(.5+.5*Math.sin(ang*3+p));ctx.globalAlpha=al*.5;ctx.fillStyle=p%2===0?'#fcd34d':'#fff';ctx.beginPath();ctx.arc(cx+Math.cos(t)*d,cy+Math.sin(t)*d*.5,3,0,Math.PI*2);ctx.fill();}
      const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,FUR_ALCANCE);
      gg.addColorStop(0,`rgba(253,230,138,${al*.45})`); gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(cx,cy,FUR_ALCANCE,0,Math.PI*2); ctx.fill();
      for(let l=0;l<3;l++){const la=ang*3+(l/3)*Math.PI*2,ld=FUR_ALCANCE*.65;ctx.save();ctx.translate(cx+Math.cos(la)*ld,cy+Math.sin(la)*ld*.6);ctx.rotate(la+Math.PI/2);ctx.globalAlpha=al*.95;if(imgArmaGuerr)ctx.drawImage(imgArmaGuerr,-22,-22,44,44);ctx.restore();}
      ctx.globalAlpha=al; ctx.font='bold 11px monospace'; ctx.textAlign='center';
      ctx.fillStyle='#fde68a'; ctx.fillText(`🌪 ${Math.ceil((FUR_DUR-timer)/60)}s`,cx,cy-FUR_ALCANCE*.6-8);
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharRyoikiTenkai(timer: number) {
      const W=canvas.width, H=canvas.height, prog=timer/RYO_DUR;
      const alpha=prog<.05?prog/.05:prog>.92?1-(prog-.92)/.08:1;
      ctx.save();
      ctx.globalAlpha=alpha*.97; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      const vg=ctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.9);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(.6,'rgba(80,0,0,.35)'); vg.addColorStop(1,'rgba(140,0,0,.75)');
      ctx.globalAlpha=alpha; ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
      const sx=W/2, sy=H*.52, sw=320, sh=280;
      ctx.globalAlpha=alpha*.92;
      for(let d=0;d<3;d++){const dw=sw*(.55+d*.15),dh=14,dy=sy+sh*.42+d*dh;ctx.fillStyle=d===0?'#1c0a00':d===1?'#150800':'#0f0500';ctx.strokeStyle='#7f1d1d';ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(sx-dw/2,dy,dw,dh);ctx.fill();ctx.stroke();}
      ctx.fillStyle='#0d0400'; ctx.strokeStyle='#991b1b'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.rect(sx-sw*.28,sy-sh*.35,sw*.56,sh*.78); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#1c0700'; ctx.strokeStyle='#991b1b'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(sx-sw*.42,sy-sh*.32); ctx.lineTo(sx,sy-sh*.70); ctx.lineTo(sx+sw*.42,sy-sh*.32); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='rgba(255,0,0,.35)'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.ellipse(sx,sy-sh*.52,sw*.06,sh*.1,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      for(let c=-1;c<=1;c+=2){ctx.fillStyle='#150600';ctx.strokeStyle='#7f1d1d';ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(sx+c*sw*.22,sy-sh*.3,sw*.06,sh*.66);ctx.fill();ctx.stroke();}
      if(timer%RYO_SLASH_INT===0){
        const tipo2:'dismantle'|'cleave'=Math.random()<.5?'dismantle':'cleave';
        const ang=Math.random()*Math.PI*2, vel=tipo2==='dismantle'?18+Math.random()*12:10+Math.random()*8;
        const sx2=Math.random()<.5?(Math.random()<.5?-20:W+20):Math.random()*W;
        const sy2=Math.random()<.5?Math.random()*H:(Math.random()<.5?-20:H+20);
        const vida=tipo2==='dismantle'?18+Math.floor(Math.random()*10):30+Math.floor(Math.random()*15);
        slashesDomain.push({x:sx2,y:sy2,angulo:ang,vel,vida,maxVida:vida,tipo:tipo2,comprimento:tipo2==='dismantle'?80+Math.random()*80:60+Math.random()*60});
      }
      for(let i=slashesDomain.length-1;i>=0;i--){if(slashesDomain[i].vida<=0)slashesDomain.splice(i,1);}
      slashesDomain.forEach(s=>{
        s.x+=Math.cos(s.angulo)*s.vel; s.y+=Math.sin(s.angulo)*s.vel; s.vida--;
        const sa=Math.min(1,(s.vida/s.maxVida)*3);
        ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.angulo); ctx.globalAlpha=alpha*sa;
        if(s.tipo==='dismantle'){
          ctx.strokeStyle='rgba(200,200,255,.35)';ctx.lineWidth=9;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(-s.comprimento*.3,0);ctx.lineTo(s.comprimento*.7,0);ctx.stroke();
          ctx.strokeStyle='#fff';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(-s.comprimento*.3,0);ctx.lineTo(s.comprimento*.7,0);ctx.stroke();
        } else {
          ctx.strokeStyle='rgba(255,180,180,.25)';ctx.lineWidth=11;ctx.lineCap='round';
          ctx.beginPath();ctx.arc(0,0,s.comprimento*.6,-.5,.5);ctx.stroke();
          ctx.strokeStyle='#ffdddd';ctx.lineWidth=2.5;
          ctx.beginPath();ctx.arc(0,0,s.comprimento*.58,-.45,.45);ctx.stroke();
        }
        ctx.restore();
      });
      for(let i=0;i<8;i++){
        const px2=((tick*3+i*137)%W), py2=((tick*2+i*93)%H);
        ctx.globalAlpha=alpha*(.3+.3*Math.sin(tick*.1+i));
        ctx.fillStyle=i%2===0?'#930000':'#a59e9e';
        ctx.beginPath(); ctx.arc(px2,py2,2+Math.sin(tick*.08+i),0,Math.PI*2); ctx.fill();
      }
      const ta=prog<.08?prog/.08:prog>.88?1-(prog-.88)/.12:1;
      ctx.globalAlpha=ta;
      ctx.font='bold 22px serif'; ctx.textAlign='center';
      ctx.fillStyle='#7f1d1d'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=14;
      ctx.fillText('領域展開',W/2,H-90); ctx.shadowBlur=0;
      ctx.font='bold 36px serif'; ctx.fillStyle='#f5f5f5'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=22;
      ctx.fillText('Ryōiki Tenkai',W/2,H-55); ctx.shadowBlur=0;
      ctx.globalAlpha=ta*(.65+.35*Math.sin(timer*.15));
      ctx.font='italic bold 17px serif'; ctx.fillStyle='#dc2626'; ctx.shadowColor='#7f1d1d'; ctx.shadowBlur=8;
      ctx.fillText('"Fukuma Mizushi"  ·  伏魔御廚子',W/2,H-25); ctx.shadowBlur=0;
      if(prog<.06){ctx.globalAlpha=(1-prog/.06)*.85;ctx.fillStyle='#dc2626';ctx.fillRect(0,0,W,H);}
      ctx.globalAlpha=alpha*.5;
      ctx.fillStyle='rgba(255,255,255,.1)'; ctx.fillRect(W*.1,H-8,W*.8,4);
      ctx.fillStyle='#ef4444'; ctx.fillRect(W*.1,H-8,W*.8*prog,4);
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharTransicaoOnda(dt: number) {
      const prog=dt/RYOIKI_DELAY, alpha=prog<.2?1:prog>.7?1-(prog-.7)/.3:1;
      ctx.save();
      ctx.globalAlpha=alpha*.85; ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalAlpha=alpha; ctx.textAlign='center';
      ctx.font='bold 28px serif'; ctx.fillStyle='#ef4444'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=16;
      ctx.fillText(`⚔ ONDA ${ondaAtual} ELIMINADA`,canvas.width/2,canvas.height/2-20); ctx.shadowBlur=0;
      ctx.font='bold 16px monospace'; ctx.fillStyle='#fca5a5';
      ctx.fillText(`Próxima onda em ${Math.ceil((RYOIKI_DELAY-dt)/60)}s...`,canvas.width/2,canvas.height/2+20);
      ctx.globalAlpha=1; ctx.restore();
    }

    function registrarMorte(m: Monstro) {
      if(m.isBoss) return;
      contadorMorte++;
      mortos.unshift({ hp:m.maxHp, maxHp:m.maxHp, size:m.size, x:m.x, y:m.y, tipo:m.tipo });
      if(mortos.length>MAX_ALIADOS) mortos.pop();
      if(killsAcum<KILLS_NEEDED) killsAcum++;
      if(sombrasFila.length<MAX_SOMBRAS){
        sombrasFila.push({ tipo:m.tipo, size:m.size, maxHp:m.maxHp, ordemMorte:contadorMorte });
      }
    }

    // ── SOMBRIO — Arise cutscene ──
    function desenharAriseCutscene(timer: number) {
      const W=canvas.width, H=canvas.height;
      const prog=timer/ARISE_DUR;
      const fadeIn=Math.min(1,timer/25), fadeOut=timer>ARISE_DUR-35?Math.max(0,1-(timer-(ARISE_DUR-35))/35):1;
      const alpha=fadeIn*fadeOut;
      ctx.save();
      ctx.globalAlpha=alpha*0.88; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      const bg=ctx.createRadialGradient(W/2,H*.6,H*.05,W/2,H*.6,H*.9);
      bg.addColorStop(0,'rgba(60,0,90,0.55)'); bg.addColorStop(.5,'rgba(20,0,40,0.35)'); bg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      ctx.globalAlpha=alpha*0.35;
      for(let r=0;r<18;r++){
        const ra=(r/18)*Math.PI*2+tick*0.005;
        ctx.strokeStyle=r%3===0?'#a855f7':r%3===1?'#7c3aed':'#e879f9'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(W/2,H/2); ctx.lineTo(W/2+Math.cos(ra)*W,H/2+Math.sin(ra)*H); ctx.stroke();
      }
      ctx.globalAlpha=alpha;
      ariseParticulas.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vida--;
        if(p.vida<=0){p.x=W/2+(Math.random()-0.5)*W*0.8;p.y=H+10;p.vx=(Math.random()-0.5)*1.5;p.vy=-(1.5+Math.random()*2.5);p.vida=80+Math.random()*80;p.r=2+Math.random()*5;}
        const pa=Math.min(1,p.vida/20)*alpha;
        ctx.save(); ctx.globalAlpha=pa*0.85; ctx.fillStyle=p.cor; ctx.shadowColor=p.cor; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      });
      const textProg=Math.min(1,timer/45), textAlpha=textProg*fadeOut;
      const textScale=0.4+textProg*0.6;
      ctx.save(); ctx.globalAlpha=textAlpha; ctx.textAlign='center';
      ctx.translate(W/2,H*0.22); ctx.scale(textScale,textScale);
      ctx.font='bold 88px serif'; ctx.shadowColor='#7c3aed'; ctx.shadowBlur=50+Math.sin(tick*0.1)*15;
      ctx.fillStyle='#e9d5ff'; ctx.fillText('ARISE',0,0);
      ctx.strokeStyle='#a855f7'; ctx.lineWidth=2; ctx.strokeText('ARISE',0,0);
      ctx.font='bold 20px monospace'; ctx.fillStyle='#c084fc'; ctx.shadowColor='#7c3aed'; ctx.shadowBlur=12;
      ctx.fillText('— Shadow Monarch —',0,45); ctx.shadowBlur=0; ctx.restore();
      if(ariseAliados.length>0&&timer>40){
        const countShow=Math.min(ariseAliados.length,Math.floor((timer-40)/18)+1);
        for(let i=0;i<countShow;i++){
          const a=ariseAliados[i]; a.alpha=Math.min(0.9,a.alpha+0.06); a.y+=a.vy; a.vy*=0.92;
          ctx.save(); ctx.globalAlpha=a.alpha*fadeOut; ctx.textAlign='center';
          ctx.font='bold 11px monospace'; ctx.fillStyle='#d8b4fe'; ctx.shadowColor='#a855f7'; ctx.shadowBlur=8;
          ctx.fillText(`► ${a.nome}`,a.x,a.y); ctx.shadowBlur=0; ctx.restore();
        }
      }
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharInvocacaoUltimate(timer: number) {
      const W=canvas.width, H=canvas.height;
      const prog=timer/INVOC_DUR;
      const fadeIn=Math.min(1,timer/30), fadeOut=timer>INVOC_DUR-45?Math.max(0,1-(timer-(INVOC_DUR-45))/45):1;
      const alpha=fadeIn*fadeOut;
      ctx.save();
      ctx.globalAlpha=alpha*0.92; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      const vg2=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,H);
      vg2.addColorStop(0,'rgba(30,0,60,0.7)'); vg2.addColorStop(.6,'rgba(10,0,25,0.5)'); vg2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=vg2; ctx.fillRect(0,0,W,H);
      ctx.globalAlpha=alpha;
      invocParticulas.forEach(p=>{
        p.x+=p.vx+Math.sin(tick*0.04+p.r)*0.3; p.y+=p.vy; p.vida--;
        if(p.vida<=0){p.x=Math.random()*W;p.y=H+10;p.vx=(Math.random()-0.5)*1.2;p.vy=-(1+Math.random()*3);p.vida=60+Math.random()*100;p.r=1.5+Math.random()*4;p.cor=['#7c3aed','#a855f7','#c084fc','#e879f9','#581c87'][Math.floor(Math.random()*5)];}
        const pa2=Math.min(1,p.vida/25)*alpha;
        ctx.save(); ctx.globalAlpha=pa2; ctx.fillStyle=p.cor; ctx.shadowColor=p.cor; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      });
      // Igris
      const igrisEnter=Math.min(1,timer/70);
      const igrisX=W*(0.1+igrisEnter*0.22);
      igrisPos.x=igrisX; igrisPos.y=H*0.5; igrisPos.alpha=igrisEnter; igrisPos.scale=0.5+igrisEnter*0.5;
      ctx.save(); ctx.globalAlpha=igrisPos.alpha*alpha; ctx.translate(igrisPos.x,igrisPos.y); ctx.scale(igrisPos.scale*1.1,igrisPos.scale*1.1);
      ctx.shadowColor='#7c3aed'; ctx.shadowBlur=55+Math.sin(tick*0.08)*15;
      ctx.fillStyle='#0a0814'; ctx.beginPath(); ctx.ellipse(0,0,32,52,0,0,Math.PI*2); ctx.fill();
      for(let pl=0;pl<8;pl++){const pa2=(pl/8)*Math.PI*2;ctx.fillStyle=pl%2===0?'#1a0a30':'#0d0618';ctx.beginPath();ctx.ellipse(Math.cos(pa2)*14,Math.sin(pa2)*22,7,10,pa2,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#110820'; ctx.beginPath(); ctx.ellipse(0,-45,18,22,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#f0f0ff'; ctx.shadowColor='#fff'; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(-5,-44,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5,-44,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.strokeStyle='#6b21a8'; ctx.lineWidth=7; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(40,-30); ctx.lineTo(40,75); ctx.stroke();
      ctx.fillStyle='#7c3aed'; ctx.beginPath(); ctx.rect(28,-38,24,12); ctx.fill();
      ctx.shadowBlur=0; ctx.restore();
      ctx.save(); ctx.globalAlpha=igrisEnter*alpha; ctx.textAlign='center';
      ctx.font='bold 16px monospace'; ctx.fillStyle='#c4b5fd'; ctx.shadowColor='#7c3aed'; ctx.shadowBlur=14;
      ctx.fillText('⚔ IGRIS',igrisPos.x,igrisPos.y+80*igrisPos.scale+12); ctx.shadowBlur=0; ctx.restore();
      // Beru
      const beruEnter=Math.min(1,Math.max(0,(timer-20))/65);
      const beruX=W*(0.9-beruEnter*0.22);
      beruPos.x=beruX; beruPos.y=H*0.5; beruPos.alpha=beruEnter; beruPos.scale=0.5+beruEnter*0.5;
      ctx.save(); ctx.globalAlpha=beruPos.alpha*alpha; ctx.translate(beruPos.x,beruPos.y); ctx.scale(beruPos.scale*1.1,beruPos.scale*1.1);
      ctx.shadowColor='#e879f9'; ctx.shadowBlur=55+Math.sin(tick*0.08+1)*15;
      ctx.fillStyle='#1a0030'; ctx.beginPath(); ctx.ellipse(0,0,25,42,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#0d001a'; ctx.beginPath(); ctx.ellipse(0,28,18,16,0,0,Math.PI*2); ctx.fill();
      [-7,7].forEach((ox)=>{
        ctx.fillStyle='#e879f9'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=18;
        ctx.beginPath(); ctx.arc(ox,-44,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.shadowBlur=0; ctx.beginPath(); ctx.arc(ox,-44,2.5,0,Math.PI*2); ctx.fill();
      });
      for(let w=0;w<2;w++){
        const ws=w===0?-1:1;
        ctx.save(); ctx.globalAlpha=beruPos.alpha*alpha*(0.65+0.2*Math.sin(tick*0.15+w));
        ctx.fillStyle=`rgba(168,85,247,0.4)`; ctx.shadowColor='#e879f9'; ctx.shadowBlur=20;
        ctx.beginPath(); ctx.moveTo(ws*18,-12); ctx.bezierCurveTo(ws*60,-70,ws*85,-30,ws*62,28); ctx.bezierCurveTo(ws*48,48,ws*28,35,ws*18,14); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.shadowBlur=0; ctx.restore();
      ctx.save(); ctx.globalAlpha=beruEnter*alpha; ctx.textAlign='center';
      ctx.font='bold 16px monospace'; ctx.fillStyle='#f0abfc'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=14;
      ctx.fillText('🐜 BERU',beruPos.x,beruPos.y+70*beruPos.scale+10); ctx.shadowBlur=0; ctx.restore();
      // Texto central
      const tProg=Math.min(1,timer/60)*fadeOut;
      ctx.save(); ctx.globalAlpha=tProg; ctx.textAlign='center';
      ctx.font='bold 46px serif'; ctx.fillStyle='#e9d5ff'; ctx.shadowColor='#7c3aed'; ctx.shadowBlur=40;
      ctx.fillText('ARISE',W/2,H*0.18); ctx.shadowBlur=0;
      ctx.font='bold 22px serif'; ctx.fillStyle='#c084fc'; ctx.shadowColor='#a855f7'; ctx.shadowBlur=18;
      ctx.fillText('領域 · Shadow Monarch',W/2,H*0.18+38); ctx.shadowBlur=0;
      if(timer>80){
        const lineFade=Math.min(1,(timer-80)/30)*fadeOut;
        ctx.globalAlpha=lineFade; ctx.font='italic bold 15px monospace'; ctx.fillStyle='#a78bfa'; ctx.shadowColor='#7c3aed'; ctx.shadowBlur=10;
        ctx.fillText('"Surge das sombras e devore a luz."',W/2,H*0.88); ctx.shadowBlur=0;
      }
      if(invocKilled&&timer>INVOC_KILL_T){
        const kf=Math.min(1,(timer-INVOC_KILL_T)/25)*fadeOut;
        ctx.globalAlpha=kf; ctx.font='bold 13px monospace'; ctx.fillStyle='#fce7f3'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=16;
        ctx.fillText('— Todos os inimigos: aniquilados. —',W/2,H*0.82); ctx.shadowBlur=0;
      }
      ctx.restore();
      ctx.globalAlpha=alpha*0.6;
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(W*0.15,H-10,W*0.7,5);
      ctx.fillStyle='#a855f7'; ctx.fillRect(W*0.15,H-10,W*0.7*prog,5);
      ctx.globalAlpha=1; ctx.restore();
    }

    // ═══════════════════════════════════════════════════
    // LOOP PRINCIPAL
    // ═══════════════════════════════════════════════════
    const render = () => {
      tick++;

      if(estadoJogo !== 'jogando'){
        ctx.fillStyle='rgba(0,0,0,.85)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign='center';
        ctx.fillStyle=estadoJogo==='vitoria'?'#fbbf24':'#ef4444'; ctx.font='bold 48px serif';
        ctx.fillText(estadoJogo==='vitoria'?'✨ VITÓRIA! ✨':'💀 GAME OVER 💀',canvas.width/2,canvas.height/2);
        ctx.fillStyle='white'; ctx.font='16px sans-serif';
        ctx.fillText('Recarregue (F5) para jogar novamente',canvas.width/2,canvas.height/2+45);
        animId=requestAnimationFrame(render); return;
      }

      if(ryoikiLimpouOnda){
        ryoikiDelayTimer++;
        desenharTransicaoOnda(ryoikiDelayTimer);
        if(ryoikiDelayTimer>=RYOIKI_DELAY){
          ryoikiLimpouOnda=false; ryoikiDelayTimer=0;
          if(ondaAtual<TOTAL_ONDAS){ondaAtual++;monstros=gerarOnda(ondaAtual);raioBossArr.length=0;projetilInimigos=[];}
          else estadoJogo='vitoria';
        }
        animId=requestAnimationFrame(render); return;
      }

      // ── Movimento ──
      let dx=0, dy=0;
      if(teclas['w'])dy=-1; if(teclas['s'])dy=1; if(teclas['a'])dx=-1; if(teclas['d'])dx=1;
      if(dx||dy){
        const sm=(furacaoAtivo&&cl==='guerreiro')?FUR_VEL:1;
        const nx=player.x+dx*player.speed*sm, ny=player.y+dy*player.speed*sm;
        if(nx>0&&nx<WORLD_WIDTH-player.size) player.x=nx;
        if(ny>0&&ny<WORLD_HEIGHT-player.size) player.y=ny;
        player.direcaoRad=Math.atan2(dy,dx);
      }

      if(++syncMovTick>=2){
        syncMovTick=0;
        socketRef.current?.emit('mover',{x:player.x,y:player.y,direcaoRad:player.direcaoRad});
        socketRef.current?.emit('sync_hp',{hp:playerHp,hpMax:status.hpMax});
      }

      // ── Ataque ESPAÇO ──
      if(teclas[' ']&&player.cooldownAtaque<=0){
        if(cl==='guerreiro'){
          if(guerrProjCooldown<=0){
            const mwx=mouseRef.current.x+camera.x, mwy=mouseRef.current.y+camera.y;
            const ang=Math.atan2(mwy-(player.y+40),mwx-(player.x+40));
            player.direcaoRad=ang;
            projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*GUERR_PROJ_VEL,vy:Math.sin(ang)*GUERR_PROJ_VEL,tipo:'guerreiro',angulo:ang,dano:GUERR_PROJ_DAN,homing:true});
            guerrProjCooldown=GUERR_PROJ_CD;
            socketRef.current?.emit('atacar',{tipo:'projGuerreiro',angulo:ang});
          }
        } else if(cl==='mago'){
          // ESPAÇO não faz nada para mago (Red é no clique)
        } else {
          const mwx=mouseRef.current.x+camera.x, mwy=mouseRef.current.y+camera.y;
          const ang=Math.atan2(mwy-(player.y+40),mwx-(player.x+40)); player.direcaoRad=ang;
          projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*11,vy:Math.sin(ang)*11,tipo:'sombrio',angulo:ang,dano:CORTE_DANO});
          player.cooldownAtaque=18;
        }
      }
      if(player.cooldownAtaque>0) player.cooldownAtaque--;
      if(guerrProjCooldown>0) guerrProjCooldown--;
      if(redCooldown>0) redCooldown--;

      // ── Mago: projétil Red (clique esquerdo) ──
      if(cl==='mago' && redClickPendente && redCooldown<=0){
        const mx=redClickPendente.x, my=redClickPendente.y;
        redClickPendente=null;
        const ang=Math.atan2(my-(player.y+40),mx-(player.x+40));
        player.direcaoRad=ang;
        projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*RED_VEL,vy:Math.sin(ang)*RED_VEL,tipo:'red',angulo:ang,dano:RED_DANO});
        redCooldown=RED_CD;
        socketRef.current?.emit('atacar',{tipo:'projRed',angulo:ang});
      } else if(redClickPendente && redCooldown>0){ redClickPendente=null; }

      // ── Mago: atualizar explosões Red ──
      redExplosoes=redExplosoes.filter(ex=>{ ex.timer++; return ex.timer<ex.maxTimer; });

      // ── Habilidades ──

      if(cl==='mago'){
        // Z: HOLLOW PURPLE
        if(teclas['z']&&hollowCooldown<=0&&hollowFase==='idle'){hollowFase='carregando';hollowTimer=0;}
        if(hollowFase==='carregando'){
          hollowTimer++;
          const px=player.x+40, py=player.y+40;
          const ang=Math.atan2(mouseRef.current.y+camera.y-py,mouseRef.current.x+camera.x-px);
          const dist=55;
          hollowEsferaAzul={x:px+Math.cos(ang+Math.PI/2)*dist,y:py+Math.sin(ang+Math.PI/2)*dist,alpha:Math.min(1,hollowTimer/30)};
          hollowEsferaVerm={x:px+Math.cos(ang-Math.PI/2)*dist,y:py+Math.sin(ang-Math.PI/2)*dist,alpha:Math.min(1,hollowTimer/30)};
          if(hollowTimer>=45){
            hollowFase='disparando'; hollowTimer=0;
            const vx2=Math.cos(ang)*18, vy2=Math.sin(ang)*18;
            projectiles.push({x:px,y:py,vx:vx2,vy:vy2,angulo:ang,dano:HOLLOW_DANO,tipo:'hollow_purple'} as any);
            hollowCooldown=HOLLOW_CD_MAX;
          }
        }
        if(hollowFase==='disparando') hollowFase='idle';
        if(hollowCooldown>0) hollowCooldown--;

        // X: RYŌIKI TENKAI MAGO
        if(teclas['x']&&ryoikiMagoCooldown<=0&&!ryoikiMagoAtivo){
          ryoikiMagoAtivo=true; ryoikiMagoTimer=0; ryoikiMagoKilled=false;
          floatingInfos=[];
          for(let fi=0;fi<120;fi++) floatingInfos.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vy:-(0.3+Math.random()*0.8),alpha:Math.random()*0.7+0.2,txt:infoTexts[Math.floor(Math.random()*infoTexts.length)],color:['#fff','#e879f9','#a78bfa','#c084fc','#f0abfc','#ddd6fe'][Math.floor(Math.random()*6)]});
        }
        if(ryoikiMagoAtivo){
          ryoikiMagoTimer++;
          if(ryoikiMagoTimer>=RYOIKI_M_KILL_T&&!ryoikiMagoKilled){monstros.length=0;ryoikiMagoKilled=true;}
          if(ryoikiMagoTimer>=RYOIKI_M_DUR){ryoikiMagoAtivo=false;ryoikiMagoCooldown=RYOIKI_M_CD_MAX;floatingInfos=[];}
        }
        if(ryoikiMagoCooldown>0) ryoikiMagoCooldown--;
      }

      if(cl==='guerreiro'){
        if(teclas['z']&&furacaoCooldown<=0&&!furacaoAtivo){furacaoAtivo=true;furacaoTimer=0;furacaoCooldown=FUR_CD_MAX;socketRef.current?.emit('habilidade_z',{tipo:'furacao'});}
        if(furacaoAtivo){
          furacaoTimer++; furacaoAngulo+=.18;
          monstros.forEach(m=>{const ddx=(m.x+m.size/2)-(player.x+40),ddy=(m.y+m.size/2)-(player.y+40);if(Math.hypot(ddx,ddy)<FUR_ALCANCE+m.size/2){m.hp-=FUR_DANO_TICK;m.hitTimer=3;const d=Math.max(1,Math.hypot(ddx,ddy));m.x+=(ddx/d)*2.5;m.y+=(ddy/d)*2.5;}});
          if(furacaoTimer>=FUR_DUR) furacaoAtivo=false;
        }
        if(furacaoCooldown>0) furacaoCooldown--;
        if(teclas['x']&&ryoikiCooldown<=0&&!ryoikiAtivo&&!ryoikiLimpouOnda){
          ryoikiAtivo=true; ryoikiTimer=0; ryoikiCooldown=RYO_CD_MAX; slashesDomain=[];
          socketRef.current?.emit('habilidade_z',{tipo:'ryoiki'});
        }
        if(ryoikiAtivo){
          ryoikiTimer++;
          monstros.forEach(m=>{m.hp-=(m.hp+m.maxHp)/RYO_DUR+5;m.hitTimer=3;});
          for(let i=monstros.length-1;i>=0;i--){if(monstros[i].hp<=0)monstros.splice(i,1);}
          if(ryoikiTimer>=RYO_DUR){monstros.length=0;ryoikiAtivo=false;slashesDomain=[];ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
        }
        if(ryoikiCooldown>0) ryoikiCooldown--;
      }

      if(cl==='sombrio'){
        // Z: ARISE
        if(teclas['z']&&ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED&&!ariseAtivo&&!invocAtivo){
          ariseAtivo=true; ariseTimer=0;
          ariseParticulas=Array.from({length:60},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-0.5)*1.5,vy:-(1.5+Math.random()*2.5),vida:80+Math.random()*80,r:2+Math.random()*5,cor:['#7c3aed','#a855f7','#c084fc','#e879f9','#4c1d95'][Math.floor(Math.random()*5)]}));
          const pi=mortos.slice(0,MAX_ALIADOS);
          ariseAliados=pi.map((_,i)=>({x:canvas.width*0.5+(i-pi.length/2)*100,y:canvas.height*0.72,nome:`Sombra #${i+1}`,alpha:0,scale:1,vy:-2}));
          socketRef.current?.emit('habilidade_z',{tipo:'ressurr'});
        }
        if(ariseAtivo){
          ariseTimer++;
          if(ariseTimer===75&&killsAcum>=KILLS_NEEDED){
            // Pega da sombrasFila (mais recentes primeiro) e remove da fila
            const filaOrdenada=[...sombrasFila].sort((a,b)=>b.ordemMorte-a.ordemMorte);
            const pi=filaOrdenada.slice(0,MAX_ALIADOS);
            // Remove os usados da sombrasFila
            const usadosOrdem=new Set(pi.map(s=>s.ordemMorte));
            sombrasFila=sombrasFila.filter(s=>!usadosOrdem.has(s.ordemMorte));
            pi.forEach((m,i)=>{
              const as=(i/Math.max(1,pi.length))*Math.PI*2, ds=80+i*20;
              aliados.push({id:Date.now()+i,x:player.x+Math.cos(as)*ds,y:player.y+Math.sin(as)*ds,hp:m.maxHp,maxHp:m.maxHp,size:m.size,breathe:Math.random()*Math.PI*2,breatheSpeed:.03,hitTimer:0,anguloAtaque:0,cooldownAtaque:0,spawnTimer:0,tipo:m.tipo as TipoInimigo});
            });
            killsAcum=0; ressurrCooldown=RESSURR_CD_MAX;
          }
          if(ariseTimer>=ARISE_DUR){ariseAtivo=false;ariseParticulas=[];}
        }
        if(ressurrCooldown>0) ressurrCooldown--;

        // X: INVOCAÇÃO IGRIS + BERU
        if(teclas['x']&&invocCooldown<=0&&!invocAtivo&&!ariseAtivo){
          invocAtivo=true; invocTimer=0; invocKilled=false;
          invocParticulas=Array.from({length:80},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-0.5)*1.2,vy:-(1+Math.random()*3),vida:60+Math.random()*100,r:1.5+Math.random()*4,cor:['#7c3aed','#a855f7','#c084fc','#e879f9','#581c87'][Math.floor(Math.random()*5)]}));
          socketRef.current?.emit('habilidade_z',{tipo:'invocacao_ultimate'});
        }
        if(invocAtivo){
          invocTimer++;
          if(invocTimer>=INVOC_KILL_T&&!invocKilled){
            monstros.forEach(m=>{for(let ex=0;ex<3;ex++)explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:40});});
            monstros.length=0; invocKilled=true;
          }
          if(invocTimer>=INVOC_DUR){invocAtivo=false;invocParticulas=[];invocCooldown=INVOC_CD_MAX;ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
        }
        if(invocCooldown>0) invocCooldown--;

        // Aliados: movem e atacam + atiram projéteis (arqueiro/mago_ini)
        aliados=aliados.filter(a=>{
          a.breathe+=a.breatheSpeed; if(a.cooldownAtaque>0)a.cooldownAtaque--;
          let ai2=-1, md=Infinity;
          monstros.forEach((m,mi)=>{const d=Math.hypot((m.x+m.size/2)-(a.x+a.size/2),(m.y+m.size/2)-(a.y+a.size/2));if(d<md){md=d;ai2=mi;}});
          if(ai2>=0){
            const alv=monstros[ai2];
            const adx=(alv.x+alv.size/2)-(a.x+a.size/2), ady=(alv.y+alv.size/2)-(a.y+a.size/2), ad=Math.max(1,Math.hypot(adx,ady));
            a.anguloAtaque=Math.atan2(ady,adx);
            const moveRange=(a.tipo==='arqueiro'||a.tipo==='mago_ini')?ALIADO_PROJ_RANGE*.8:ALIADO_ALCANCE;
            if(ad>moveRange){const spd=a.tipo==='velocista'?3.2:1.8;a.x+=(adx/ad)*spd;a.y+=(ady/ad)*spd;}
            // melee
            if((a.tipo==='tanque'||a.tipo==='normal'||a.tipo==='velocista')&&ad<ALIADO_ALCANCE+alv.size/2&&a.cooldownAtaque<=0){
              alv.hp-=ALIADO_DANO*(a.tipo==='tanque'?1.5:a.tipo==='velocista'?.7:1);alv.hitTimer=6;
              a.cooldownAtaque=ALIADO_CD*(a.tipo==='velocista'?.5:1);
            }
            // projétil (arqueiro e mago_ini)
            if((a.tipo==='arqueiro'||a.tipo==='mago_ini')&&a.cooldownAtaque<=0&&ad<ALIADO_PROJ_RANGE){
              const spd2=a.tipo==='mago_ini'?7:12;
              const cor=a.tipo==='mago_ini'?'#4c1d95':'#14532d';
              const corB=a.tipo==='mago_ini'?'#e879f9':'#4ade80';
              projetiisAliados.push({x:a.x+a.size/2,y:a.y+a.size/2,vx:Math.cos(a.anguloAtaque)*spd2,vy:Math.sin(a.anguloAtaque)*spd2,vida:60,dano:ALIADO_PROJ_DANO,cor,corBrilho:corB,homingTimer:0});
              a.cooldownAtaque=ALIADO_PROJ_CD;
            }
          }
          return a.hp>0;
        });
      }

      // ── Avanço de onda ──
      if(monstros.length===0&&!ryoikiAtivo&&!ryoikiLimpouOnda&&!invocAtivo){
        if(ondaAtual<TOTAL_ONDAS){ondaAtual++;monstros=gerarOnda(ondaAtual);raioBossArr.length=0;projetilInimigos=[];}
        else estadoJogo='vitoria';
      }

      // ── Câmera ──
      camera.x=Math.max(0,Math.min(player.x+40-canvas.width/2,WORLD_WIDTH-canvas.width));
      camera.y=Math.max(0,Math.min(player.y+40-canvas.height/2,WORLD_HEIGHT-canvas.height));

      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save();
      ctx.translate(-camera.x,-camera.y);

      if(cenarioPtrn){ctx.fillStyle=cenarioPtrn;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);}
      else{ctx.fillStyle='#0f0f1a';ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);}

      Object.values(remotosRef.current).forEach(jr=>desenharJogadorRemoto(jr));

      const danoSlimeNormal=0.4+ondaAtual*0.18;
      const danoSlimeBoss=1.5+ondaAtual*0.25;
      const danoFinalBoss=2.5+ondaAtual*0.3;
      const estaInvulneravel=(cl==='mago'&&ryoikiMagoAtivo)||(cl==='sombrio'&&invocAtivo);

      const pcx=player.x+40, pcy=player.y+40;
      const monstrosParaRemover: number[] = [];
      monstros.forEach((m,idx)=>{
        m.breathe+=m.breatheSpeed;
        const pd=Math.hypot(pcx-m.x-m.size/2,pcy-m.y-m.size/2);
        // IA por tipo
        const velScale=1+ondaAtual*0.04;
        let velBase=m.isFinalBoss?.003:m.isBoss?.005:m.tipo==='tanque'?.006:m.tipo==='velocista'?.022:m.tipo==='arqueiro'?.007:.01;
        velBase*=velScale;
        const minDist=(m.tipo==='arqueiro'||m.tipo==='mago_ini')&&!m.isBoss?280:0;
        if(pd>minDist&&pd<1400){m.x+=(pcx-m.x-m.size/2)*velBase;m.y+=(pcy-m.y-m.size/2)*velBase;}
        else if(pd<minDist&&!m.isBoss){m.x-=(pcx-m.x-m.size/2)*velBase*1.5;m.y-=(pcy-m.y-m.size/2)*velBase*1.5;}

        if(pd<(m.isFinalBoss?140:m.isBoss?100:m.tipo==='tanque'?55:40)){
          if(!estaInvulneravel){
            playerHp-=(m.isFinalBoss?danoFinalBoss:m.isBoss?danoSlimeBoss:danoSlimeNormal);
            if(playerHp<=0) estadoJogo='gameover';
          }
        }

        // ataques a distância
        if(m.ataqueCd>0) m.ataqueCd--;
        if(m.ataqueCd<=0){
          m.ataqueCd=m.ataqueCdMax;
          if(m.tipo==='arqueiro'&&pd<450){
            const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2);
            projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*9,vy:Math.sin(ang)*9,vida:90,dano:15,cor:PALETA_ARQUEIRO.base,corBrilho:PALETA_ARQUEIRO.brilho,homingTimer:0});
          }
          if(m.tipo==='mago_ini'&&pd<500){
            for(let bi=-1;bi<=1;bi++){
              const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+bi*.25;
              projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*7,vy:Math.sin(ang)*7,vida:80,dano:18,cor:PALETA_MAGO_INI.base,corBrilho:PALETA_MAGO_INI.brilho,homingTimer:0});
            }
          }
          if(m.isBoss&&!m.isFinalBoss){
            for(let bi=0;bi<6;bi++){
              const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+(bi/6)*Math.PI*2*.5;
              projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*8,vy:Math.sin(ang)*8,vida:120,dano:25,cor:'#7f1d1d',corBrilho:'#ef4444',homingTimer:0});
            }
          }
        }
        if(m.isFinalBoss){
          if(m.raioCooldown===undefined) m.raioCooldown=RAIO_BOSS_CD;
          m.raioCooldown!--;
          if(m.raioCooldown!<=0){
            const numRaios=ondaAtual>=20?5:3; m.raioCooldown=RAIO_BOSS_CD;
            for(let r2=0;r2<numRaios;r2++){
              const sp=(r2-Math.floor(numRaios/2))*.35;
              const ang=Math.atan2(pcy-(m.y+m.size/2),pcx-(m.x+m.size/2))+sp;
              raioBossArr.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*RAIO_BOSS_VEL,vy:Math.sin(ang)*RAIO_BOSS_VEL,angulo:ang,vida:RAIO_BOSS_VIDA,homingTimer:0});
            }
          }
          desenharFinalBoss(m);
        } else {
          desenharSlime(m);
        }

        if(melee.ativo){const d=Math.hypot(pcx-(m.x+m.size/2),pcy-(m.y+m.size/2));if(d<(m.isBoss?150:100)){m.hp-=melee.dano/10;m.hitTimer=6;if(!m.isBoss){m.x+=Math.cos(player.direcaoRad)*10;m.y+=Math.sin(player.direcaoRad)*10;}}}
        if(cl==='sombrio'&&corte.ativo){const cdx=(m.x+m.size/2)-pcx,cdy=(m.y+m.size/2)-pcy,cd=Math.hypot(cdx,cdy);if(cd<CORTE_ALC+m.size/2){let diff=Math.atan2(cdy,cdx)-corte.anguloBase;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;if(Math.abs(diff)<CORTE_LARG/2){m.hp-=CORTE_DANO*(1/corte.duracao);m.hitTimer=4;}}}

        if(m.hp<=0){
          registrarMorte(m);
          monstrosParaRemover.push(idx);
        }
      });
      for(let i=monstrosParaRemover.length-1;i>=0;i--) monstros.splice(monstrosParaRemover[i],1);

      // Raios boss final
      raioBossArr=raioBossArr.filter(rb=>{
        rb.vida--; rb.homingTimer++;
        if(rb.homingTimer>=10){rb.homingTimer=0;let diff=Math.atan2(pcy-rb.y,pcx-rb.x)-rb.angulo;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;rb.angulo+=diff*.22;rb.vx=Math.cos(rb.angulo)*RAIO_BOSS_VEL;rb.vy=Math.sin(rb.angulo)*RAIO_BOSS_VEL;}
        rb.x+=rb.vx; rb.y+=rb.vy;
        if(Math.hypot(rb.x-pcx,rb.y-pcy)<28){if(!estaInvulneravel){playerHp-=RAIO_BOSS_DANO;if(playerHp<=0)estadoJogo='gameover';}return false;}
        if(rb.vida<=0||rb.x<0||rb.x>WORLD_WIDTH||rb.y<0||rb.y>WORLD_HEIGHT)return false;
        const al=Math.min(1,rb.vida/20);
        ctx.save(); ctx.globalAlpha=al;
        ctx.strokeStyle='rgba(255,0,144,.3)'; ctx.lineWidth=14; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(rb.x-rb.vx*4,rb.y-rb.vy*4); ctx.lineTo(rb.x,rb.y); ctx.stroke();
        ctx.strokeStyle='#ff6fff'; ctx.lineWidth=5;
        ctx.beginPath(); ctx.moveTo(rb.x-rb.vx*3,rb.y-rb.vy*3); ctx.lineTo(rb.x,rb.y); ctx.stroke();
        ctx.fillStyle='#ff6fff'; ctx.beginPath(); ctx.arc(rb.x,rb.y,5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.restore(); return true;
      });

      // Projéteis inimigos
      projetilInimigos=projetilInimigos.filter(p=>{
        p.vida--; p.x+=p.vx; p.y+=p.vy;
        if(p.vida<=0||p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT)return false;
        desenharProjetilInimigo(p);
        if(Math.hypot(p.x-pcx,p.y-pcy)<32){if(!estaInvulneravel){playerHp-=p.dano;if(playerHp<=0)estadoJogo='gameover';}return false;}
        return true;
      });

      // Projéteis aliados sombra
      projetiisAliados=projetiisAliados.filter(p=>{
        p.vida--; p.x+=p.vx; p.y+=p.vy;
        if(p.vida<=0||p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT)return false;
        desenharProjetilInimigo(p);
        let hit=false;
        for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+10){m.hp-=p.dano;m.hitTimer=6;hit=true;break;}}
        return !hit;
      });

      // Projéteis player
      for(let i=projectiles.length-1;i>=0;i--){
        const p=projectiles[i]; p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT){projectiles.splice(i,1);continue;}

        if(p.tipo==='guerreiro'){
          desenharProjetilGuerreiro(p);
          let hit=false;
          for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+16){m.hp-=p.dano;m.hitTimer=8;explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:30});projectiles.splice(i,1);hit=true;break;}}
          continue;
        }

        if(p.tipo==='sombrio'){
          if(p.dp===undefined)p.dp=0; p.dp+=Math.hypot(p.vx,p.vy);
          desenharProjetilSombrio(p);
          let explodiu=false;
          for(const m of monstros){if(explodiu)break;const d=Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2));if(d<m.size/2+16){explodiu=true;monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){alv.hp-=p.dano*(1-(da/SOMB_AREA)*.5);alv.hitTimer=8;}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}}
          if(!explodiu&&(p.dp??0)>=SOMB_ALC){monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){alv.hp-=p.dano*(1-(da/SOMB_AREA)*.5)*.6;alv.hitTimer=6;}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}

        } else if((p as any).tipo==='hollow_purple'){
          ctx.save();
          for(let t=1;t<=10;t++){
            const tx=p.x-p.vx*t*0.65, ty=p.y-p.vy*t*0.65;
            const al=0.55*(1-t/10); const rs=26-t*2;
            if(rs<=0)continue;
            ctx.globalAlpha=al;
            const gr=ctx.createRadialGradient(tx,ty,0,tx,ty,rs);
            gr.addColorStop(0,'rgba(248,180,252,1)'); gr.addColorStop(.4,'rgba(168,85,247,0.8)'); gr.addColorStop(1,'rgba(109,40,217,0)');
            ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(tx,ty,rs,0,Math.PI*2); ctx.fill();
          }
          ctx.globalAlpha=1;
          const gp=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,30);
          gp.addColorStop(0,'#ffffff'); gp.addColorStop(.15,'#f0abfc'); gp.addColorStop(.5,'#a855f7'); gp.addColorStop(.8,'#7c3aed'); gp.addColorStop(1,'rgba(109,40,217,0)');
          ctx.shadowColor='#e879f9'; ctx.shadowBlur=50;
          ctx.fillStyle=gp; ctx.beginPath(); ctx.arc(p.x,p.y,30,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
          for(let sp=0;sp<6;sp++){
            const sa=tick*0.25+sp*(Math.PI*2/6);
            const sx2=p.x+Math.cos(sa)*42, sy2=p.y+Math.sin(sa)*42;
            const sg=ctx.createRadialGradient(sx2,sy2,0,sx2,sy2,5);
            sg.addColorStop(0,'rgba(255,255,255,0.9)'); sg.addColorStop(1,'rgba(168,85,247,0)');
            ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sx2,sy2,5,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
          for(let mi=monstros.length-1;mi>=0;mi--){
            const m=monstros[mi];
            if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+30){
              monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<200+alv.size/2){alv.hp-=HOLLOW_DANO*(1-da/200*.5);alv.hitTimer=12;}});
              explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:60});
              projectiles.splice(i,1); break;
            }
          }

        } else if(p.tipo==='mago'){
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angulo);
          if(imgArmaMago)ctx.drawImage(imgArmaMago,-20,-20,40,40);
          ctx.restore();
          let hit=false;
          for(const m of monstros){if(p.x>m.x&&p.x<m.x+m.size&&p.y>m.y&&p.y<m.y+m.size){m.hp-=p.dano/5;m.hitTimer=6;hit=true;break;}}
          if(hit)projectiles.splice(i,1);

        } else if(p.tipo==='red'){
          // Desenhar orbe vermelho pulsante (Red do Gojo)
          ctx.save();
          const rp = 10 + Math.sin(tick*0.4)*2;
          // Trail
          for(let t=1;t<=8;t++){
            const tx=p.x-p.vx*t*0.5, ty=p.y-p.vy*t*0.5;
            const al=0.4*(1-t/8);
            ctx.globalAlpha=al;
            const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,rp*(1-t/10));
            tg.addColorStop(0,'rgba(255,80,0,1)'); tg.addColorStop(1,'rgba(200,0,0,0)');
            ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(tx,ty,rp*(1-t/10),0,Math.PI*2); ctx.fill();
          }
          ctx.globalAlpha=1;
          // Core brilhante
          ctx.shadowColor='#ff2200'; ctx.shadowBlur=30;
          const rg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rp);
          rg.addColorStop(0,'#ffffff'); rg.addColorStop(0.2,'#ffaa00'); rg.addColorStop(0.6,'#ff2200'); rg.addColorStop(1,'rgba(180,0,0,0)');
          ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(p.x,p.y,rp,0,Math.PI*2); ctx.fill();
          // Anel externo
          ctx.globalAlpha=0.5+Math.sin(tick*0.5)*0.2;
          ctx.strokeStyle='#ff4400'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(p.x,p.y,rp+4+Math.sin(tick*0.4)*2,0,Math.PI*2); ctx.stroke();
          ctx.shadowBlur=0; ctx.restore();

          // Colisão: explode com knockback
          let hitRed=false;
          for(const m of monstros){
            if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+12){
              // Dano no alvo direto
              m.hp-=p.dano; m.hitTimer=10;
              // Knockback em área (repulsão do Red)
              monstros.forEach(alv=>{
                const dd=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);
                if(dd<RED_RAIO_EXPLO+alv.size/2){
                  const ka=Math.atan2((alv.y+alv.size/2)-p.y,(alv.x+alv.size/2)-p.x);
                  const force=(1-dd/RED_RAIO_EXPLO)*18;
                  alv.x+=Math.cos(ka)*force; alv.y+=Math.sin(ka)*force;
                  if(alv!==m){ alv.hp-=p.dano*0.3; alv.hitTimer=6; }
                }
              });
              redExplosoes.push({x:p.x,y:p.y,timer:0,maxTimer:25});
              projectiles.splice(i,1); hitRed=true; break;
            }
          }
          // Sem hit: continua voando; some fora do mapa
          if(!hitRed&&(p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT)){projectiles.splice(i,1);}
        }
      }

      explosoesArea=explosoesArea.filter(ex=>{desenharExplosaoArea(ex);return ex.timer<ex.maxTimer;});

      // Explosões Red (onda de repulsão)
      redExplosoes.forEach(ex=>{
        const prog=ex.timer/ex.maxTimer;
        const r1=RED_RAIO_EXPLO*prog, r2=r1*0.4;
        ctx.save();
        // Anel expansivo
        ctx.globalAlpha=(1-prog)*0.7;
        ctx.strokeStyle='#ff4400'; ctx.lineWidth=3*(1-prog)+1;
        ctx.shadowColor='#ff2200'; ctx.shadowBlur=20;
        ctx.beginPath(); ctx.arc(ex.x,ex.y,r1,0,Math.PI*2); ctx.stroke();
        // Flash central
        if(prog<0.3){
          ctx.globalAlpha=(0.3-prog)/0.3;
          const cg=ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,r2+10);
          cg.addColorStop(0,'rgba(255,255,255,1)'); cg.addColorStop(0.5,'rgba(255,120,0,0.7)'); cg.addColorStop(1,'rgba(200,0,0,0)');
          ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(ex.x,ex.y,r2+10,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur=0; ctx.restore();
      });

      if(melee.ativo){
        melee.duracao--; melee.anguloAtual+=Math.PI/20;
        ctx.save(); ctx.translate(pcx,pcy); ctx.rotate(melee.anguloAtual);
        if(imgArmaGuerr)ctx.drawImage(imgArmaGuerr,45,-35,70,70);
        ctx.strokeStyle='rgba(251,191,36,.25)'; ctx.lineWidth=8;
        ctx.beginPath(); ctx.arc(0,0,75,melee.anguloAtual-Math.PI*.6,melee.anguloAtual); ctx.stroke();
        ctx.restore(); if(melee.duracao<=0)melee.ativo=false;
      }
      if(raioAtivo){raioTimer++;desenharRaio(raioAlvo.x,raioAlvo.y,raioTimer/RAIO_DUR);if(raioTimer>=RAIO_DUR)raioAtivo=false;}
      if(furacaoAtivo&&cl==='guerreiro')desenharFuracao(player.x,player.y,furacaoAngulo,furacaoTimer);
      aliados.forEach(a=>desenharAliado(a));
      if(cl==='sombrio'&&corte.ativo){corte.timer++;desenharCorteSombrio(player.x,player.y,corte.anguloBase,corte.timer,corte.duracao);if(corte.timer>=corte.duracao)corte.ativo=false;}

      // Hollow Purple — esferas de carga
      if(cl==='mago'&&hollowFase==='carregando'){
        const eb=hollowEsferaAzul;
        ctx.save(); ctx.globalAlpha=eb.alpha;
        ctx.shadowColor='#3b82f6'; ctx.shadowBlur=35;
        const gbAzul=ctx.createRadialGradient(eb.x,eb.y,0,eb.x,eb.y,22);
        gbAzul.addColorStop(0,'#ffffff'); gbAzul.addColorStop(.25,'#bfdbfe'); gbAzul.addColorStop(.6,'#3b82f6'); gbAzul.addColorStop(1,'rgba(37,99,235,0)');
        ctx.fillStyle=gbAzul; ctx.beginPath(); ctx.arc(eb.x,eb.y,22,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(96,165,250,${0.7*eb.alpha})`; ctx.lineWidth=2; ctx.shadowBlur=15;
        ctx.beginPath(); ctx.arc(eb.x,eb.y,28+Math.sin(tick*0.5)*4,0,Math.PI*2); ctx.stroke(); ctx.restore();
        const ev=hollowEsferaVerm;
        ctx.save(); ctx.globalAlpha=ev.alpha;
        ctx.shadowColor='#ef4444'; ctx.shadowBlur=35;
        const gbVerm=ctx.createRadialGradient(ev.x,ev.y,0,ev.x,ev.y,22);
        gbVerm.addColorStop(0,'#ffffff'); gbVerm.addColorStop(.25,'#fecaca'); gbVerm.addColorStop(.6,'#ef4444'); gbVerm.addColorStop(1,'rgba(220,38,38,0)');
        ctx.fillStyle=gbVerm; ctx.beginPath(); ctx.arc(ev.x,ev.y,22,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.globalAlpha=Math.min(eb.alpha,ev.alpha)*0.45;
        ctx.strokeStyle='#e879f9'; ctx.lineWidth=1.5; ctx.setLineDash([5,5]); ctx.shadowColor='#e879f9'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(eb.x,eb.y); ctx.lineTo(ev.x,ev.y); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
      }

      if(imgPlayer)ctx.drawImage(imgPlayer,player.x,player.y,player.size,player.size);
      else{ctx.fillStyle=player.color;ctx.fillRect(player.x,player.y,player.size,player.size);}

      // escudo de invulnerabilidade
      if(estaInvulneravel){
        ctx.save(); ctx.globalAlpha=0.35+0.25*Math.sin(tick*0.2);
        const shieldG=ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,60);
        shieldG.addColorStop(0,'rgba(168,85,247,0)'); shieldG.addColorStop(.6,'rgba(168,85,247,0.3)'); shieldG.addColorStop(1,'rgba(232,121,249,0.7)');
        ctx.fillStyle=shieldG; ctx.beginPath(); ctx.arc(pcx,pcy,60,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#e879f9'; ctx.lineWidth=2.5; ctx.shadowColor='#e879f9'; ctx.shadowBlur=15;
        ctx.beginPath(); ctx.arc(pcx,pcy,55+Math.sin(tick*0.15)*5,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
      }

      ctx.restore(); // fim câmera

      if(ryoikiAtivo&&cl==='guerreiro') desenharRyoikiTenkai(ryoikiTimer);

      // Ryōiki Tenkai Mago
      if(ryoikiMagoAtivo&&cl==='mago'){
        const fadeIn=Math.min(1,ryoikiMagoTimer/50);
        const fadeOut=ryoikiMagoTimer>RYOIKI_M_DUR-60?Math.max(0,1-(ryoikiMagoTimer-(RYOIKI_M_DUR-60))/60):1;
        const alpha=fadeIn*fadeOut;
        const cx2=canvas.width/2, cy2=canvas.height/2;
        ctx.save();
        ctx.globalAlpha=alpha*0.96; ctx.fillStyle='#000000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        for(let ring=0;ring<10;ring++){
          const rBase=35+ring*52, segs=80, rotDir=ring%2===0?1:-1, speed=0.003+ring*0.0008;
          for(let s=0;s<segs;s++){
            const a1=(s/segs)*Math.PI*2+tick*speed*rotDir, a2=((s+1)/segs)*Math.PI*2+tick*speed*rotDir;
            const wave=Math.sin(a1*4+tick*0.025)*7, r1=rBase+wave;
            const x1=cx2+Math.cos(a1)*r1, y1=cy2+Math.sin(a1)*r1*0.52;
            const x2=cx2+Math.cos(a2)*(rBase+Math.sin(a2*4+tick*0.025)*7);
            const y2=cy2+Math.sin(a2)*(rBase+Math.sin(a2*4+tick*0.025)*7)*0.52;
            const hue=265+ring*10+Math.sin(tick*0.025)*25, lum=50+ring*3;
            const opa=(0.06+0.08*Math.sin(tick*0.04+ring))*alpha;
            ctx.strokeStyle=`hsla(${hue},75%,${lum}%,${opa})`; ctx.lineWidth=ring<3?2:1.5;
            ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
          }
        }
        floatingInfos.forEach(fi=>{
          fi.y+=fi.vy; fi.alpha-=0.0025;
          if(fi.y<-20||fi.alpha<=0){fi.y=canvas.height+10;fi.x=Math.random()*canvas.width;fi.alpha=0.35+Math.random()*0.55;fi.txt=infoTexts[Math.floor(Math.random()*infoTexts.length)];}
          ctx.save(); ctx.globalAlpha=fi.alpha*alpha; ctx.font=`bold ${7+Math.random()*5}px monospace`; ctx.textAlign='center'; ctx.fillStyle=fi.color; ctx.shadowColor=fi.color; ctx.shadowBlur=8; ctx.fillText(fi.txt,fi.x,fi.y); ctx.restore();
        });
        const textFade=Math.min(1,ryoikiMagoTimer/35)*fadeOut;
        ctx.save(); ctx.globalAlpha=textFade; ctx.textAlign='center';
        ctx.font='bold 32px serif'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=30; ctx.fillStyle='#ffffff'; ctx.fillText('領域展開',cx2,68);
        ctx.font='bold 20px monospace'; ctx.fillStyle='#e879f9'; ctx.shadowBlur=18; ctx.fillText('Ryōiki Tenkai',cx2,95);
        ctx.font='bold 15px monospace'; ctx.fillStyle='#c084fc'; ctx.shadowBlur=12; ctx.fillText('無量空処 — O Vazio Ilimitado',cx2,118);
        ctx.font='bold 11px monospace'; ctx.fillStyle='#fae8ff'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=10; ctx.fillText('🛡 INVULNERÁVEL',cx2,145); ctx.shadowBlur=0; ctx.restore();
        if(ryoikiMagoKilled){
          const kFade=Math.min(1,(ryoikiMagoTimer-RYOIKI_M_KILL_T)/30)*fadeOut;
          ctx.save(); ctx.globalAlpha=kFade; ctx.textAlign='center'; ctx.font='bold 14px monospace'; ctx.fillStyle='#fae8ff'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=18;
          ctx.fillText('— Todos os alvos: paralisados. —',cx2,canvas.height-38); ctx.shadowBlur=0; ctx.restore();
        }
        ctx.globalAlpha=1; ctx.restore();
      }

      // Cutscene ARISE
      if(ariseAtivo&&cl==='sombrio') desenharAriseCutscene(ariseTimer);
      // Invocação Ultimate
      if(invocAtivo&&cl==='sombrio') desenharInvocacaoUltimate(invocTimer);

      // ════════ UI ════════
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(18,canvas.height-44,204,22);
      const hpG=ctx.createLinearGradient(20,0,220,0);
      hpG.addColorStop(0,'#7f1d1d'); hpG.addColorStop(.5,'#ef4444'); hpG.addColorStop(1,'#fca5a5');
      ctx.fillStyle=hpG; ctx.fillRect(20,canvas.height-42,(Math.max(0,playerHp)/status.hpMax)*200,18);
      ctx.fillStyle='white'; ctx.font='bold 11px monospace'; ctx.textAlign='left';
      ctx.fillText(`❤ ${Math.floor(Math.max(0,playerHp))} / ${status.hpMax}`,26,canvas.height-29);
      if(online){ctx.font='bold 10px monospace';ctx.textAlign='right';ctx.fillStyle='#4ade80';ctx.fillText(`🌐 ${qtJog}P`,canvas.width-10,20);}
      ctx.font='bold 18px serif'; ctx.textAlign='left';
      const isBossWave=ondaAtual%5===0, isFinalWave=ondaAtual===TOTAL_ONDAS;
      ctx.fillStyle=isFinalWave?'#ff6fff':isBossWave?'#fca5a5':'#e2e8f0';
      ctx.shadowColor=isFinalWave?'#ff0090':isBossWave?'#dc2626':'#7c3aed'; ctx.shadowBlur=12;
      ctx.fillText(isFinalWave?'💀 BOSS FINAL !! 💀':isBossWave?`⚠ ONDA ${ondaAtual} — BOSS ⚠`:`⚔ ONDA ${ondaAtual} / ${TOTAL_ONDAS}`,20,38); ctx.shadowBlur=0;

      // UI Mago
      if(cl==='mago'){
        const hpRdy=hollowCooldown<=0&&hollowFase==='idle', hpCar=hollowFase==='carregando', hcdr=hollowCooldown/HOLLOW_CD_MAX;
        const bx=canvas.width-74, by=canvas.height-74, bs=58;
        ctx.fillStyle=hpCar?'rgba(88,28,135,.97)':hpRdy?'rgba(60,10,100,.92)':'rgba(15,5,25,.85)'; ctx.fillRect(bx,by,bs,bs);
        ctx.strokeStyle=hpCar?'#f0abfc':hpRdy?'#e879f9':'#4c1d95'; ctx.lineWidth=hpCar||hpRdy?2.5:1.5;
        if(hpCar||hpRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=hpCar?22:12;}
        ctx.strokeRect(bx,by,bs,bs); ctx.shadowBlur=0;
        if(!hpRdy&&!hpCar){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*hcdr);}
        ctx.save(); ctx.translate(bx+bs/2,by+29);
        const gleft=ctx.createRadialGradient(-9,0,0,-9,0,13);
        gleft.addColorStop(0,'#bfdbfe'); gleft.addColorStop(.5,'#3b82f6'); gleft.addColorStop(1,'rgba(37,99,235,0)');
        ctx.fillStyle=gleft; ctx.beginPath(); ctx.arc(-9,0,13,0,Math.PI*2); ctx.fill();
        const gright=ctx.createRadialGradient(9,0,0,9,0,13);
        gright.addColorStop(0,'#fecaca'); gright.addColorStop(.5,'#ef4444'); gright.addColorStop(1,'rgba(220,38,38,0)');
        ctx.fillStyle=gright; ctx.beginPath(); ctx.arc(9,0,13,0,Math.PI*2); ctx.fill();
        if(hpRdy||hpCar){const gm=ctx.createRadialGradient(0,0,0,0,0,8);gm.addColorStop(0,'#fff');gm.addColorStop(.4,'#e879f9');gm.addColorStop(1,'rgba(168,85,247,0)');ctx.shadowColor='#e879f9';ctx.shadowBlur=16;ctx.fillStyle=gm;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
        ctx.restore();
        ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillStyle=hpRdy?'#fae8ff':hpCar?'#f0abfc':'#6b21a8';
        ctx.fillText(hpCar?'CARREGANDO...':'HOLLOW',bx+bs/2,by+46);
        ctx.fillText('[Z] PURPLE',bx+bs/2,by+56);
        if(!hpRdy&&!hpCar){ctx.font='bold 14px monospace';ctx.fillStyle='#e9d5ff';ctx.fillText(`${Math.ceil(hollowCooldown/60)}s`,bx+bs/2,by+18);}
        const rRdy=ryoikiMagoCooldown<=0&&!ryoikiMagoAtivo, rAt=ryoikiMagoAtivo, rcdr=ryoikiMagoCooldown/RYOIKI_M_CD_MAX;
        const ubx=canvas.width-74, uby=canvas.height-148, ubs=58;
        ctx.fillStyle=rAt?'rgba(20,0,40,.99)':rRdy?'rgba(50,5,80,.94)':'rgba(10,0,20,.88)'; ctx.fillRect(ubx,uby,ubs,ubs);
        ctx.strokeStyle=rAt?'#e879f9':rRdy?'#e879f9':'#3b0764'; ctx.lineWidth=rAt||rRdy?2.5:1.5;
        if(rAt||rRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=rAt?28:14;}
        ctx.strokeRect(ubx,uby,ubs,ubs); ctx.shadowBlur=0;
        if(!rRdy&&!rAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*rcdr);}
        ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.fillStyle=rAt?'#f0abfc':rRdy?'#e879f9':'#6b21a8'; ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);
        ctx.font='bold 20px monospace'; ctx.fillStyle=rAt?'#f0abfc':rRdy?'#e879f9':'#4c1d95';
        if(rAt||rRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=rAt?18:8;}
        ctx.fillText('∞',ubx+ubs/2,uby+36); ctx.shadowBlur=0;
        ctx.font='bold 10px monospace'; ctx.fillStyle=rAt?'#fae8ff':rRdy?'#f5d0fe':'#4c1d95'; ctx.fillText('[X]',ubx+ubs/2,uby+52);
        if(rAt){ctx.font='bold 11px monospace';ctx.fillStyle='#f0abfc';ctx.fillText(`${Math.ceil((RYOIKI_M_DUR-ryoikiMagoTimer)/60)}s`,ubx+ubs/2,uby+22);}
        else if(!rRdy){const mins=Math.floor(ryoikiMagoCooldown/3600),secs=Math.ceil((ryoikiMagoCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#c084fc';ctx.fillText(mins>0?`${mins}m${secs}s`:`${Math.ceil(ryoikiMagoCooldown/60)}s`,ubx+ubs/2,uby+22);}
        // Red attack indicator
        const redRdy=redCooldown<=0;
        const rbx=canvas.width-74, rby=canvas.height-220, rbs=58;
        ctx.fillStyle=redRdy?'rgba(120,20,0,.90)':'rgba(15,5,5,.85)'; ctx.fillRect(rbx,rby,rbs,rbs);
        ctx.strokeStyle=redRdy?'#ff4400':'#7f1d1d'; ctx.lineWidth=redRdy?2.5:1.5;
        if(redRdy){ctx.shadowColor='#ff2200';ctx.shadowBlur=14;}
        ctx.strokeRect(rbx,rby,rbs,rbs); ctx.shadowBlur=0;
        if(!redRdy){const rcdr2=redCooldown/RED_CD;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(rbx,rby,rbs,rbs*rcdr2);}
        ctx.font='bold 22px monospace'; ctx.textAlign='center'; ctx.fillStyle=redRdy?'#ff6622':'#7f1d1d';
        if(redRdy){ctx.shadowColor='#ff2200';ctx.shadowBlur=12;}
        ctx.fillText('🔴',rbx+rbs/2,rby+32); ctx.shadowBlur=0;
        ctx.font='bold 9px monospace'; ctx.fillStyle=redRdy?'#fca5a5':'#7f1d1d';
        ctx.fillText('[CLICK]',rbx+rbs/2,rby+44);
        ctx.fillText('RED',rbx+rbs/2,rby+54);
      }

      // UI Guerreiro
      if(cl==='guerreiro'){
        const pr=furacaoCooldown<=0&&!furacaoAtivo, at=furacaoAtivo, cdr=furacaoCooldown/FUR_CD_MAX;
        const bx=canvas.width-74, by=canvas.height-74, bs=58;
        ctx.fillStyle=at?'rgba(180,83,9,.92)':pr?'rgba(146,64,14,.88)':'rgba(20,10,5,.85)'; ctx.fillRect(bx,by,bs,bs);
        ctx.strokeStyle=at?'#fbbf24':pr?'#f59e0b':'#78350f'; ctx.lineWidth=at||pr?2.5:1.5;
        if(at||pr){ctx.shadowColor=at?'#fde68a':'#f59e0b';ctx.shadowBlur=at?18:10;}
        ctx.strokeRect(bx,by,bs,bs); ctx.shadowBlur=0;
        if(!pr&&!at){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=at?'#fde68a':pr?'#fbbf24':'#92400e'; ctx.fillText('🌪',bx+bs/2,by+34);
        ctx.font='bold 10px monospace'; ctx.fillStyle=at?'#fef9c3':pr?'#fef3c7':'#78350f'; ctx.fillText('[Z]',bx+bs/2,by+52);
        if(at){ctx.font='bold 14px monospace';ctx.fillStyle='#fde68a';ctx.fillText(`${Math.ceil((FUR_DUR-furacaoTimer)/60)}s`,bx+bs/2,by+20);}
        else if(!pr){ctx.font='bold 16px monospace';ctx.fillStyle='#fcd34d';ctx.fillText(`${Math.ceil(furacaoCooldown/60)}s`,bx+bs/2,by+20);}
        const gprRdy=guerrProjCooldown<=0;
        const pbx=canvas.width-74, pby=canvas.height-224, pbs=58;
        ctx.fillStyle=gprRdy?'rgba(127,29,29,.88)':'rgba(20,5,5,.85)'; ctx.fillRect(pbx,pby,pbs,pbs);
        ctx.strokeStyle=gprRdy?'#ef4444':'#450a0a'; ctx.lineWidth=gprRdy?2.5:1.5;
        if(gprRdy){ctx.shadowColor='#fbbf24';ctx.shadowBlur=10;}
        ctx.strokeRect(pbx,pby,pbs,pbs); ctx.shadowBlur=0;
        if(!gprRdy){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(pbx,pby,pbs,pbs*(guerrProjCooldown/GUERR_PROJ_CD));}
        ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=gprRdy?'#fbbf24':'#7f1d1d'; ctx.fillText('🔥',pbx+pbs/2,pby+34);
        ctx.font='bold 9px monospace'; ctx.fillStyle=gprRdy?'#fef9c3':'#78350f'; ctx.fillText('[ESPAÇO]',pbx+pbs/2,pby+52);
        const uPr=ryoikiCooldown<=0&&!ryoikiAtivo&&!ryoikiLimpouOnda, uAt=ryoikiAtivo||ryoikiLimpouOnda, ucdr=ryoikiCooldown/RYO_CD_MAX;
        const ubx=canvas.width-74, uby=canvas.height-148, ubs=58, pul=.5+.5*Math.sin(tick*.08);
        ctx.fillStyle=uAt?'rgba(180,10,10,.97)':uPr?'rgba(120,10,10,.92)':'rgba(20,5,5,.88)'; ctx.fillRect(ubx,uby,ubs,ubs);
        ctx.strokeStyle=uAt?`rgba(255,${80+Math.floor(pul*60)},80,1)`:uPr?'#dc2626':'#7f1d1d'; ctx.lineWidth=uAt||uPr?2.5:1.5;
        if(uAt||uPr){ctx.shadowColor='#dc2626';ctx.shadowBlur=uAt?22:12;}
        ctx.strokeRect(ubx,uby,ubs,ubs); ctx.shadowBlur=0;
        if(!uPr&&!uAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*ucdr);}
        ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.fillStyle=uAt?'#ff8080':uPr?'#fca5a5':'#7f1d1d'; ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);
        ctx.font='bold 22px sans-serif'; ctx.fillStyle=uAt?'#ff4444':uPr?'#ef4444':'#7f1d1d'; ctx.fillText('💢',ubx+ubs/2,uby+34);
        ctx.font='bold 10px monospace'; ctx.fillStyle=uAt?'#fca5a5':uPr?'#fee2e2':'#7f1d1d'; ctx.fillText('[X]',ubx+ubs/2,uby+52);
        if(uAt&&ryoikiAtivo){ctx.font='bold 12px monospace';ctx.fillStyle='#ff8080';ctx.fillText(`${Math.ceil((RYO_DUR-ryoikiTimer)/60)}s`,ubx+ubs/2,uby+22);}
        else if(uAt&&ryoikiLimpouOnda){ctx.font='bold 10px monospace';ctx.fillStyle='#fca5a5';ctx.fillText('próx...',ubx+ubs/2,uby+22);}
        else if(!uPr){ctx.font='bold 13px monospace';ctx.fillStyle='#fca5a5';ctx.fillText(`${Math.ceil(ryoikiCooldown/60)}s`,ubx+ubs/2,uby+22);}
      }

      // UI Sombrio
      if(cl==='sombrio'){
        const ptu=ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED&&!ariseAtivo, cdr=ressurrCooldown/RESSURR_CD_MAX;
        const bx=canvas.width-74, by=canvas.height-74, bs=58;
        ctx.fillStyle=ariseAtivo?'rgba(100,20,160,.97)':ptu?'rgba(88,28,135,.92)':'rgba(15,5,25,.88)'; ctx.fillRect(bx,by,bs,bs);
        ctx.strokeStyle=ariseAtivo?'#e879f9':ptu?'#e879f9':'#4c1d95'; ctx.lineWidth=ptu||ariseAtivo?2.5:1.5;
        if(ptu||ariseAtivo){ctx.shadowColor='#e879f9';ctx.shadowBlur=ariseAtivo?22:14;}
        ctx.strokeRect(bx,by,bs,bs); ctx.shadowBlur=0;
        if(!ptu&&ressurrCooldown>0&&!ariseAtivo){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=ariseAtivo?'#f0abfc':ptu?'#e879f9':'#7c3aed'; ctx.fillText('💀',bx+bs/2,by+34);
        ctx.font='bold 10px monospace'; ctx.fillStyle=ariseAtivo?'#fae8ff':ptu?'#fae8ff':'#581c87';
        ctx.fillText(ariseAtivo?'ARISE!':'[Z]',bx+bs/2,by+52);
        if(ressurrCooldown>0&&!ariseAtivo){ctx.font='bold 14px monospace';ctx.fillStyle='#d8b4fe';ctx.fillText(`${Math.ceil(ressurrCooldown/60)}s`,bx+bs/2,by+18);}
        const slSz=10,slGp=3,totW=KILLS_NEEDED*(slSz+slGp)-slGp,slSX=bx+(bs-totW)/2,slSY=by-18;
        for(let k=0;k<KILLS_NEEDED;k++){const f=k<killsAcum;ctx.fillStyle=f?'#a855f7':'rgba(100,50,150,.3)';if(f){ctx.shadowColor='#e879f9';ctx.shadowBlur=5;}ctx.fillRect(slSX+k*(slSz+slGp),slSY,slSz,slSz);ctx.shadowBlur=0;}
        ctx.font='bold 8px monospace'; ctx.fillStyle='#c084fc'; ctx.fillText(`${killsAcum}/${KILLS_NEEDED} KILLS`,bx+bs/2,slSY-3);
        if(aliados.length>0){ctx.font='bold 9px monospace';ctx.fillStyle='#e879f9';ctx.fillText(`👁 ${aliados.length} ALIADO${aliados.length>1?'S':''}`,bx+bs/2,by-32);}
        // Fila de sombras
        if(sombrasFila.length>0){
          const filaX=canvas.width-170, filaY=canvas.height-210;
          const filaH=Math.min(sombrasFila.length,6)*24+28;
          ctx.fillStyle='rgba(0,0,0,.7)'; ctx.beginPath(); ctx.roundRect(filaX-8,filaY-18,148,filaH,8); ctx.fill();
          ctx.strokeStyle='#7e22ce'; ctx.lineWidth=1; ctx.strokeRect(filaX-8,filaY-18,148,filaH);
          ctx.font='bold 9px monospace'; ctx.textAlign='left'; ctx.fillStyle='#c084fc';
          ctx.fillText(`🌑 SOMBRAS (${sombrasFila.length}/${MAX_SOMBRAS})`,filaX,filaY-4);
          const filaOrdenada=[...sombrasFila].sort((a,b)=>b.ordemMorte-a.ordemMorte);
          filaOrdenada.slice(0,6).forEach((s,i)=>{
            const fy=filaY+i*24+14;
            const icone=iconeTipo(s.tipo);
            const cor=s.tipo==='arqueiro'?'#4ade80':s.tipo==='tanque'?'#818cf8':s.tipo==='velocista'?'#fb923c':s.tipo==='mago_ini'?'#e879f9':'#c084fc';
            ctx.fillStyle=cor; ctx.font='bold 10px monospace';
            ctx.fillText(`${i===0?'▶':' '} ${icone} ${s.tipo==='mago_ini'?'MAGO':s.tipo.toUpperCase()}`,filaX,fy);
          });
          if(sombrasFila.length>6){ctx.fillStyle='rgba(192,132,252,.6)';ctx.font='bold 8px monospace';ctx.fillText(`+${sombrasFila.length-6} mais...`,filaX,filaY+6*24+10);}
        }
        const invRdy=invocCooldown<=0&&!invocAtivo&&!ariseAtivo, invAt=invocAtivo, icdr=invocCooldown/INVOC_CD_MAX;
        const ubx=canvas.width-74, uby=canvas.height-148, ubs=58;
        ctx.fillStyle=invAt?'rgba(25,0,50,.99)':invRdy?'rgba(60,0,100,.94)':'rgba(10,0,20,.88)'; ctx.fillRect(ubx,uby,ubs,ubs);
        ctx.strokeStyle=invAt?'#e879f9':invRdy?'#a855f7':'#3b0764'; ctx.lineWidth=invAt||invRdy?2.5:1.5;
        if(invAt||invRdy){ctx.shadowColor=invAt?'#e879f9':'#a855f7';ctx.shadowBlur=invAt?28:14;}
        ctx.strokeRect(ubx,uby,ubs,ubs); ctx.shadowBlur=0;
        if(!invRdy&&!invAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*icdr);}
        ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.fillStyle=invAt?'#f0abfc':invRdy?'#c084fc':'#6b21a8'; ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);
        ctx.font='bold 12px monospace'; ctx.fillStyle=invAt?'#f0abfc':invRdy?'#e879f9':'#4c1d95';
        if(invAt||invRdy){ctx.shadowColor=invAt?'#e879f9':'#a855f7';ctx.shadowBlur=invAt?18:8;}
        ctx.fillText('⚔🐜',ubx+ubs/2,uby+35); ctx.shadowBlur=0;
        ctx.font='bold 8px monospace'; ctx.fillStyle=invAt?'#fae8ff':invRdy?'#f5d0fe':'#4c1d95'; ctx.fillText('IGRIS+BERU',ubx+ubs/2,uby+48);
        ctx.font='bold 10px monospace'; ctx.fillStyle=invAt?'#fae8ff':invRdy?'#f5d0fe':'#4c1d95'; ctx.fillText('[X]',ubx+ubs/2,uby+58);
        if(invAt){ctx.font='bold 11px monospace';ctx.fillStyle='#f0abfc';ctx.shadowColor='#e879f9';ctx.shadowBlur=8;ctx.fillText(`${Math.ceil((INVOC_DUR-invocTimer)/60)}s`,ubx+ubs/2,uby+22);ctx.shadowBlur=0;}
        else if(!invRdy){const mins2=Math.floor(invocCooldown/3600),secs2=Math.ceil((invocCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#c084fc';ctx.fillText(mins2>0?`${mins2}m${secs2}s`:`${Math.ceil(invocCooldown/60)}s`,ubx+ubs/2,uby+22);}
      }

      animId=requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mousedown', onMouseDown);
      cancelAnimationFrame(animId);
    };
  }, [status, imgPlayer, imgArmaGuerr, imgArmaMago, imgCenario, imgGuerreiro, imgMago, imgSombrio]);

  return (
    <main className="relative min-h-screen bg-black flex flex-col items-center justify-center font-serif text-white overflow-hidden">
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-80 pointer-events-none"
        style={{ backgroundImage:"url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center gap-3">
          <span suppressHydrationWarning>GLORY DARK | {status.nome} | {status.classe.toUpperCase()}</span>
          <span suppressHydrationWarning className={`text-[9px] px-2 py-0.5 rounded-full ${online?'bg-green-900/60 text-green-400':'bg-zinc-800 text-zinc-500'}`}>
            {online?`🌐 ${qtJog}P`:'solo'}
          </span>
        </div>
        <canvas ref={canvasRef} width={900} height={600}
          className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p suppressHydrationWarning className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">
          WASD mover · ESPAÇO atacar ·{' '}
          {status.classe==='mago'      && 'CLIQUE = Red (repulsão) · Z = Hollow Purple (15s CD) · X = Ryōiki Tenkai [invulnerável] · '}
          {status.classe==='guerreiro' && 'ESPAÇO = 🔥 Projétil Guiado · Z = Furacão (30s CD) · X = Ryōiki Tenkai · '}
          {status.classe==='sombrio'   && 'Z = ARISE (5 kills) · X = Igris+Beru [invulnerável] · '}
          Inimigos: 🏹Arqueiro · 🛡Tanque · ⚡Velocista · 🔮Mago Inimigo · Sobreviva até onda 20.
        </p>
      </div>
    </main>
  );
}
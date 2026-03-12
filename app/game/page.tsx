'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Projetil = { x: number; y: number; vx: number; vy: number; tipo: string; angulo: number; dano: number; dp?: number; homing?: boolean };
type AtaqueMelee = { ativo: boolean; anguloAtual: number; duracao: number; dano: number };
type Monstro = {
  id: number; x: number; y: number; hp: number; maxHp: number; size: number;
  cor: string; isBoss?: boolean; isFinalBoss?: boolean;
  breathe: number; breatheDir: number; breatheSpeed: number;
  corVariante: string; corBrilho: string; corOlho: string;
  hitTimer: number; bubbletimer: number; raioCooldown?: number;
};
type RaioBoss = { x: number; y: number; vx: number; vy: number; angulo: number; vida: number; homingTimer: number };
type SlimeAliado = { id: number; x: number; y: number; hp: number; maxHp: number; size: number; breathe: number; breatheSpeed: number; hitTimer: number; anguloAtaque: number; cooldownAtaque: number; spawnTimer: number };
type MonstroMorto = { hp: number; maxHp: number; size: number; x: number; y: number };
type SlashDomain = { x: number; y: number; angulo: number; vel: number; vida: number; maxVida: number; tipo: 'dismantle' | 'cleave'; comprimento: number };
type ParticulaDomain = { x: number; y: number; vx: number; vy: number; vida: number; maxVida: number; r: number; cor: string };
type ExplosaoArea = { x: number; y: number; timer: number; maxTimer: number };
type CorteSomb = { ativo: boolean; timer: number; duracao: number; anguloBase: number };
type JogadorRemoto = { id: string; nome: string; classe: string; x: number; y: number; hp: number; hpMax: number; direcaoRad: number };
type Classe = 'guerreiro' | 'mago' | 'sombrio';
type Status = { nome: string; classe: string; str: number; agi: number; int: number; vit: number; hpMax: number };

const SLIME_PALETAS = [
  { base: '#7f1d1d', variante: '#450a0a', brilho: '#ef4444', olho: '#fca5a5' },
  { base: '#14532d', variante: '#052e16', brilho: '#4ade80', olho: '#bbf7d0' },
  { base: '#1e1b4b', variante: '#0f0a2e', brilho: '#818cf8', olho: '#c7d2fe' },
  { base: '#78350f', variante: '#431407', brilho: '#fb923c', olho: '#fed7aa' },
  { base: '#164e63', variante: '#083344', brilho: '#22d3ee', olho: '#a5f3fc' },
];
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 450, y: 300 });
  const socketRef = useRef<Socket | null>(null);
  const remotosRef = useRef<Record<string, JogadorRemoto>>({});
  const [online, setOnline] = useState(false);
  const [qtJog, setQtJog] = useState(1);

  const [status] = useState(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_classe') || 'guerreiro').toLowerCase() : 'guerreiro';
    const classe = (raw === 'mago' || raw === 'sombrio') ? raw : 'guerreiro';
    return { nome: typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_nome') || 'Herói') : 'Herói', classe, str: 10, agi: 10, int: 10, vit: 10, hpMax: 200 };
  });

  const LINKS: Record<string, string> = {
    guerreiro: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/46a9374d-e7fd-4bca-9214-7e3976a050d0/dgfzl3p-11e8a47e-8122-4792-80d4-27f9b491ce2f.png/v1/fill/w_800,h_999/sukuna_png_by_vortexkun_dgfzl3p-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MTM1MCIsInBhdGgiOiIvZi80NmE5Mzc0ZC1lN2ZkLTRiY2EtOTIxNC03ZTM5NzZhMDUwZDAvZGdmemwzcC0xMWU4YTQ3ZS04MTIyLTQ3OTItODBkNC0yN2Y5YjQ5MWNlMmYucG5nIiwid2lkdGgiOiI8PTEwODAifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.vLzUOZUOZgaduP0pKUxjxW_nsjgXnKVAx5JjHjt5P3M',
    mago: 'https://upload.wikimedia.org/wikipedia/pt/0/02/Satoru_Gojo.png?_=20220310211630',
    sombrio: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6c3d567d-af2b-469e-b10c-d5b135964ab2/dg06u31-77d706fb-6721-4a63-9fa3-a41bd55079d2.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82YzNkNTY3ZC1hZjJiLTQ2OWUtYjEwYy1kNWIxMzU5NjRhYjIvZGcwNnUzMS03N2Q3MDZmYi02NzIxLTRhNjMtOWZhMy1hNDFiZDU1MDc5ZDIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5GyTWvKNS9dRXrc3pTv-MOq1Lbhnj8sk3CcXhxPUx88',
  };
  const imgPlayer = useImagem(LINKS[status.classe] ?? null);
  const imgArmaGuerr = useImagem('https://png.pngtree.com/png-clipart/20211018/ourmid/pngtree-fire-burning-realistic-red-flame-png-image_3977689.png');
  const imgArmaMago = useImagem('https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png');
  const imgCenario = useImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg');
  const imgGuerreiro = useImagem(LINKS.guerreiro);
  const imgMago = useImagem('');
  const imgSombrio = useImagem(LINKS.sombrio);

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
    s.on('jogador_moveu', (d: { id: string; x: number; y: number; direcaoRad: number }) => {
      if (remotosRef.current[d.id]) { remotosRef.current[d.id].x = d.x; remotosRef.current[d.id].y = d.y; remotosRef.current[d.id].direcaoRad = d.direcaoRad; }
    });
    s.on('hp_jogador', (d: { id: string; hp: number; hpMax: number }) => {
      if (remotosRef.current[d.id]) { remotosRef.current[d.id].hp = d.hp; remotosRef.current[d.id].hpMax = d.hpMax; }
    });
    s.on('jogador_saiu', (id: string) => { delete remotosRef.current[id]; setQtJog(q => Math.max(1, q - 1)); });
    return () => { s.disconnect(); };
  }, [status.nome, status.classe]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const cl = status.classe;

    const projectiles: Projetil[] = [];
    let melee: AtaqueMelee = { ativo: false, anguloAtual: 0, duracao: 0, dano: 20 + status.str };
    let playerHp = status.hpMax, ondaAtual = 1;
    let estadoJogo: 'jogando' | 'vitoria' | 'gameover' = 'jogando';

    let ryoikiLimpouOnda = false, ryoikiDelayTimer = 0;
    const RYOIKI_DELAY = 120;

    const RAIO_CD_MAX = 600, RAIO_DANO = 120 + status.int * 3, RAIO_AREA = 120, RAIO_DUR = 40;
    let raioCooldown = 0, raioAtivo = false, raioTimer = 0, raioAlvo = { x: 0, y: 0 };

    const FUR_CD_MAX = 900, FUR_DUR = 200, FUR_DANO_TICK = 4, FUR_ALCANCE = 160, FUR_VEL = 2.0;
    let furacaoCooldown = 0, furacaoAtivo = false, furacaoTimer = 0, furacaoAngulo = 0;

    const RYO_CD_MAX = 14400, RYO_DUR = 600, RYO_SLASH_INT = 8;
    let ryoikiCooldown = 0, ryoikiAtivo = false, ryoikiTimer = 0;
    let slashesDomain: SlashDomain[] = [], particulasDomain: ParticulaDomain[] = [];

    const RAIO_BOSS_CD = 180, RAIO_BOSS_DANO = 50, RAIO_BOSS_VEL = 7, RAIO_BOSS_VIDA = 1000;
    let raioBossArr: RaioBoss[] = [];

    const RESSURR_CD_MAX = 1800, KILLS_NEEDED = 5, MAX_ALIADOS = 5;
    const ALIADO_DANO = 8, ALIADO_ALCANCE = 55, ALIADO_CD = 40;
    let ressurrCooldown = 0, killsAcum = 0;
    let aliados: SlimeAliado[] = [], mortos: MonstroMorto[] = [];
    let corte: CorteSomb = { ativo: false, timer: 0, duracao: 14, anguloBase: 0 };
    const CORTE_ALC = 150, CORTE_LARG = 1.1, CORTE_DANO = 18 + status.agi;
    const SOMB_ALC = 320, SOMB_AREA = 80;
    let explosoesArea: ExplosaoArea[] = [];
    let syncMovTick = 0;

    // ── HOLLOW PURPLE + RYŌIKI MAGO ──
    const HOLLOW_CD_MAX   = 180;
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
    let floatingInfos: { x: number; y: number; vy: number; alpha: number; txt: string; color: string }[] = [];

    // ── GUERREIRO — PROJÉTIL GUIADO PELO MOUSE ──
    // Substitui o ataque de melee com espaço: agora dispara projétil que segue o cursor
    const GUERR_PROJ_CD  = 20;   // frames de cooldown entre tiros
    const GUERR_PROJ_VEL = 14;
    const GUERR_PROJ_DAN = 35 + status.str * 2;
    let guerrProjCooldown = 0;

    // ── SOMBRIO — ARISE CUTSCENE ──
    // Z: invoca aliados com cutscene épica "ARISE"
    const ARISE_DUR = 150; // duração da cutscene ARISE (2.5s @ 60fps)
    let ariseAtivo    = false;
    let ariseTimer    = 0;
    let ariseAliados: { x: number; y: number; nome: string; alpha: number; scale: number; vy: number }[] = [];
    // Partículas da cutscene ARISE
    let ariseParticulas: { x: number; y: number; vx: number; vy: number; vida: number; r: number; cor: string }[] = [];

    // ── SOMBRIO X — INVOCAÇÃO DE IGRIS + BERU (ultimate) ──
    const INVOC_CD_MAX = 18000;  // 5 minutos (5×60×60)
    const INVOC_DUR    = 360;    // 6 segundos de espetáculo
    const INVOC_KILL_T = 180;    // mata tudo na metade
    let invocCooldown  = 0;
    let invocAtivo     = false;
    let invocTimer     = 0;
    let invocKilled    = false;
    // posições visuais de Igris e Beru durante a invocação
    let igrisPos = { x: 0, y: 0, alpha: 0, scale: 0 };
    let beruPos  = { x: 0, y: 0, alpha: 0, scale: 0 };
    let invocParticulas: { x: number; y: number; vx: number; vy: number; vida: number; r: number; cor: string }[] = [];

    let cenarioPtrn: CanvasPattern | null = null;
    if (imgCenario) cenarioPtrn = ctx.createPattern(imgCenario, 'repeat');

    const TOTAL_ONDAS = 20;

    const gerarOnda = (onda: number): Monstro[] => {
      if (onda === 20) return [{
        id: 9999, x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2,
        hp: 22000, maxHp: 22000, size: 320,
        cor: '#040008', corVariante: '#010003', corBrilho: '#ff00cc', corOlho: '#ff88ff',
        isBoss: true, isFinalBoss: true,
        breathe: 0, breatheDir: 1, breatheSpeed: .008, hitTimer: 0, bubbletimer: 999, raioCooldown: 80
      }];
      if (onda === 15) return [{
        id: 997, x: Math.random() * (WORLD_WIDTH - 300) + 150, y: Math.random() * (WORLD_HEIGHT - 300) + 150,
        hp: 9500, maxHp: 9500, size: 260, cor: '#1a0030', corVariante: '#0d0020', corBrilho: '#9900ff', corOlho: '#dd88ff',
        isBoss: true, breathe: 0, breatheDir: 1, breatheSpeed: .014, hitTimer: 0, bubbletimer: 999
      }];
      if (onda === 10) return [{
        id: 998, x: Math.random() * (WORLD_WIDTH - 300) + 150, y: Math.random() * (WORLD_HEIGHT - 300) + 150,
        hp: 5500, maxHp: 5500, size: 230, cor: '#200000', corVariante: '#0f0000', corBrilho: '#ff3300', corOlho: '#ff9988',
        isBoss: true, breathe: 0, breatheDir: 1, breatheSpeed: .016, hitTimer: 0, bubbletimer: 999
      }];
      if (onda === 5) return [{
        id: 999, x: Math.random() * (WORLD_WIDTH - 300) + 150, y: Math.random() * (WORLD_HEIGHT - 300) + 150,
        hp: 2200, maxHp: 2200, size: 210, cor: '#7f1d1d', corVariante: '#1c0404', corBrilho: '#ef4444', corOlho: '#fecaca',
        isBoss: true, breathe: 0, breatheDir: 1, breatheSpeed: .018, hitTimer: 0, bubbletimer: 999
      }];
      const qt = onda <= 10 ? 4 + onda * 4 : 44 + (onda - 10) * 7;
      const hpBase   = 180 + onda * 180;
      const sizeBase = 48  + onda * 5;
      const bSpd     = .025 + onda * .003;
      return Array.from({ length: qt }, (_, i) => {
        const p = SLIME_PALETAS[Math.floor(Math.random() * SLIME_PALETAS.length)];
        return {
          id: i, x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT,
          hp: hpBase + Math.floor(Math.random() * hpBase * 0.3), maxHp: hpBase,
          size: sizeBase + Math.floor(Math.random() * 12),
          cor: p.base, corVariante: p.variante, corBrilho: p.brilho, corOlho: p.olho,
          breathe: Math.random() * Math.PI * 2, breatheDir: 1,
          breatheSpeed: bSpd + Math.random() * .015, hitTimer: 0,
          bubbletimer: Math.floor(Math.random() * 80)
        };
      });
    };

    let monstros = gerarOnda(ondaAtual);

    const player = {
      x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2,
      speed: 3 + status.agi * .15, size: 80,
      direcaoRad: 0,
      color: cl === 'mago' ? '#a855f7' : cl === 'guerreiro' ? '#ef4444' : '#10b981',
      cooldownAtaque: 0
    };
    const camera = { x: 0, y: 0 };
    const teclas: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = true; };
    const onKeyUp   = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = false; };
    const onMouse   = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('mousemove', onMouse);

    let tick = 0, animId = 0;

    // ═══════════════════════════════════════════════════
    // DRAW HELPERS
    // ═══════════════════════════════════════════════════

    function desenharJogadorRemoto(jr: JogadorRemoto) {
      const imgMap: Record<string, HTMLImageElement | null> = { guerreiro: imgGuerreiro, mago: imgMago, sombrio: imgSombrio };
      const img = imgMap[jr.classe] ?? null;
      if (img) ctx.drawImage(img, jr.x, jr.y, 80, 80);
      else { ctx.fillStyle = jr.classe === 'mago' ? '#a855f7' : jr.classe === 'guerreiro' ? '#ef4444' : '#10b981'; ctx.fillRect(jr.x, jr.y, 80, 80); }
      ctx.save();
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(jr.nome, jr.x + 40, jr.y - 22);
      const bw = 80, bx = jr.x, by = jr.y - 14;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = '#4ade80'; ctx.fillRect(bx, by, bw * Math.max(0, jr.hp / (jr.hpMax || 200)), 6);
      ctx.restore();
    }

    function desenharSlime(m: Monstro) {
      const cx = m.x + m.size / 2, cy = m.y + m.size / 2, r = m.size / 2;
      const bs = 1 + Math.sin(m.breathe) * .07;
      const hox = m.hitTimer > 0 ? (Math.random() - .5) * 8 : 0, hoy = m.hitTimer > 0 ? (Math.random() - .5) * 8 : 0;
      if (m.hitTimer > 0) m.hitTimer--;
      ctx.save(); ctx.translate(cx + hox, cy + hoy); ctx.scale(bs, 2 - bs);
      ctx.save(); ctx.scale(1, .2); ctx.translate(0, r * 4.5);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, r * .9, r * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const bg = ctx.createRadialGradient(-r * .25, -r * .25, r * .05, 0, 0, r * 1.2);
      bg.addColorStop(0, m.corBrilho); bg.addColorStop(.35, m.cor); bg.addColorStop(1, m.corVariante);
      ctx.fillStyle = bg;
      if (m.isBoss) { ctx.shadowColor = m.corBrilho; ctx.shadowBlur = 50; }
      ctx.beginPath();
      if (m.isBoss) {
        ctx.moveTo(0, -r * 1.1);
        for (let i = 0; i < 5; i++) { const a = (-Math.PI / 2) + (i - 2) * .35, s = r * (i % 2 === 0 ? 1.4 : 1.0); ctx.lineTo(Math.cos(a) * s * .6, Math.sin(a) * s); }
        ctx.bezierCurveTo(r * 1.3, -r * .3, r * 1.3, r * .5, r * .8, r);
        ctx.bezierCurveTo(r * .4, r * 1.2, -r * .4, r * 1.2, -r * .8, r);
        ctx.bezierCurveTo(-r * 1.3, r * .5, -r * 1.3, -r * .3, 0, -r * 1.1);
      } else {
        ctx.moveTo(0, -r * .9); ctx.bezierCurveTo(r * .4, -r * 1.0, r * .85, -r * .7, r * 1.0, -r * .1);
        ctx.bezierCurveTo(r * 1.0, r * .4, r * .8, r * .85, r * .5, r * 1.05);
        ctx.lineTo(r * .3, r * .85); ctx.lineTo(r * .1, r * 1.05); ctx.lineTo(-r * .1, r * .85); ctx.lineTo(-r * .3, r * 1.05); ctx.lineTo(-r * .5, r * .85);
        ctx.bezierCurveTo(-r * .8, r * .85, -r * 1.0, r * .4, -r * 1.0, -r * .1);
        ctx.bezierCurveTo(-r * .85, -r * .7, -r * .4, -r * 1.0, 0, -r * .9);
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      const hl = ctx.createRadialGradient(-r * .3, -r * .4, 0, -r * .15, -r * .25, r * .5);
      hl.addColorStop(0, 'rgba(255,255,255,.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .32, r * .22, -.4, 0, Math.PI * 2); ctx.fill();
      if (m.isBoss) {
        ctx.fillStyle = '#fef2f2'; ctx.beginPath(); ctx.ellipse(0, -r * .2, r * .45, r * .35, 0, 0, Math.PI * 2); ctx.fill();
        const ig = ctx.createRadialGradient(0, -r * .2, 0, 0, -r * .2, r * .28);
        ig.addColorStop(0, '#7f1d1d'); ig.addColorStop(.6, '#dc2626'); ig.addColorStop(1, '#fca5a5');
        ctx.fillStyle = ig; ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.ellipse(0, -r * .2, r * .28, r * .28, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -r * .2, r * .06, r * .25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(r * .1, -r * .32, r * .06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.ellipse(0, r * .35, r * .55, r * .22, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#fafaf9';
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * .18, r * .35); ctx.lineTo(i * r * .18 - r * .07, r * .56); ctx.lineTo(i * r * .18 + r * .07, r * .56); ctx.closePath(); ctx.fill(); }
      } else {
        [-r * .28, r * .28].forEach(ox => {
          const oy = -r * .25;
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(ox, oy, r * .17, r * .2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = m.corBrilho; ctx.beginPath(); ctx.ellipse(ox, oy, r * .11, r * .14, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ox, oy, r * .04, r * .12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ox + r * .05, oy - r * .07, r * .04, 0, Math.PI * 2); ctx.fill();
        });
        ctx.strokeStyle = m.corOlho; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r * .4, r * .22); ctx.bezierCurveTo(-r * .2, r * .08, r * .2, r * .08, r * .4, r * .22); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * .15, r * .17); ctx.lineTo(i * r * .15 - r * .04, r * .28); ctx.lineTo(i * r * .15 + r * .04, r * .28); ctx.closePath(); ctx.fill(); }
      }
      ctx.restore();
      const bw = m.size * 1.1, bx2 = m.x - bw * .05, by2 = m.y - 18;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(bx2, by2, bw, 7, 4); ctx.fill();
      const hg = ctx.createLinearGradient(bx2, 0, bx2 + bw, 0);
      if (m.isBoss) { hg.addColorStop(0, '#7f1d1d'); hg.addColorStop(.5, '#ef4444'); hg.addColorStop(1, '#fca5a5'); }
      else { hg.addColorStop(0, m.corVariante); hg.addColorStop(1, m.corBrilho); }
      ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(bx2, by2, bw * Math.max(0, m.hp / m.maxHp), 7, 4); ctx.fill();
      ctx.fillStyle = m.isBoss ? '#fca5a5' : 'rgba(255,255,255,.7)';
      ctx.font = `bold ${m.isBoss ? 13 : 10}px monospace`; ctx.textAlign = 'center';
      ctx.fillText(m.isBoss ? '☠ BOSS ☠' : 'SLIME', cx, by2 - 4);
    }

    function desenharFinalBoss(m: Monstro) {
      const cx = m.x + m.size / 2, cy = m.y + m.size / 2, r = m.size / 2;
      const bs = 1 + Math.sin(m.breathe) * .05;
      const hox = m.hitTimer > 0 ? (Math.random() - .5) * 12 : 0, hoy = m.hitTimer > 0 ? (Math.random() - .5) * 12 : 0;
      if (m.hitTimer > 0) m.hitTimer--;
      ctx.save(); ctx.translate(cx + hox, cy + hoy); ctx.scale(bs, 2 - bs);
      const rR = r * 1.6 + Math.sin(tick * .04) * 8;
      const aG = ctx.createRadialGradient(0, 0, rR * .5, 0, 0, rR);
      aG.addColorStop(0, 'rgba(255,0,144,.08)'); aG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aG; ctx.beginPath(); ctx.arc(0, 0, rR, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 50;
      ctx.fillStyle = '#0c0010';
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2, s = i % 2 === 0 ? r * 1.15 : r * (.7 + .2 * Math.sin(tick * .06 + i)), w = Math.sin(tick * .05 + i * .8) * 8;
        if (i === 0) ctx.moveTo(Math.cos(a) * (s + w), Math.sin(a) * (s + w));
        else ctx.lineTo(Math.cos(a) * (s + w), Math.sin(a) * (s + w));
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.globalAlpha = .4 + .2 * Math.sin(tick * .08);
      for (let v = 0; v < 5; v++) {
        const va = (v / 5) * Math.PI * 2 + tick * .01;
        ctx.strokeStyle = v % 2 === 0 ? '#ff0090' : '#9900ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(va) * r * .1, Math.sin(va) * r * .1);
        ctx.bezierCurveTo(Math.cos(va + .5) * r * .5, Math.sin(va + .5) * r * .5, Math.cos(va - .5) * r * .7, Math.sin(va - .5) * r * .7, Math.cos(va) * r * .95, Math.sin(va) * r * .95);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a001a'; ctx.beginPath(); ctx.ellipse(0, -r * .15, r * .55, r * .42, 0, 0, Math.PI * 2); ctx.fill();
      const iG = ctx.createRadialGradient(0, -r * .15, 0, 0, -r * .15, r * .35);
      iG.addColorStop(0, '#ff0090'); iG.addColorStop(.5, '#9900ff'); iG.addColorStop(1, '#ff0090');
      ctx.fillStyle = iG; ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.ellipse(0, -r * .15, r * .35, r * .32, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -r * .15, r * .28, r * .06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,255,.9)'; ctx.beginPath(); ctx.arc(r * .12, -r * .28, r * .07, 0, Math.PI * 2); ctx.fill();
      [{ x: -r * .55, y: -r * .52 }, { x: r * .55, y: -r * .52 }, { x: -r * .7, y: r * .1 }, { x: r * .7, y: r * .1 }].forEach((op, oi) => {
        ctx.fillStyle = '#0d000d'; ctx.beginPath(); ctx.ellipse(op.x, op.y, r * .14, r * .12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = oi % 2 === 0 ? '#ff0090' : '#cc00ff';
        ctx.beginPath(); ctx.ellipse(op.x, op.y, r * .08, r * .08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(op.x, op.y, r * .025, r * .07, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, r * .42, r * .72, r * .28, 0, 0, Math.PI); ctx.fill();
      for (let t = 0; t < 7; t++) {
        const tx = (t / 6 - .5) * r * 1.2, ph = r * (t % 2 === 0 ? .26 : .16) + Math.sin(tick * .08 + t) * 4;
        ctx.fillStyle = t % 3 === 0 ? '#ff6fff' : '#e0aaff';
        ctx.beginPath(); ctx.moveTo(tx - r * .06, r * .42); ctx.lineTo(tx, r * .42 + ph); ctx.lineTo(tx + r * .06, r * .42); ctx.closePath(); ctx.fill();
      }
      for (let s = 0; s < 5; s++) {
        const sa = (-Math.PI / 2) + (s - 2) * .28, sl = r * (s % 2 === 0 ? .55 : .35) + Math.sin(tick * .07 + s) * 6;
        const sx2 = Math.cos(sa) * r * .85, sy2 = Math.sin(sa) * r * .85, ex2 = Math.cos(sa) * (r * .85 + sl), ey2 = Math.sin(sa) * (r * .85 + sl);
        ctx.strokeStyle = s % 2 === 0 ? '#cc00ff' : '#ff0090'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(ex2, ey2); ctx.stroke();
      }
      ctx.restore();
      const bw = m.size * 1.3, bx2 = m.x - (bw - m.size) / 2, by2 = m.y - 28;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(bx2, by2, bw, 11);
      const hpG = ctx.createLinearGradient(bx2, 0, bx2 + bw, 0);
      hpG.addColorStop(0, '#4c0070'); hpG.addColorStop(.5, '#cc00ff'); hpG.addColorStop(1, '#ff6fff');
      ctx.fillStyle = hpG; ctx.fillRect(bx2, by2, bw * Math.max(0, m.hp / m.maxHp), 11);
      ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6fff';
      ctx.shadowColor = '#9900ff'; ctx.shadowBlur = 8; ctx.fillText('💀 BOSS FINAL 💀', cx, by2 - 5); ctx.shadowBlur = 0;
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#e9d5ff';
      ctx.fillText(`${Math.max(0, Math.floor(m.hp))} / ${m.maxHp}`, cx, by2 + 20);
    }

    function desenharRaio(wx: number, wy: number, prog: number) {
      const fase = prog < .3 ? prog / .3 : 1 - (prog - .3) / .7, alpha = Math.max(0, fase);
      const origemY = wy - 600;
      const pts: { x: number; y: number }[] = [{ x: wx + (Math.random() - .5) * 4, y: origemY }];
      for (let i = 1; i < 8; i++) { const t = i / 8; pts.push({ x: wx + (1 - t) * 35 * (Math.random() - .5), y: origemY + (wy - origemY) * t }); }
      pts.push({ x: wx, y: wy });
      ctx.save();
      ctx.globalAlpha = alpha * .7; ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); }); ctx.stroke();
      ctx.globalAlpha = alpha; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); }); ctx.stroke();
      if (prog > .2) {
        const ia = alpha * (prog < .5 ? 1 : 1 - (prog - .5) / .5);
        const og = ctx.createRadialGradient(wx, wy, 0, wx, wy, RAIO_AREA * 1.3);
        og.addColorStop(0, `rgba(232,121,249,${ia * .5})`); og.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = og; ctx.beginPath(); ctx.arc(wx, wy, RAIO_AREA * 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    function desenharFuracao(px: number, py: number, ang: number, timer: number) {
      const cx = px + 40, cy = py + 40, prog = timer / FUR_DUR;
      const al = prog < .1 ? prog / .1 : prog > .85 ? 1 - (prog - .85) / .15 : 1;
      ctx.save();
      for (let a = 0; a < 3; a++) { ctx.globalAlpha = al * (.15 + a * .06); ctx.strokeStyle = a % 2 === 0 ? '#fde68a' : '#fbbf24'; ctx.lineWidth = 3 - a * .5; ctx.beginPath(); ctx.ellipse(cx, cy, FUR_ALCANCE * (.3 + a * .2), FUR_ALCANCE * (.3 + a * .2) * .45, ang * (1 + a * .3) + (a * Math.PI * 2) / 3, 0, Math.PI * 1.7); ctx.stroke(); }
      for (let p = 0; p < 10; p++) { const t = (p / 10) * Math.PI * 2 + ang * 2.5, d = FUR_ALCANCE * (.5 + .5 * Math.sin(ang * 3 + p)); ctx.globalAlpha = al * .5; ctx.fillStyle = p % 2 === 0 ? '#fcd34d' : '#fff'; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * d, cy + Math.sin(t) * d * .5, 3, 0, Math.PI * 2); ctx.fill(); }
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, FUR_ALCANCE);
      gg.addColorStop(0, `rgba(253,230,138,${al * .45})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, FUR_ALCANCE, 0, Math.PI * 2); ctx.fill();
      for (let l = 0; l < 3; l++) { const la = ang * 3 + (l / 3) * Math.PI * 2, ld = FUR_ALCANCE * .65; ctx.save(); ctx.translate(cx + Math.cos(la) * ld, cy + Math.sin(la) * ld * .6); ctx.rotate(la + Math.PI / 2); ctx.globalAlpha = al * .95; if (imgArmaGuerr) ctx.drawImage(imgArmaGuerr, -22, -22, 44, 44); ctx.restore(); }
      ctx.globalAlpha = al; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a'; ctx.fillText(`🌪 ${Math.ceil((FUR_DUR - timer) / 60)}s`, cx, cy - FUR_ALCANCE * .6 - 8);
      ctx.globalAlpha = 1; ctx.restore();
    }

    function desenharAliado(a: SlimeAliado) {
      const cx = a.x + a.size / 2, cy = a.y + a.size / 2, r = a.size / 2, bs = 1 + Math.sin(a.breathe) * .07;
      // Efeito roxo/sombra ao redor dos aliados
      const auraG = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
      auraG.addColorStop(0, 'rgba(168,85,247,0.35)');
      auraG.addColorStop(0.5, 'rgba(109,40,217,0.18)');
      auraG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = auraG; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
      // Partículas roxas orbitando
      for (let p = 0; p < 4; p++) {
        const pa = tick * 0.08 + p * (Math.PI / 2);
        const px2 = cx + Math.cos(pa) * r * 1.6, py2 = cy + Math.sin(pa) * r * 1.6 * 0.5;
        ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tick * 0.12 + p);
        ctx.fillStyle = p % 2 === 0 ? '#e879f9' : '#a855f7';
        ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(px2, py2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(bs, 2 - bs);
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#7e22ce';
      ctx.beginPath(); ctx.moveTo(0, -r * .9); ctx.bezierCurveTo(r * .4, -r * 1.0, r * .85, -r * .7, r * 1.0, -r * .1); ctx.bezierCurveTo(r * 1.0, r * .4, r * .8, r * .85, r * .5, r * 1.05);
      ctx.lineTo(r * .3, r * .85); ctx.lineTo(r * .1, r * 1.05); ctx.lineTo(-r * .1, r * .85); ctx.lineTo(-r * .3, r * 1.05); ctx.lineTo(-r * .5, r * .85);
      ctx.bezierCurveTo(-r * .8, r * .85, -r * 1.0, r * .4, -r * 1.0, -r * .1); ctx.bezierCurveTo(-r * .85, -r * .7, -r * .4, -r * 1.0, 0, -r * .9);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      [-r * .28, r * .28].forEach(ox => {
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(ox, -r * .25, r * .17, r * .2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e879f9'; ctx.beginPath(); ctx.ellipse(ox, -r * .25, r * .11, r * .14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ox, -r * .25, r * .04, r * .12, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      const bw = a.size * 1.1, bx2 = a.x - bw * .05, by2 = a.y - 16;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx2, by2, bw, 6);
      const hg = ctx.createLinearGradient(bx2, 0, bx2 + bw, 0); hg.addColorStop(0, '#581c87'); hg.addColorStop(1, '#e879f9');
      ctx.fillStyle = hg; ctx.fillRect(bx2, by2, bw * Math.max(0, a.hp / a.maxHp), 6);
      ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('👁 SOMBRAS', cx, by2 - 3);
    }

    function desenharCorteSombrio(px: number, py: number, anguloBase: number, timer: number, duracao: number) {
      const cx = px + 40, cy = py + 40, prog = timer / duracao, alpha = prog < .25 ? prog / .25 : 1 - (prog - .25) / .75;
      const ai = anguloBase - CORTE_LARG / 2, af = anguloBase + CORTE_LARG / 2;
      ctx.save(); ctx.translate(cx, cy);
      ctx.globalAlpha = alpha * .2; ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 18; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, CORTE_ALC * .9, ai, af); ctx.stroke();
      ctx.globalAlpha = alpha * .9; ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, CORTE_ALC * .86, ai, af); ctx.stroke();
      ctx.globalAlpha = alpha * .7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      for (let s = 0; s < 2; s++) { const sa = anguloBase + (s - .5) * (CORTE_LARG * .55); ctx.beginPath(); ctx.moveTo(Math.cos(sa) * CORTE_ALC * .25, Math.sin(sa) * CORTE_ALC * .25); ctx.lineTo(Math.cos(sa) * CORTE_ALC * .92, Math.sin(sa) * CORTE_ALC * .92); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.restore();
    }

    function desenharProjetilSombrio(p: Projetil) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angulo);
      ctx.globalAlpha = .65; ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 13, -.65, .65); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(18, 0); ctx.stroke();
      ctx.fillStyle = '#f0abfc'; ctx.beginPath(); ctx.arc(13, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ── GUERREIRO: PROJÉTIL GUIADO PELO MOUSE ──────────────────────
    function desenharProjetilGuerreiro(p: Projetil) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angulo);
      // rastro de fogo
      for (let t = 1; t <= 8; t++) {
        const tx = -p.vx / Math.hypot(p.vx, p.vy) * t * 8;
        const ty = -p.vy / Math.hypot(p.vx, p.vy) * t * 8;
        ctx.save(); ctx.translate(tx, ty);
        ctx.globalAlpha = 0.45 * (1 - t / 8);
        const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 - t);
        fg.addColorStop(0, '#fff'); fg.addColorStop(0.3, '#fbbf24'); fg.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 10 - t * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, '#fcd34d'); g.addColorStop(0.6, '#ef4444'); g.addColorStop(1, 'rgba(127,29,29,0)');
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 24;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
    }

    function desenharExplosaoArea(ex: ExplosaoArea) {
      const prog = ex.timer / ex.maxTimer, alpha = prog < .3 ? prog / .3 : 1 - (prog - .3) / .7, raio = SOMB_AREA * (.3 + prog * .7);
      ctx.save();
      ctx.globalAlpha = alpha * .6; ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, raio, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha * .25; ctx.fillStyle = '#a855f7';
      ctx.beginPath(); ctx.arc(ex.x, ex.y, raio * .8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.restore(); ex.timer++;
    }

    function desenharRyoikiTenkai(timer: number) {
      const W = canvas.width, H = canvas.height, prog = timer / RYO_DUR;
      const alpha = prog < .05 ? prog / .05 : prog > .92 ? 1 - (prog - .92) / .08 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * .97; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .9);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.6, 'rgba(80,0,0,.35)'); vg.addColorStop(1, 'rgba(140,0,0,.75)');
      ctx.globalAlpha = alpha; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const sx = W / 2, sy = H * .52, sw = 320, sh = 280;
      ctx.globalAlpha = alpha * .92;
      for (let d = 0; d < 3; d++) { const dw = sw * (.55 + d * .15), dh = 14, dy = sy + sh * .42 + d * dh; ctx.fillStyle = d === 0 ? '#1c0a00' : d === 1 ? '#150800' : '#0f0500'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(sx - dw / 2, dy, dw, dh); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#0d0400'; ctx.strokeStyle = '#991b1b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.rect(sx - sw * .28, sy - sh * .35, sw * .56, sh * .78); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c0700'; ctx.strokeStyle = '#991b1b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - sw * .42, sy - sh * .32); ctx.lineTo(sx, sy - sh * .70); ctx.lineTo(sx + sw * .42, sy - sh * .32); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.35)'; ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.ellipse(sx, sy - sh * .52, sw * .06, sh * .1, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      for (let c = -1; c <= 1; c += 2) {
        ctx.fillStyle = '#150600'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(sx + c * sw * .22, sy - sh * .3, sw * .06, sh * .66); ctx.fill(); ctx.stroke();
      }
      if (timer % RYO_SLASH_INT === 0) {
        const tipo: 'dismantle' | 'cleave' = Math.random() < .5 ? 'dismantle' : 'cleave';
        const ang = Math.random() * Math.PI * 2, vel = tipo === 'dismantle' ? 18 + Math.random() * 12 : 10 + Math.random() * 8;
        const sx2 = Math.random() < .5 ? (Math.random() < .5 ? -20 : W + 20) : Math.random() * W;
        const sy2 = Math.random() < .5 ? Math.random() * H : (Math.random() < .5 ? -20 : H + 20);
        const vida = tipo === 'dismantle' ? 18 + Math.floor(Math.random() * 10) : 30 + Math.floor(Math.random() * 15);
        slashesDomain.push({ x: sx2, y: sy2, angulo: ang, vel, vida, maxVida: vida, tipo, comprimento: tipo === 'dismantle' ? 80 + Math.random() * 80 : 60 + Math.random() * 60 });
      }
      for (let i = slashesDomain.length - 1; i >= 0; i--) { if (slashesDomain[i].vida <= 0) slashesDomain.splice(i, 1); }
      slashesDomain.forEach(s => {
        s.x += Math.cos(s.angulo) * s.vel; s.y += Math.sin(s.angulo) * s.vel; s.vida--;
        const sa = Math.min(1, (s.vida / s.maxVida) * 3);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angulo); ctx.globalAlpha = alpha * sa;
        if (s.tipo === 'dismantle') {
          ctx.strokeStyle = 'rgba(200,200,255,.35)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-s.comprimento * .3, 0); ctx.lineTo(s.comprimento * .7, 0); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-s.comprimento * .3, 0); ctx.lineTo(s.comprimento * .7, 0); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(255,180,180,.25)'; ctx.lineWidth = 11; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, s.comprimento * .6, -.5, .5); ctx.stroke();
          ctx.strokeStyle = '#ffdddd'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, s.comprimento * .58, -.45, .45); ctx.stroke();
        }
        ctx.restore();
      });
      for (let i = 0; i < 8; i++) {
        const px2 = ((tick * 3 + i * 137) % W), py2 = ((tick * 2 + i * 93) % H);
        ctx.globalAlpha = alpha * (.3 + .3 * Math.sin(tick * .1 + i));
        ctx.fillStyle = i % 2 === 0 ? '#930000' : '#a59e9e';
        ctx.beginPath(); ctx.arc(px2, py2, 2 + Math.sin(tick * .08 + i), 0, Math.PI * 2); ctx.fill();
      }
      const ta = prog < .08 ? prog / .08 : prog > .88 ? 1 - (prog - .88) / .12 : 1;
      ctx.globalAlpha = ta;
      ctx.font = 'bold 22px serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#7f1d1d'; ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 14;
      ctx.fillText('領域展開', W / 2, H - 90); ctx.shadowBlur = 0;
      ctx.font = 'bold 36px serif'; ctx.fillStyle = '#f5f5f5'; ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 22;
      ctx.fillText('Ryōiki Tenkai', W / 2, H - 55); ctx.shadowBlur = 0;
      ctx.globalAlpha = ta * (.65 + .35 * Math.sin(timer * .15));
      ctx.font = 'italic bold 17px serif'; ctx.fillStyle = '#dc2626'; ctx.shadowColor = '#7f1d1d'; ctx.shadowBlur = 8;
      ctx.fillText('"Fukuma Mizushi"  ·  伏魔御廚子', W / 2, H - 25); ctx.shadowBlur = 0;
      if (prog < .06) { ctx.globalAlpha = (1 - prog / .06) * .85; ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = alpha * .5;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(W * .1, H - 8, W * .8, 4);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(W * .1, H - 8, W * .8 * prog, 4);
      ctx.globalAlpha = 1; ctx.restore();
    }

    function desenharTransicaoOnda(dt: number) {
      const prog = dt / RYOIKI_DELAY, alpha = prog < .2 ? 1 : prog > .7 ? 1 - (prog - .7) / .3 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * .85; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = alpha; ctx.textAlign = 'center';
      ctx.font = 'bold 28px serif'; ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#dc2626'; ctx.shadowBlur = 16;
      ctx.fillText(`⚔ ONDA ${ondaAtual} ELIMINADA`, canvas.width / 2, canvas.height / 2 - 20); ctx.shadowBlur = 0;
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#fca5a5';
      ctx.fillText(`Próxima onda em ${Math.ceil((RYOIKI_DELAY - dt) / 60)}s...`, canvas.width / 2, canvas.height / 2 + 20);
      ctx.globalAlpha = 1; ctx.restore();
    }

    // ════════════════════════════════════════════════
    // SOMBRIO — Cutscene ARISE (Z)
    // ════════════════════════════════════════════════
    function desenharAriseCutscene(timer: number) {
      const W = canvas.width, H = canvas.height;
      const prog    = timer / ARISE_DUR;
      const fadeIn  = Math.min(1, timer / 25);
      const fadeOut = timer > ARISE_DUR - 35 ? Math.max(0, 1 - (timer - (ARISE_DUR - 35)) / 35) : 1;
      const alpha   = fadeIn * fadeOut;

      ctx.save();
      // Fundo escuro translúcido com gradiente roxo-preto
      ctx.globalAlpha = alpha * 0.88;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.05, W / 2, H * 0.6, H * 0.9);
      bg.addColorStop(0, 'rgba(60,0,90,0.55)');
      bg.addColorStop(0.5, 'rgba(20,0,40,0.35)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Raios de luz roxos a partir do centro
      ctx.globalAlpha = alpha * 0.35;
      for (let r = 0; r < 18; r++) {
        const ra = (r / 18) * Math.PI * 2 + tick * 0.005;
        ctx.strokeStyle = r % 3 === 0 ? '#a855f7' : r % 3 === 1 ? '#7c3aed' : '#e879f9';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(ra) * W, H / 2 + Math.sin(ra) * H); ctx.stroke();
      }

      // Partículas roxas flutuando
      ctx.globalAlpha = alpha;
      ariseParticulas.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vida--;
        if (p.vida <= 0) { p.x = W / 2 + (Math.random() - 0.5) * W * 0.8; p.y = H + 10; p.vx = (Math.random() - 0.5) * 1.5; p.vy = -(1.5 + Math.random() * 2.5); p.vida = 80 + Math.random() * 80; p.r = 2 + Math.random() * 5; }
        const pa = Math.min(1, p.vida / 20) * alpha;
        ctx.save(); ctx.globalAlpha = pa * 0.85;
        ctx.fillStyle = p.cor; ctx.shadowColor = p.cor; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });

      // Partículas de energia – anéis pulsantes
      for (let ring = 0; ring < 3; ring++) {
        const rProg = (prog + ring * 0.2) % 1;
        const rAlpha = rProg < 0.5 ? rProg / 0.5 : 1 - (rProg - 0.5) / 0.5;
        const rRadius = rProg * H * 0.65;
        ctx.globalAlpha = alpha * rAlpha * 0.3;
        ctx.strokeStyle = ring % 2 === 0 ? '#c084fc' : '#a855f7';
        ctx.lineWidth = 3 - ring;
        ctx.beginPath(); ctx.ellipse(W / 2, H * 0.62, rRadius, rRadius * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Igris aparece (left) — cavaleiro negro com armadura blood-red
      const igAlpha = Math.min(1, timer / 55) * fadeOut;
      const igScale = 0.3 + Math.min(1, timer / 50) * 0.7;
      const igX = W * 0.28, igY = H * 0.5;
      ctx.save(); ctx.globalAlpha = igAlpha;
      ctx.translate(igX, igY); ctx.scale(igScale, igScale);
      // Sombra / glow
      ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 40 + Math.sin(tick * 0.1) * 10;
      // Corpo do cavaleiro Igris (armadura negra, brilho roxo)
      // -- base do corpo
      ctx.fillStyle = '#0a0a14'; ctx.beginPath(); ctx.ellipse(0, 0, 28, 45, 0, 0, Math.PI * 2); ctx.fill();
      // -- armor plates
      for (let pl = 0; pl < 6; pl++) {
        const pa2 = (pl / 6) * Math.PI * 2; const pd2 = 22 + Math.sin(tick * 0.08 + pl) * 2;
        ctx.fillStyle = pl % 2 === 0 ? '#1a0a2e' : '#0d061a';
        ctx.beginPath(); ctx.ellipse(Math.cos(pa2) * pd2 * 0.5, Math.sin(pa2) * pd2 * 0.7, 8, 12, pa2, 0, Math.PI * 2); ctx.fill();
      }
      // -- helmet + plume
      ctx.fillStyle = '#110820';
      ctx.beginPath(); ctx.ellipse(0, -38, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
      // helmet horns
      for (let h = -1; h <= 1; h += 2) {
        ctx.beginPath(); ctx.moveTo(h * 6, -48); ctx.lineTo(h * 10, -70); ctx.lineTo(h * 14, -48); ctx.closePath(); ctx.fillStyle = '#220a38'; ctx.fill();
      }
      // red plume
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -58); for (let py2 = 0; py2 < 6; py2++) { ctx.lineTo((py2 % 2 === 0 ? 8 : -8), -58 - py2 * 8 - Math.sin(tick * 0.15 + py2) * 4); } ctx.stroke();
      // Y-shaped visor (glowing white eyes)
      ctx.fillStyle = '#f0f0ff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, -36, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      // sword
      ctx.strokeStyle = '#6b21a8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(30, -20); ctx.lineTo(30, 60); ctx.stroke();
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath(); ctx.rect(22, -25, 16, 10); ctx.fill();
      // cape
      ctx.globalAlpha = igAlpha * 0.7; ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(20,5,50,0.6)';
      ctx.beginPath(); ctx.moveTo(-20, -10); ctx.quadraticCurveTo(-40 + Math.sin(tick * 0.08) * 8, 20, -22, 55); ctx.lineTo(20, 55); ctx.quadraticCurveTo(35 + Math.sin(tick * 0.08) * 5, 20, 20, -10); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
      // Label
      ctx.save(); ctx.globalAlpha = igAlpha; ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#c084fc'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 12;
      ctx.fillText('IGRIS', igX, igY + 75 * igScale + 10); ctx.shadowBlur = 0; ctx.restore();

      // Beru aparece (right) — formiga humanoide roxa com asas
      const bAlpha = Math.min(1, Math.max(0, (timer - 15)) / 50) * fadeOut;
      const bScale = 0.3 + Math.min(1, Math.max(0, (timer - 15)) / 45) * 0.7;
      const bX = W * 0.72, bY = H * 0.5;
      ctx.save(); ctx.globalAlpha = bAlpha;
      ctx.translate(bX, bY); ctx.scale(bScale, bScale);
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 40 + Math.sin(tick * 0.1 + 1) * 10;
      // Corpo de Beru — formiga humanoide com brilho neon roxo
      ctx.fillStyle = '#1a0030';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 38, 0, 0, Math.PI * 2); ctx.fill();
      // Segmentos de formiga
      ctx.fillStyle = '#0d001a';
      ctx.beginPath(); ctx.ellipse(0, 22, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
      // Cabeça com mandíbulas
      ctx.fillStyle = '#1a0030';
      ctx.beginPath(); ctx.ellipse(0, -36, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
      // Olhos neon
      [-6, 6].forEach(ox => {
        ctx.fillStyle = '#e879f9'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(ox, -38, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(ox, -38, 2, 0, Math.PI * 2); ctx.fill();
      });
      // Mandíbulas / garras
      [-1, 1].forEach(s => {
        ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 12, -30); ctx.lineTo(s * 22, -18); ctx.lineTo(s * 18, -8); ctx.stroke();
      });
      // Asas fumacenta
      for (let w = 0; w < 2; w++) {
        const ws = w === 0 ? -1 : 1;
        ctx.save();
        ctx.globalAlpha = bAlpha * (0.5 + 0.2 * Math.sin(tick * 0.15 + w));
        ctx.fillStyle = `rgba(168,85,247,${0.25 + 0.1 * Math.sin(tick * 0.12)})`;
        ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(ws * 15, -10);
        ctx.bezierCurveTo(ws * 50, -50, ws * 65, -20, ws * 45, 20);
        ctx.bezierCurveTo(ws * 35, 35, ws * 20, 25, ws * 15, 10);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Garras nos braços
      [-1, 1].forEach(s => {
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(s * 22, -5); ctx.lineTo(s * 38, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 38, 8); ctx.lineTo(s * 44, 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 38, 8); ctx.lineTo(s * 42, 16); ctx.stroke();
      });
      ctx.shadowBlur = 0; ctx.restore();
      // Label
      ctx.save(); ctx.globalAlpha = bAlpha; ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 12;
      ctx.fillText('BERU', bX, bY + 70 * bScale + 10); ctx.shadowBlur = 0; ctx.restore();

      // Texto "ARISE" centralizado
      const textProg = Math.min(1, timer / 45);
      const textAlpha = textProg * fadeOut;
      ctx.save(); ctx.globalAlpha = textAlpha; ctx.textAlign = 'center';
      // Escala que cresce e depois estabiliza
      const textScale = 0.4 + textProg * 0.6;
      ctx.translate(W / 2, H * 0.22);
      ctx.scale(textScale, textScale);
      ctx.font = 'bold 88px serif';
      ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 50 + Math.sin(tick * 0.1) * 15;
      ctx.fillStyle = '#e9d5ff'; ctx.fillText('ARISE', 0, 0);
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 25;
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeText('ARISE', 0, 0);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#c084fc'; ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 12;
      ctx.fillText('— Shadow Monarch —', 0, 45);
      ctx.shadowBlur = 0; ctx.restore();

      // Nomes dos aliados aparecendo um a um
      if (ariseAliados.length > 0 && timer > 40) {
        const countShow = Math.min(ariseAliados.length, Math.floor((timer - 40) / 18) + 1);
        for (let i = 0; i < countShow; i++) {
          const a = ariseAliados[i];
          a.alpha = Math.min(0.9, a.alpha + 0.06); a.y += a.vy; a.vy *= 0.92;
          ctx.save(); ctx.globalAlpha = a.alpha * fadeOut; ctx.textAlign = 'center';
          ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#d8b4fe'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8;
          ctx.fillText(`► ${a.nome}`, a.x, a.y); ctx.shadowBlur = 0; ctx.restore();
        }
      }

      ctx.globalAlpha = 1; ctx.restore();
    }

    // ════════════════════════════════════════════════
    // SOMBRIO X — Invocação de Igris + Beru (ultimate)
    // ════════════════════════════════════════════════
    function desenharInvocacaoUltimate(timer: number) {
      const W = canvas.width, H = canvas.height;
      const prog    = timer / INVOC_DUR;
      const fadeIn  = Math.min(1, timer / 30);
      const fadeOut = timer > INVOC_DUR - 45 ? Math.max(0, 1 - (timer - (INVOC_DUR - 45)) / 45) : 1;
      const alpha   = fadeIn * fadeOut;

      ctx.save();
      // Fundo escuro profundo
      ctx.globalAlpha = alpha * 0.92; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const vg2 = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H);
      vg2.addColorStop(0, 'rgba(30,0,60,0.7)'); vg2.addColorStop(0.6, 'rgba(10,0,25,0.5)'); vg2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vg2; ctx.fillRect(0, 0, W, H);

      // Partículas sombrias flutuando para cima
      ctx.globalAlpha = alpha;
      invocParticulas.forEach(p => {
        p.x += p.vx + Math.sin(tick * 0.04 + p.r) * 0.3; p.y += p.vy; p.vida--;
        if (p.vida <= 0) {
          p.x = Math.random() * W; p.y = H + 10;
          p.vx = (Math.random() - 0.5) * 1.2; p.vy = -(1 + Math.random() * 3); p.vida = 60 + Math.random() * 100; p.r = 1.5 + Math.random() * 4;
          p.cor = ['#7c3aed','#a855f7','#c084fc','#e879f9','#581c87'][Math.floor(Math.random() * 5)];
        }
        const pa2 = Math.min(1, p.vida / 25) * alpha;
        ctx.save(); ctx.globalAlpha = pa2;
        ctx.fillStyle = p.cor; ctx.shadowColor = p.cor; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });

      // Círculos de energia expandindo
      for (let ring = 0; ring < 5; ring++) {
        const rProg = (prog * 2 + ring * 0.22) % 1;
        const rA = rProg < 0.4 ? rProg / 0.4 : 1 - (rProg - 0.4) / 0.6;
        ctx.globalAlpha = alpha * rA * 0.45;
        ctx.strokeStyle = ring % 2 === 0 ? '#7c3aed' : '#e879f9'; ctx.lineWidth = 2.5;
        ctx.shadowColor = ring % 2 === 0 ? '#7c3aed' : '#e879f9'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, rProg * Math.min(W, H) * 0.6, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Igris — cavaleiro avançando da esquerda para o centro
      const igrisEnter = Math.min(1, timer / 70);
      const igrisX = W * (0.1 + igrisEnter * 0.22);
      igrisPos.x = igrisX; igrisPos.y = H * 0.5; igrisPos.alpha = igrisEnter; igrisPos.scale = 0.5 + igrisEnter * 0.5;

      ctx.save(); ctx.globalAlpha = igrisPos.alpha * alpha;
      ctx.translate(igrisPos.x, igrisPos.y); ctx.scale(igrisPos.scale * 1.1, igrisPos.scale * 1.1);
      ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 55 + Math.sin(tick * 0.08) * 15;
      // Body
      ctx.fillStyle = '#0a0814';
      ctx.beginPath(); ctx.ellipse(0, 0, 32, 52, 0, 0, Math.PI * 2); ctx.fill();
      // Armor segments
      for (let pl = 0; pl < 8; pl++) {
        const pa2 = (pl / 8) * Math.PI * 2;
        ctx.fillStyle = pl % 2 === 0 ? '#1a0a30' : '#0d0618';
        ctx.beginPath(); ctx.ellipse(Math.cos(pa2) * 14, Math.sin(pa2) * 22, 7, 10, pa2, 0, Math.PI * 2); ctx.fill();
      }
      // Glow lines on armor
      ctx.strokeStyle = 'rgba(124,58,237,0.7)'; ctx.lineWidth = 1.5;
      for (let gl = 0; gl < 5; gl++) {
        const gy = -20 + gl * 12;
        ctx.beginPath(); ctx.moveTo(-20, gy); ctx.lineTo(20, gy); ctx.stroke();
      }
      // Helmet
      ctx.fillStyle = '#110820';
      ctx.beginPath(); ctx.ellipse(0, -45, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
      // 4 horns
      ([[-8,-3],[-4,-1],[4,-1],[8,-3]] as [number,number][]).forEach(([hx, hoff]) => {
        ctx.fillStyle = '#220a38';
        ctx.beginPath(); ctx.moveTo(hx, -58 + hoff); ctx.lineTo(hx - 4, -78 + hoff); ctx.lineTo(hx + 4, -78 + hoff); ctx.closePath(); ctx.fill();
      });
      // Red plume
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -65);
      for (let py2 = 0; py2 < 8; py2++) ctx.lineTo(py2 % 2 === 0 ? 10 : -10, -65 - py2 * 10 - Math.sin(tick * 0.12 + py2) * 5);
      ctx.stroke();
      // Glowing Y-shaped eye visor
      ctx.fillStyle = '#f0f0ff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(-5, -44, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -44, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      // Big sword — bronze/golden colored
      const swordBob = Math.sin(tick * 0.06) * 3;
      ctx.shadowColor = '#6b21a8'; ctx.shadowBlur = 20;
      ctx.strokeStyle = '#6b21a8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(40, -30 + swordBob); ctx.lineTo(40, 75 + swordBob); ctx.stroke();
      ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.rect(28, -38 + swordBob, 24, 12); ctx.fill();
      ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.rect(34, -48 + swordBob, 12, 14); ctx.fill();
      // Tattered cape
      ctx.globalAlpha = igrisPos.alpha * alpha * 0.75;
      ctx.fillStyle = 'rgba(17,4,36,0.7)';
      ctx.beginPath(); ctx.moveTo(-25, -15); ctx.quadraticCurveTo(-55 + Math.sin(tick * 0.07) * 10, 25, -28, 68); ctx.lineTo(25, 68); ctx.quadraticCurveTo(45 + Math.sin(tick * 0.07) * 7, 22, 25, -15); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
      // Igris label
      ctx.save(); ctx.globalAlpha = igrisEnter * alpha; ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#c4b5fd'; ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 14;
      ctx.fillText('⚔ IGRIS', igrisPos.x, igrisPos.y + 80 * igrisPos.scale + 12);
      ctx.font = '10px monospace'; ctx.fillStyle = '#a78bfa'; ctx.shadowBlur = 8;
      ctx.fillText('Marshal-Grade Knight', igrisPos.x, igrisPos.y + 80 * igrisPos.scale + 28); ctx.shadowBlur = 0; ctx.restore();

      // Beru — formiga/ant humanoide voando da direita
      const beruEnter = Math.min(1, Math.max(0, (timer - 20)) / 65);
      const beruX = W * (0.9 - beruEnter * 0.22);
      beruPos.x = beruX; beruPos.y = H * 0.5; beruPos.alpha = beruEnter; beruPos.scale = 0.5 + beruEnter * 0.5;

      ctx.save(); ctx.globalAlpha = beruPos.alpha * alpha;
      ctx.translate(beruPos.x, beruPos.y); ctx.scale(beruPos.scale * 1.1, beruPos.scale * 1.1);
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 55 + Math.sin(tick * 0.08 + 1) * 15;
      // Asas primeiro (fundo)
      for (let w = 0; w < 2; w++) {
        const ws = w === 0 ? -1 : 1;
        ctx.save(); ctx.globalAlpha = beruPos.alpha * alpha * (0.65 + 0.2 * Math.sin(tick * 0.15 + w));
        const wg = ctx.createLinearGradient(ws * 20, -30, ws * 75, 30);
        wg.addColorStop(0, 'rgba(168,85,247,0.5)'); wg.addColorStop(0.5, 'rgba(232,121,249,0.3)'); wg.addColorStop(1, 'rgba(88,28,135,0.1)');
        ctx.fillStyle = wg; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 25;
        ctx.beginPath(); ctx.moveTo(ws * 18, -12); ctx.bezierCurveTo(ws * 60, -70, ws * 85, -30, ws * 62, 28); ctx.bezierCurveTo(ws * 48, 48, ws * 28, 35, ws * 18, 14); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Corpo — formiga humanoide com exoesqueleto
      ctx.fillStyle = '#1a0030';
      ctx.beginPath(); ctx.ellipse(0, 0, 25, 42, 0, 0, Math.PI * 2); ctx.fill();
      // Segmento abdominal
      ctx.fillStyle = '#0d001a';
      ctx.beginPath(); ctx.ellipse(0, 28, 18, 16, 0, 0, Math.PI * 2); ctx.fill();
      // Placas de exo
      for (let s = 0; s < 4; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#2a0050' : '#1a0030';
        ctx.beginPath(); ctx.rect(-12 + s * 2, -30 + s * 14, 24 - s * 4, 12); ctx.fill();
      }
      // Linhas de brilho neon no corpo
      ctx.strokeStyle = 'rgba(232,121,249,0.65)'; ctx.lineWidth = 1.5;
      for (let gl = 0; gl < 4; gl++) { const gy = -22 + gl * 14; ctx.beginPath(); ctx.moveTo(-16, gy); ctx.lineTo(16, gy); ctx.stroke(); }
      // Cabeça com mandíbulas
      ctx.fillStyle = '#1f0035';
      ctx.beginPath(); ctx.ellipse(0, -42, 16, 18, 0, 0, Math.PI * 2); ctx.fill();
      // Antenas
      [-1, 1].forEach(s => {
        ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s * 8, -56); ctx.quadraticCurveTo(s * 18, -72, s * 12, -80); ctx.stroke();
        ctx.fillStyle = '#e879f9'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(s * 12, -80, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      });
      // Olhos neon brilhantes
      [-7, 7].forEach((ox, oi) => {
        ctx.fillStyle = '#e879f9'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(ox, -44, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = oi === 0 ? '#fff' : '#fce7f3'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(ox, -44, 2.5, 0, Math.PI * 2); ctx.fill();
      });
      // Mandíbulas
      [-1, 1].forEach(s => {
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 14, -35); ctx.lineTo(s * 26, -22); ctx.lineTo(s * 22, -10); ctx.stroke();
        // ponta da mandíbula
        ctx.fillStyle = '#a855f7';
        ctx.beginPath(); ctx.arc(s * 22, -10, 5, 0, Math.PI * 2); ctx.fill();
      });
      // Garras/braços
      [-1, 1].forEach(s => {
        ctx.strokeStyle = '#9333ea'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(s * 25, -8); ctx.lineTo(s * 45, 10); ctx.stroke();
        // dedos/garras
        for (let c = 0; c < 3; c++) {
          const ca = (c - 1) * 0.4 + (s > 0 ? 0.3 : -0.3);
          ctx.beginPath(); ctx.moveTo(s * 45, 10); ctx.lineTo(s * 45 + Math.cos(ca) * 18, 10 + Math.sin(ca) * 18); ctx.stroke();
        }
      });
      ctx.shadowBlur = 0; ctx.restore();
      // Beru label
      ctx.save(); ctx.globalAlpha = beruEnter * alpha; ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 14;
      ctx.fillText('🐜 BERU', beruPos.x, beruPos.y + 80 * beruPos.scale + 12);
      ctx.font = '10px monospace'; ctx.fillStyle = '#fce7f3'; ctx.shadowBlur = 8;
      ctx.fillText('Marshal-Grade Ant King', beruPos.x, beruPos.y + 80 * beruPos.scale + 28); ctx.shadowBlur = 0; ctx.restore();

      // Texto central
      const tProg = Math.min(1, timer / 60) * fadeOut;
      ctx.save(); ctx.globalAlpha = tProg; ctx.textAlign = 'center';
      ctx.font = 'bold 46px serif'; ctx.fillStyle = '#e9d5ff'; ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 40;
      ctx.fillText('ARISE', W / 2, H * 0.18); ctx.shadowBlur = 0;
      ctx.font = 'bold 22px serif'; ctx.fillStyle = '#c084fc'; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18;
      ctx.fillText('領域 · Shadow Monarch', W / 2, H * 0.18 + 38); ctx.shadowBlur = 0;

      // Frase épica
      if (timer > 80) {
        const lineFade = Math.min(1, (timer - 80) / 30) * fadeOut;
        ctx.globalAlpha = lineFade;
        ctx.font = 'italic bold 15px monospace'; ctx.fillStyle = '#a78bfa'; ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 10;
        ctx.fillText('"Surge das sombras e devore a luz."', W / 2, H * 0.88); ctx.shadowBlur = 0;
      }

      // Kill notification
      if (invocKilled && timer > INVOC_KILL_T) {
        const kf = Math.min(1, (timer - INVOC_KILL_T) / 25) * fadeOut;
        ctx.globalAlpha = kf; ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fce7f3'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
        ctx.fillText('— Todos os inimigos: aniquilados. —', W / 2, H * 0.82); ctx.shadowBlur = 0;
      }
      ctx.restore(); // fecha bloco texto central

      // Barra de progresso
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W * 0.15, H - 10, W * 0.7, 5);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(W * 0.15, H - 10, W * 0.7 * prog, 5);

      ctx.globalAlpha = 1; ctx.restore();
    } // fim desenharInvocacaoUltimate

    // ═══════════════════════════════════════════════════
    // LOOP PRINCIPAL
    // ═══════════════════════════════════════════════════
    const render = () => {
      tick++;

      if (estadoJogo !== 'jogando') {
        ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = estadoJogo === 'vitoria' ? '#fbbf24' : '#ef4444'; ctx.font = 'bold 48px serif';
        ctx.fillText(estadoJogo === 'vitoria' ? '✨ VITÓRIA! ✨' : '💀 GAME OVER 💀', canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = 'white'; ctx.font = '16px sans-serif';
        ctx.fillText('Recarregue (F5) para jogar novamente', canvas.width / 2, canvas.height / 2 + 45);
        animId = requestAnimationFrame(render); return;
      }

      if (ryoikiLimpouOnda) {
        ryoikiDelayTimer++;
        desenharTransicaoOnda(ryoikiDelayTimer);
        if (ryoikiDelayTimer >= RYOIKI_DELAY) {
          ryoikiLimpouOnda = false; ryoikiDelayTimer = 0;
          if (ondaAtual < TOTAL_ONDAS) { ondaAtual++; monstros = gerarOnda(ondaAtual); raioBossArr.length = 0; }
          else estadoJogo = 'vitoria';
        }
        animId = requestAnimationFrame(render); return;
      }

      // ── Movimento ──
      let dx = 0, dy = 0;
      if (teclas['w']) dy = -1; if (teclas['s']) dy = 1; if (teclas['a']) dx = -1; if (teclas['d']) dx = 1;
      if (dx || dy) {
        const sm = (furacaoAtivo && cl === 'guerreiro') ? FUR_VEL : 1;
        const nx = player.x + dx * player.speed * sm, ny = player.y + dy * player.speed * sm;
        if (nx > 0 && nx < WORLD_WIDTH - player.size) player.x = nx;
        if (ny > 0 && ny < WORLD_HEIGHT - player.size) player.y = ny;
        player.direcaoRad = Math.atan2(dy, dx);
      }

      if (++syncMovTick >= 2) {
        syncMovTick = 0;
        socketRef.current?.emit('mover', { x: player.x, y: player.y, direcaoRad: player.direcaoRad });
        socketRef.current?.emit('sync_hp', { hp: playerHp, hpMax: status.hpMax });
      }

      // ── Ataque ESPAÇO ──
      if (teclas[' '] && player.cooldownAtaque <= 0) {
        if (cl === 'guerreiro') {
          // PROJÉTIL GUIADO PELO MOUSE (substitui melee)
          if (guerrProjCooldown <= 0) {
            const mwx = mouseRef.current.x + camera.x, mwy = mouseRef.current.y + camera.y;
            const ang = Math.atan2(mwy - (player.y + 40), mwx - (player.x + 40));
            player.direcaoRad = ang;
            projectiles.push({
              x: player.x + 40, y: player.y + 40,
              vx: Math.cos(ang) * GUERR_PROJ_VEL, vy: Math.sin(ang) * GUERR_PROJ_VEL,
              tipo: 'guerreiro', angulo: ang, dano: GUERR_PROJ_DAN,
              homing: true
            });
            guerrProjCooldown = GUERR_PROJ_CD;
            socketRef.current?.emit('atacar', { tipo: 'projGuerreiro', angulo: ang });
          }
        } else if (cl === 'mago') {
          const mwx = mouseRef.current.x + camera.x, mwy = mouseRef.current.y + camera.y;
          const ang = Math.atan2(mwy - (player.y + 40), mwx - (player.x + 40)); player.direcaoRad = ang;
          projectiles.push({ x: player.x + 40, y: player.y + 40, vx: Math.cos(ang) * 15, vy: Math.sin(ang) * 15, tipo: 'mago', angulo: ang, dano: 15 + status.int });
          player.cooldownAtaque = 15;
        } else {
          const mwx = mouseRef.current.x + camera.x, mwy = mouseRef.current.y + camera.y;
          const ang = Math.atan2(mwy - (player.y + 40), mwx - (player.x + 40)); player.direcaoRad = ang;
          projectiles.push({ x: player.x + 40, y: player.y + 40, vx: Math.cos(ang) * 11, vy: Math.sin(ang) * 11, tipo: 'sombrio', angulo: ang, dano: CORTE_DANO });
          player.cooldownAtaque = 18;
        }
      }
      if (player.cooldownAtaque > 0) player.cooldownAtaque--;
      if (guerrProjCooldown > 0) guerrProjCooldown--;

      // ── Habilidades ──

      if (cl === 'mago') {
        // Z: HOLLOW PURPLE
        if (teclas['z'] && hollowCooldown <= 0 && hollowFase === 'idle') { hollowFase = 'carregando'; hollowTimer = 0; }
        if (hollowFase === 'carregando') {
          hollowTimer++;
          const px = player.x + 40, py = player.y + 40;
          const ang = Math.atan2(mouseRef.current.y + camera.y - py, mouseRef.current.x + camera.x - px);
          const dist = 55;
          hollowEsferaAzul = { x: px + Math.cos(ang + Math.PI / 2) * dist, y: py + Math.sin(ang + Math.PI / 2) * dist, alpha: Math.min(1, hollowTimer / 30) };
          hollowEsferaVerm = { x: px + Math.cos(ang - Math.PI / 2) * dist, y: py + Math.sin(ang - Math.PI / 2) * dist, alpha: Math.min(1, hollowTimer / 30) };
          if (hollowTimer >= 45) {
            hollowFase = 'disparando'; hollowTimer = 0;
            const vx2 = Math.cos(ang) * 18, vy2 = Math.sin(ang) * 18;
            projectiles.push({ x: px, y: py, vx: vx2, vy: vy2, angulo: ang, dano: 250, tipo: 'hollow_purple' } as any);
            hollowCooldown = HOLLOW_CD_MAX;
          }
        }
        if (hollowFase === 'disparando') hollowFase = 'idle';
        if (hollowCooldown > 0) hollowCooldown--;

        // X: RYŌIKI TENKAI MAGO — agora com invulnerabilidade
        if (teclas['x'] && ryoikiMagoCooldown <= 0 && !ryoikiMagoAtivo) {
          ryoikiMagoAtivo = true; ryoikiMagoTimer = 0; ryoikiMagoKilled = false;
          floatingInfos = [];
          for (let fi = 0; fi < 120; fi++) floatingInfos.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vy: -(0.3 + Math.random() * 0.8), alpha: Math.random() * 0.7 + 0.2,
            txt: infoTexts[Math.floor(Math.random() * infoTexts.length)],
            color: ['#fff', '#e879f9', '#a78bfa', '#c084fc', '#f0abfc', '#ddd6fe'][Math.floor(Math.random() * 6)]
          });
        }
        if (ryoikiMagoAtivo) {
          ryoikiMagoTimer++;
          // INVULNERABILIDADE durante Ryōiki Tenkai do mago
          // (playerHp não é decrementado enquanto ativo — bloqueio na seção de dano)
          if (ryoikiMagoTimer >= RYOIKI_M_KILL_T && !ryoikiMagoKilled) {
            monstros.length = 0; ryoikiMagoKilled = true;
          }
          if (ryoikiMagoTimer >= RYOIKI_M_DUR) {
            ryoikiMagoAtivo = false; ryoikiMagoCooldown = RYOIKI_M_CD_MAX; floatingInfos = [];
          }
        }
        if (ryoikiMagoCooldown > 0) ryoikiMagoCooldown--;
      }

      if (cl === 'guerreiro') {
        if (teclas['z'] && furacaoCooldown <= 0 && !furacaoAtivo) { furacaoAtivo = true; furacaoTimer = 0; furacaoCooldown = FUR_CD_MAX; socketRef.current?.emit('habilidade_z', { tipo: 'furacao' }); }
        if (furacaoAtivo) {
          furacaoTimer++; furacaoAngulo += .18;
          monstros.forEach(m => { const ddx = (m.x + m.size / 2) - (player.x + 40), ddy = (m.y + m.size / 2) - (player.y + 40); if (Math.hypot(ddx, ddy) < FUR_ALCANCE + m.size / 2) { m.hp -= FUR_DANO_TICK; m.hitTimer = 3; const d = Math.max(1, Math.hypot(ddx, ddy)); m.x += (ddx / d) * 2.5; m.y += (ddy / d) * 2.5; } });
          if (furacaoTimer >= FUR_DUR) furacaoAtivo = false;
        }
        if (furacaoCooldown > 0) furacaoCooldown--;
        if (teclas['x'] && ryoikiCooldown <= 0 && !ryoikiAtivo && !ryoikiLimpouOnda) {
          ryoikiAtivo = true; ryoikiTimer = 0; ryoikiCooldown = RYO_CD_MAX; slashesDomain = [];
          socketRef.current?.emit('habilidade_z', { tipo: 'ryoiki' });
        }
        if (ryoikiAtivo) {
          ryoikiTimer++;
          monstros.forEach(m => { m.hp -= (m.hp + m.maxHp) / RYO_DUR + 5; m.hitTimer = 3; });
          for (let i = monstros.length - 1; i >= 0; i--) { if (monstros[i].hp <= 0) monstros.splice(i, 1); }
          if (ryoikiTimer >= RYO_DUR) { monstros.length = 0; ryoikiAtivo = false; slashesDomain = []; ryoikiLimpouOnda = true; ryoikiDelayTimer = 0; }
        }
        if (ryoikiCooldown > 0) ryoikiCooldown--;
      }

      if (cl === 'sombrio') {
        // Z: ARISE — invoca aliados COM cutscene épica
        if (teclas['z'] && ressurrCooldown <= 0 && killsAcum >= KILLS_NEEDED && !ariseAtivo && !invocAtivo) {
          ariseAtivo = true; ariseTimer = 0;
          // Inicializa partículas da cutscene
          ariseParticulas = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 1.5, vy: -(1.5 + Math.random() * 2.5),
            vida: 80 + Math.random() * 80, r: 2 + Math.random() * 5,
            cor: ['#7c3aed','#a855f7','#c084fc','#e879f9','#4c1d95'][Math.floor(Math.random() * 5)]
          }));
          // Prepara nomes dos aliados para mostrar
          const pi = mortos.slice(0, MAX_ALIADOS);
          ariseAliados = pi.map((_, i) => ({
            x: canvas.width * 0.5 + (i - pi.length / 2) * 100,
            y: canvas.height * 0.72, nome: `Sombra #${i + 1}`,
            alpha: 0, scale: 1, vy: -2
          }));
          socketRef.current?.emit('habilidade_z', { tipo: 'ressurr' });
        }
        // Processamento da cutscene ARISE
        if (ariseAtivo) {
          ariseTimer++;
          // Na metade da cutscene, de fato invoca os aliados
          if (ariseTimer === 75 && killsAcum >= KILLS_NEEDED) {
            const pi = mortos.splice(0, MAX_ALIADOS);
            pi.forEach((m, i) => {
              const as = (i / Math.max(1, pi.length)) * Math.PI * 2, ds = 80 + i * 20;
              aliados.push({ id: Date.now() + i, x: player.x + Math.cos(as) * ds, y: player.y + Math.sin(as) * ds, hp: m.maxHp, maxHp: m.maxHp, size: m.size, breathe: Math.random() * Math.PI * 2, breatheSpeed: .03, hitTimer: 0, anguloAtaque: 0, cooldownAtaque: 0, spawnTimer: 0 });
            });
            killsAcum = 0; ressurrCooldown = RESSURR_CD_MAX;
          }
          if (ariseTimer >= ARISE_DUR) { ariseAtivo = false; ariseParticulas = []; }
        }

        if (ressurrCooldown > 0) ressurrCooldown--;

        // X: INVOCAÇÃO DE IGRIS + BERU (ultimate) — mata toda a onda + invulnerabilidade
        if (teclas['x'] && invocCooldown <= 0 && !invocAtivo && !ariseAtivo) {
          invocAtivo = true; invocTimer = 0; invocKilled = false;
          // Inicializa partículas
          invocParticulas = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 1.2, vy: -(1 + Math.random() * 3),
            vida: 60 + Math.random() * 100, r: 1.5 + Math.random() * 4,
            cor: ['#7c3aed','#a855f7','#c084fc','#e879f9','#581c87'][Math.floor(Math.random() * 5)]
          }));
          socketRef.current?.emit('habilidade_z', { tipo: 'invocacao_ultimate' });
        }
        if (invocAtivo) {
          invocTimer++;
          // Mata todos os monstros na metade da animação
          if (invocTimer >= INVOC_KILL_T && !invocKilled) {
            monstros.forEach(m => { for (let ex = 0; ex < 3; ex++) explosoesArea.push({ x: m.x + m.size / 2, y: m.y + m.size / 2, timer: 0, maxTimer: 40 }); });
            monstros.length = 0; invocKilled = true;
          }
          if (invocTimer >= INVOC_DUR) {
            invocAtivo = false; invocParticulas = [];
            invocCooldown = INVOC_CD_MAX;
            // Após a invocação, avança a onda
            ryoikiLimpouOnda = true; ryoikiDelayTimer = 0;
          }
        }
        if (invocCooldown > 0) invocCooldown--;

        aliados = aliados.filter(a => {
          a.breathe += a.breatheSpeed; if (a.cooldownAtaque > 0) a.cooldownAtaque--;
          let ai2 = -1, md = Infinity;
          monstros.forEach((m) => { const d = Math.hypot((m.x + m.size / 2) - (a.x + a.size / 2), (m.y + m.size / 2) - (a.y + a.size / 2)); if (d < md) { md = d; ai2 = monstros.indexOf(m); } });
          if (ai2 >= 0) { const alv = monstros[ai2], adx = (alv.x + alv.size / 2) - (a.x + a.size / 2), ady = (alv.y + alv.size / 2) - (a.y + a.size / 2), ad = Math.max(1, Math.hypot(adx, ady)); a.anguloAtaque = Math.atan2(ady, adx); if (ad > ALIADO_ALCANCE) { a.x += (adx / ad) * 1.8; a.y += (ady / ad) * 1.8; } if (ad < ALIADO_ALCANCE + alv.size / 2 && a.cooldownAtaque <= 0) { alv.hp -= ALIADO_DANO; alv.hitTimer = 6; a.cooldownAtaque = ALIADO_CD; } }
          return a.hp > 0;
        });
      }

      // ── Avanço de onda ──
      if (monstros.length === 0 && !ryoikiAtivo && !ryoikiLimpouOnda && !invocAtivo) {
        if (ondaAtual < TOTAL_ONDAS) { ondaAtual++; monstros = gerarOnda(ondaAtual); raioBossArr.length = 0; }
        else estadoJogo = 'vitoria';
      }

      // ── Câmera ──
      camera.x = Math.max(0, Math.min(player.x + 40 - canvas.width / 2, WORLD_WIDTH - canvas.width));
      camera.y = Math.max(0, Math.min(player.y + 40 - canvas.height / 2, WORLD_HEIGHT - canvas.height));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      if (cenarioPtrn) { ctx.fillStyle = cenarioPtrn; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); }
      else { ctx.fillStyle = '#0f0f1a'; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); }

      Object.values(remotosRef.current).forEach(jr => desenharJogadorRemoto(jr));

      const danoSlimeNormal = 0.4 + ondaAtual * 0.18;
      const danoSlimeBoss   = 1.5 + ondaAtual * 0.25;
      const danoFinalBoss   = 2.5 + ondaAtual * 0.3;

      // Jogador invulnerável durante: Ryōiki Mago, Invocação Ultimate sombrio
      const estaInvulneravel = (cl === 'mago' && ryoikiMagoAtivo) || (cl === 'sombrio' && invocAtivo);

      const monstrosParaRemover: number[] = [];
      monstros.forEach((m, idx) => {
        m.breathe += m.breatheSpeed;
        const pd = Math.hypot(player.x - m.x, player.y - m.y);
        let ax = player.x, ay = player.y, amd = pd, aEh = false, aIdx = -1;
        aliados.forEach((a, ai) => { const d = Math.hypot(a.x - m.x, a.y - m.y); if (d < amd) { amd = d; ax = a.x; ay = a.y; aEh = true; aIdx = ai; } });
        if (amd < 1200) {
          const velScale = 1 + ondaAtual * 0.04;
          const vel = m.isFinalBoss ? .003 * velScale : m.isBoss ? .005 * velScale : .01 * velScale;
          m.x += (ax - m.x) * vel; m.y += (ay - m.y) * vel;
          if (!aEh) {
            if (pd < (m.isFinalBoss ? 140 : m.isBoss ? 100 : 40)) {
              // SÓ causa dano se o jogador NÃO estiver invulnerável
              if (!estaInvulneravel) {
                playerHp -= m.isFinalBoss ? danoFinalBoss : m.isBoss ? danoSlimeBoss : danoSlimeNormal;
                if (playerHp <= 0) estadoJogo = 'gameover';
              }
            }
          } else if (aIdx >= 0) { if (amd < (m.isBoss ? 100 : 40)) aliados[aIdx].hp -= (m.isBoss ? 1.5 : .4); }
        }
        if (m.isFinalBoss) {
          if (m.raioCooldown === undefined) m.raioCooldown = RAIO_BOSS_CD;
          m.raioCooldown!--;
          if (m.raioCooldown! <= 0) {
            const numRaios = ondaAtual >= 20 ? 5 : 3; m.raioCooldown = RAIO_BOSS_CD;
            for (let r2 = 0; r2 < numRaios; r2++) {
              const sp = (r2 - Math.floor(numRaios / 2)) * .35;
              const ang = Math.atan2((player.y + 40) - (m.y + m.size / 2), (player.x + 40) - (m.x + m.size / 2)) + sp;
              raioBossArr.push({ x: m.x + m.size / 2, y: m.y + m.size / 2, vx: Math.cos(ang) * RAIO_BOSS_VEL, vy: Math.sin(ang) * RAIO_BOSS_VEL, angulo: ang, vida: RAIO_BOSS_VIDA, homingTimer: 0 });
            }
          }
          desenharFinalBoss(m);
        } else {
          desenharSlime(m);
        }
        if (melee.ativo) { const d = Math.hypot((player.x + 40) - (m.x + m.size / 2), (player.y + 40) - (m.y + m.size / 2)); if (d < (m.isBoss ? 150 : 100)) { m.hp -= 2; m.hitTimer = 6; if (!m.isBoss) { m.x += Math.cos(player.direcaoRad) * 10; m.y += Math.sin(player.direcaoRad) * 10; } } }
        if (cl === 'sombrio' && corte.ativo) { const cdx = (m.x + m.size / 2) - (player.x + 40), cdy = (m.y + m.size / 2) - (player.y + 40), cd = Math.hypot(cdx, cdy); if (cd < CORTE_ALC + m.size / 2) { let diff = Math.atan2(cdy, cdx) - corte.anguloBase; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; if (Math.abs(diff) < CORTE_LARG / 2) { m.hp -= CORTE_DANO * (1 / corte.duracao); m.hitTimer = 4; } } }
        if (m.hp <= 0) {
          if (!m.isBoss && cl === 'sombrio') { mortos.unshift({ hp: m.maxHp, maxHp: m.maxHp, size: m.size, x: m.x, y: m.y }); if (mortos.length > MAX_ALIADOS) mortos.pop(); if (killsAcum < KILLS_NEEDED) killsAcum++; }
          monstrosParaRemover.push(idx);
        }
      });
      for (let i = monstrosParaRemover.length - 1; i >= 0; i--) monstros.splice(monstrosParaRemover[i], 1);

      raioBossArr = raioBossArr.filter(rb => {
        rb.vida--; rb.homingTimer++;
        if (rb.homingTimer >= 10) { rb.homingTimer = 0; let diff = Math.atan2(player.y + 40 - rb.y, player.x + 40 - rb.x) - rb.angulo; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; rb.angulo += diff * .22; rb.vx = Math.cos(rb.angulo) * RAIO_BOSS_VEL; rb.vy = Math.sin(rb.angulo) * RAIO_BOSS_VEL; }
        rb.x += rb.vx; rb.y += rb.vy;
        if (Math.hypot(rb.x - (player.x + 40), rb.y - (player.y + 40)) < 28) {
          // Raios do boss também bloqueados por invulnerabilidade
          if (!estaInvulneravel) { playerHp -= RAIO_BOSS_DANO; if (playerHp <= 0) estadoJogo = 'gameover'; }
          return false;
        }
        if (rb.vida <= 0 || rb.x < 0 || rb.x > WORLD_WIDTH || rb.y < 0 || rb.y > WORLD_HEIGHT) return false;
        const al = Math.min(1, rb.vida / 20);
        ctx.save(); ctx.globalAlpha = al;
        ctx.strokeStyle = 'rgba(255,0,144,.3)'; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rb.x - rb.vx * 4, rb.y - rb.vy * 4); ctx.lineTo(rb.x, rb.y); ctx.stroke();
        ctx.strokeStyle = '#ff6fff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(rb.x - rb.vx * 3, rb.y - rb.vy * 3); ctx.lineTo(rb.x, rb.y); ctx.stroke();
        ctx.fillStyle = '#ff6fff'; ctx.beginPath(); ctx.arc(rb.x, rb.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.restore();
        return true;
      });

      // ── Projéteis ──
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) { projectiles.splice(i, 1); continue; }

        // ── GUERREIRO: projétil reto apontado pelo mouse no disparo ──
        if (p.tipo === 'guerreiro') {
          desenharProjetilGuerreiro(p);
          let hit = false;
          for (const m of monstros) {
            if (Math.hypot(p.x - (m.x + m.size / 2), p.y - (m.y + m.size / 2)) < m.size / 2 + 16) {
              m.hp -= p.dano; m.hitTimer = 8;
              // Explosão pequena de fogo
              explosoesArea.push({ x: p.x, y: p.y, timer: 0, maxTimer: 30 });
              projectiles.splice(i, 1); hit = true; break;
            }
          }
          continue;
        }

        if (p.tipo === 'sombrio') {
          if (p.dp === undefined) p.dp = 0; p.dp += Math.hypot(p.vx, p.vy);
          desenharProjetilSombrio(p);
          let explodiu = false;
          for (const m of monstros) { if (explodiu) break; const d = Math.hypot(p.x - (m.x + m.size / 2), p.y - (m.y + m.size / 2)); if (d < m.size / 2 + 16) { explodiu = true; monstros.forEach(alv => { const da = Math.hypot((alv.x + alv.size / 2) - p.x, (alv.y + alv.size / 2) - p.y); if (da < SOMB_AREA + alv.size / 2) { alv.hp -= p.dano * (1 - (da / SOMB_AREA) * .5); alv.hitTimer = 8; } }); explosoesArea.push({ x: p.x, y: p.y, timer: 0, maxTimer: 40 }); projectiles.splice(i, 1); } }
          if (!explodiu && (p.dp ?? 0) >= SOMB_ALC) { monstros.forEach(alv => { const da = Math.hypot((alv.x + alv.size / 2) - p.x, (alv.y + alv.size / 2) - p.y); if (da < SOMB_AREA + alv.size / 2) { alv.hp -= p.dano * (1 - (da / SOMB_AREA) * .5) * .6; alv.hitTimer = 6; } }); explosoesArea.push({ x: p.x, y: p.y, timer: 0, maxTimer: 40 }); projectiles.splice(i, 1); }

        } else if ((p as any).tipo === 'hollow_purple') {
          ctx.save();
          for (let t = 1; t <= 10; t++) {
            const tx = p.x - p.vx * t * 0.65, ty = p.y - p.vy * t * 0.65;
            const al = 0.55 * (1 - t / 10); const rs = 26 - t * 2;
            if (rs <= 0) continue;
            ctx.globalAlpha = al;
            const gr = ctx.createRadialGradient(tx, ty, 0, tx, ty, rs);
            gr.addColorStop(0, 'rgba(248,180,252,1)'); gr.addColorStop(0.4, 'rgba(168,85,247,0.8)'); gr.addColorStop(1, 'rgba(109,40,217,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tx, ty, rs, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          const gp = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
          gp.addColorStop(0, '#ffffff'); gp.addColorStop(0.15, '#f0abfc'); gp.addColorStop(0.5, '#a855f7'); gp.addColorStop(0.8, '#7c3aed'); gp.addColorStop(1, 'rgba(109,40,217,0)');
          ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 50;
          ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 20;
          ctx.strokeStyle = `rgba(240,171,252,0.6)`; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, 38 + Math.sin(tick * 0.5) * 5, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = `rgba(167,139,250,0.35)`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, 48 + Math.sin(tick * 0.4 + 1) * 6, 0, Math.PI * 2); ctx.stroke();
          for (let sp = 0; sp < 6; sp++) {
            const sa = tick * 0.25 + sp * (Math.PI * 2 / 6);
            const sx2 = p.x + Math.cos(sa) * 42, sy2 = p.y + Math.sin(sa) * 42;
            const sg = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, 5);
            sg.addColorStop(0, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(168,85,247,0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx2, sy2, 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.shadowBlur = 0; ctx.restore();
          let hit = false;
          for (let mi = monstros.length - 1; mi >= 0; mi--) {
            const m = monstros[mi];
            if (Math.hypot(p.x - (m.x + m.size / 2), p.y - (m.y + m.size / 2)) < m.size / 2 + 30) {
              monstros.forEach(alv => { const da = Math.hypot((alv.x + alv.size / 2) - p.x, (alv.y + alv.size / 2) - p.y); if (da < 200 + alv.size / 2) { alv.hp = 0; alv.hitTimer = 12; } });
              explosoesArea.push({ x: p.x, y: p.y, timer: 0, maxTimer: 60 });
              explosoesArea.push({ x: p.x + Math.random() * 60 - 30, y: p.y + Math.random() * 60 - 30, timer: 0, maxTimer: 40 });
              explosoesArea.push({ x: p.x + Math.random() * 80 - 40, y: p.y + Math.random() * 80 - 40, timer: 0, maxTimer: 35 });
              projectiles.splice(i, 1); hit = true; break;
            }
          }
          if (!hit && (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT)) projectiles.splice(i, 1);

        } else if (p.tipo === 'mago') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angulo);
          if (imgArmaMago) ctx.drawImage(imgArmaMago, -20, -20, 40, 40);
          ctx.restore();
          let hit = false;
          for (const m of monstros) { if (p.x > m.x && p.x < m.x + m.size && p.y > m.y && p.y < m.y + m.size) { m.hp -= p.dano / 5; m.hitTimer = 6; hit = true; break; } }
          if (hit) projectiles.splice(i, 1);
        }
      }

      explosoesArea = explosoesArea.filter(ex => { desenharExplosaoArea(ex); return ex.timer < ex.maxTimer; });

      if (melee.ativo) {
        melee.duracao--; melee.anguloAtual += Math.PI / 20;
        ctx.save(); ctx.translate(player.x + 40, player.y + 40); ctx.rotate(melee.anguloAtual);
        if (imgArmaGuerr) ctx.drawImage(imgArmaGuerr, 45, -35, 70, 70);
        ctx.strokeStyle = 'rgba(251,191,36,.25)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(0, 0, 75, melee.anguloAtual - Math.PI * .6, melee.anguloAtual); ctx.stroke();
        ctx.restore(); if (melee.duracao <= 0) melee.ativo = false;
      }

      if (furacaoAtivo && cl === 'guerreiro') desenharFuracao(player.x, player.y, furacaoAngulo, furacaoTimer);
      aliados.forEach(a => desenharAliado(a));
      if (cl === 'sombrio' && corte.ativo) { corte.timer++; desenharCorteSombrio(player.x, player.y, corte.anguloBase, corte.timer, corte.duracao); if (corte.timer >= corte.duracao) corte.ativo = false; }

      // Hollow Purple — esferas de carga
      if (cl === 'mago' && hollowFase === 'carregando') {
        const eb = hollowEsferaAzul;
        ctx.save(); ctx.globalAlpha = eb.alpha;
        ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 35;
        const gbAzul = ctx.createRadialGradient(eb.x, eb.y, 0, eb.x, eb.y, 22);
        gbAzul.addColorStop(0, '#ffffff'); gbAzul.addColorStop(0.25, '#bfdbfe'); gbAzul.addColorStop(0.6, '#3b82f6'); gbAzul.addColorStop(1, 'rgba(37,99,235,0)');
        ctx.fillStyle = gbAzul; ctx.beginPath(); ctx.arc(eb.x, eb.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(96,165,250,${0.7 * eb.alpha})`; ctx.lineWidth = 2; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(eb.x, eb.y, 28 + Math.sin(tick * 0.5) * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(eb.x, eb.y, 34 + Math.sin(tick * 0.4 + 1) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        const ev = hollowEsferaVerm;
        ctx.save(); ctx.globalAlpha = ev.alpha;
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 35;
        const gbVerm = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, 22);
        gbVerm.addColorStop(0, '#ffffff'); gbVerm.addColorStop(0.25, '#fecaca'); gbVerm.addColorStop(0.6, '#ef4444'); gbVerm.addColorStop(1, 'rgba(220,38,38,0)');
        ctx.fillStyle = gbVerm; ctx.beginPath(); ctx.arc(ev.x, ev.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(248,113,113,${0.7 * ev.alpha})`; ctx.lineWidth = 2; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(ev.x, ev.y, 28 + Math.sin(tick * 0.5 + Math.PI) * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ev.x, ev.y, 34 + Math.sin(tick * 0.4 + Math.PI + 1) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.globalAlpha = Math.min(eb.alpha, ev.alpha) * 0.45;
        ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(eb.x, eb.y); ctx.lineTo(ev.x, ev.y); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.restore();
      }

      if (imgPlayer) ctx.drawImage(imgPlayer, player.x, player.y, player.size, player.size);
      else { ctx.fillStyle = player.color; ctx.fillRect(player.x, player.y, player.size, player.size); }

      // Efeito visual de invulnerabilidade no jogador
      if (estaInvulneravel) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(tick * 0.2);
        const shieldG = ctx.createRadialGradient(player.x + 40, player.y + 40, 0, player.x + 40, player.y + 40, 60);
        shieldG.addColorStop(0, 'rgba(168,85,247,0)');
        shieldG.addColorStop(0.6, 'rgba(168,85,247,0.3)');
        shieldG.addColorStop(1, 'rgba(232,121,249,0.7)');
        ctx.fillStyle = shieldG; ctx.beginPath(); ctx.arc(player.x + 40, player.y + 40, 60, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 2.5; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(player.x + 40, player.y + 40, 55 + Math.sin(tick * 0.15) * 5, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
      }

      ctx.restore(); // fim câmera

      if (ryoikiAtivo && cl === 'guerreiro') desenharRyoikiTenkai(ryoikiTimer);

      // Ryōiki Tenkai Mago
      if (ryoikiMagoAtivo && cl === 'mago') {
        const fadeIn  = Math.min(1, ryoikiMagoTimer / 50);
        const fadeOut = ryoikiMagoTimer > RYOIKI_M_DUR - 60 ? Math.max(0, 1 - (ryoikiMagoTimer - (RYOIKI_M_DUR - 60)) / 60) : 1;
        const alpha   = fadeIn * fadeOut;
        const cx2 = canvas.width / 2, cy2 = canvas.height / 2;
        ctx.save();
        ctx.globalAlpha = alpha * 0.96; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let ring = 0; ring < 10; ring++) {
          const rBase = 35 + ring * 52, segs = 80, rotDir = ring % 2 === 0 ? 1 : -1, speed = 0.003 + ring * 0.0008;
          for (let s = 0; s < segs; s++) {
            const a1 = (s / segs) * Math.PI * 2 + tick * speed * rotDir;
            const a2 = ((s + 1) / segs) * Math.PI * 2 + tick * speed * rotDir;
            const wave = Math.sin(a1 * 4 + tick * 0.025) * 7, r1 = rBase + wave;
            const x1 = cx2 + Math.cos(a1) * r1, y1 = cy2 + Math.sin(a1) * r1 * 0.52;
            const x2 = cx2 + Math.cos(a2) * (rBase + Math.sin(a2 * 4 + tick * 0.025) * 7);
            const y2 = cy2 + Math.sin(a2) * (rBase + Math.sin(a2 * 4 + tick * 0.025) * 7) * 0.52;
            const hue = 265 + ring * 10 + Math.sin(tick * 0.025) * 25, lum = 50 + ring * 3;
            const opa = (0.06 + 0.08 * Math.sin(tick * 0.04 + ring)) * alpha;
            ctx.strokeStyle = `hsla(${hue},75%,${lum}%,${opa})`; ctx.lineWidth = ring < 3 ? 2 : 1.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          }
        }
        for (let s = 0; s < 24; s++) {
          const sy = ((s / 24) + (tick * 0.0012) % 1) * canvas.height;
          const sl = ctx.createLinearGradient(0, sy, canvas.width, sy);
          const strip = (0.015 + 0.03 * Math.abs(Math.sin(tick * 0.018 + s * 0.7))) * alpha;
          sl.addColorStop(0, 'transparent'); sl.addColorStop(0.15, `rgba(255,255,255,${strip})`);
          sl.addColorStop(0.5, `rgba(230,200,255,${strip * 1.6})`); sl.addColorStop(0.85, `rgba(255,255,255,${strip})`); sl.addColorStop(1, 'transparent');
          ctx.fillStyle = sl; ctx.fillRect(0, sy - 1, canvas.width, 1.5 + Math.sin(s + tick * 0.04) * 1.2);
        }
        for (let d = 0; d < 16; d++) {
          const dx = ((d / 16) * canvas.width + tick * 0.9) % (canvas.width + 80);
          const dl = ctx.createLinearGradient(dx, 0, dx + 60, canvas.height);
          const da = (0.025 + 0.05 * Math.abs(Math.sin(tick * 0.022 + d * 1.1))) * alpha;
          dl.addColorStop(0, 'transparent'); dl.addColorStop(0.3, `rgba(147,51,234,${da})`); dl.addColorStop(0.5, `rgba(232,121,249,${da * 1.4})`); dl.addColorStop(0.7, `rgba(167,139,250,${da})`); dl.addColorStop(1, 'transparent');
          ctx.fillStyle = dl; ctx.fillRect(dx, 0, 2.5, canvas.height);
        }
        for (let d = 0; d < 10; d++) {
          const dx = canvas.width - ((d / 10) * canvas.width + tick * 0.7) % (canvas.width + 80);
          const dl = ctx.createLinearGradient(dx, 0, dx - 50, canvas.height);
          const da = (0.018 + 0.03 * Math.abs(Math.sin(tick * 0.019 + d * 1.3))) * alpha;
          dl.addColorStop(0, 'transparent'); dl.addColorStop(0.4, `rgba(244,114,182,${da})`); dl.addColorStop(0.6, `rgba(251,207,232,${da * 1.3})`); dl.addColorStop(1, 'transparent');
          ctx.fillStyle = dl; ctx.fillRect(dx - 2.5, 0, 2.5, canvas.height);
        }
        for (let st = 0; st < 100; st++) {
          const sx = ((st * 137.508) % canvas.width), sy = ((st * 97.314) % canvas.height);
          const blink = 0.2 + 0.8 * Math.abs(Math.sin(tick * 0.03 + st * 0.4));
          ctx.save(); ctx.globalAlpha = blink * alpha * 0.55;
          ctx.fillStyle = st % 3 === 0 ? '#f0abfc' : st % 3 === 1 ? '#a78bfa' : '#ffffff';
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.arc(sx, sy, 1 + Math.sin(tick * 0.06 + st) * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        floatingInfos.forEach(fi => {
          fi.y += fi.vy; fi.alpha -= 0.0025;
          if (fi.y < -20 || fi.alpha <= 0) { fi.y = canvas.height + 10; fi.x = Math.random() * canvas.width; fi.alpha = 0.35 + Math.random() * 0.55; fi.txt = infoTexts[Math.floor(Math.random() * infoTexts.length)]; }
          ctx.save(); ctx.globalAlpha = fi.alpha * alpha; ctx.font = `bold ${7 + Math.random() * 5}px monospace`; ctx.textAlign = 'center'; ctx.fillStyle = fi.color; ctx.shadowColor = fi.color; ctx.shadowBlur = 8; ctx.fillText(fi.txt, fi.x, fi.y); ctx.restore();
        });
        const bhR = 45 + Math.sin(tick * 0.05) * 10, bhPulse = 0.7 + 0.3 * Math.sin(tick * 0.08);
        const bhHalo = ctx.createRadialGradient(cx2, cy2, bhR * 0.5, cx2, cy2, bhR * 3.5);
        bhHalo.addColorStop(0, 'rgba(60,0,100,0.5)'); bhHalo.addColorStop(0.4, `rgba(100,20,180,${0.25 * alpha})`); bhHalo.addColorStop(0.7, `rgba(200,100,255,${0.12 * alpha})`); bhHalo.addColorStop(1, 'transparent');
        ctx.fillStyle = bhHalo; ctx.beginPath(); ctx.arc(cx2, cy2, bhR * 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.globalAlpha = 0.65 * alpha * bhPulse;
        const bhRing = ctx.createRadialGradient(cx2, cy2, bhR * 0.85, cx2, cy2, bhR * 1.25);
        bhRing.addColorStop(0, 'transparent'); bhRing.addColorStop(0.3, `rgba(220,130,255,0.9)`); bhRing.addColorStop(0.6, `rgba(255,200,255,0.7)`); bhRing.addColorStop(1, 'transparent');
        ctx.fillStyle = bhRing; ctx.beginPath(); ctx.arc(cx2, cy2, bhR * 1.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.globalAlpha = alpha;
        const bhCore = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, bhR);
        bhCore.addColorStop(0, 'rgba(0,0,0,1)'); bhCore.addColorStop(0.7, 'rgba(0,0,0,0.98)'); bhCore.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = bhCore; ctx.beginPath(); ctx.arc(cx2, cy2, bhR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        const textFade = Math.min(1, ryoikiMagoTimer / 35) * fadeOut;
        ctx.save(); ctx.globalAlpha = textFade; ctx.textAlign = 'center';
        ctx.font = 'bold 32px serif'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 30; ctx.fillStyle = '#ffffff'; ctx.fillText('領域展開', cx2, 68);
        ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#e879f9'; ctx.shadowBlur = 18; ctx.fillText('Ryōiki Tenkai', cx2, 95);
        ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#c084fc'; ctx.shadowBlur = 12; ctx.fillText('無量空処 — O Vazio Ilimitado', cx2, 118);
        ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,150,255,0.65)'; ctx.shadowBlur = 0; ctx.fillText('Muryōkūsho  ·  Infinite information. Zero comprehension.', cx2, 138); ctx.restore();
        // Indicador de invulnerabilidade
        ctx.save(); ctx.globalAlpha = 0.9 * alpha; ctx.textAlign = 'center';
        ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#fae8ff'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 10;
        ctx.fillText('🛡 INVULNERÁVEL', cx2, 158); ctx.shadowBlur = 0; ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.7 * alpha * (0.6 + 0.4 * Math.sin(tick * 0.1));
        ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 2.5; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(cx2, cy2, 55 + Math.sin(tick * 0.08) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(cx2, cy2, 68 + Math.sin(tick * 0.06) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        if (ryoikiMagoKilled) {
          const kFade = Math.min(1, (ryoikiMagoTimer - RYOIKI_M_KILL_T) / 30) * fadeOut;
          ctx.save(); ctx.globalAlpha = kFade; ctx.textAlign = 'center'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fae8ff'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 18;
          ctx.fillText('— Todos os alvos: paralisados. Informação infinita. —', cx2, canvas.height - 38); ctx.shadowBlur = 0; ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.restore();
      }

      // ── Cutscene ARISE (Sombrio Z) ──
      if (ariseAtivo && cl === 'sombrio') desenharAriseCutscene(ariseTimer);

      // ── Invocação Ultimate (Sombrio X) ──
      if (invocAtivo && cl === 'sombrio') desenharInvocacaoUltimate(invocTimer);

      // ── UI ──
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(18, canvas.height - 44, 204, 22);
      const hpG = ctx.createLinearGradient(20, 0, 220, 0);
      hpG.addColorStop(0, '#7f1d1d'); hpG.addColorStop(.5, '#ef4444'); hpG.addColorStop(1, '#fca5a5');
      ctx.fillStyle = hpG; ctx.fillRect(20, canvas.height - 42, (Math.max(0, playerHp) / status.hpMax) * 200, 18);
      ctx.fillStyle = 'white'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`❤ ${Math.floor(Math.max(0, playerHp))} / ${status.hpMax}`, 26, canvas.height - 29);

      if (online) { ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#4ade80'; ctx.fillText(`🌐 ${qtJog}P`, canvas.width - 10, 20); }

      ctx.font = 'bold 18px serif'; ctx.textAlign = 'left';
      const isBossWave = ondaAtual % 5 === 0;
      const isFinalWave = ondaAtual === TOTAL_ONDAS;
      ctx.fillStyle = isFinalWave ? '#ff6fff' : isBossWave ? '#fca5a5' : '#e2e8f0';
      ctx.shadowColor = isFinalWave ? '#ff0090' : isBossWave ? '#dc2626' : '#7c3aed'; ctx.shadowBlur = 12;
      const ondaLabel = isFinalWave ? '💀 BOSS FINAL !! 💀' : isBossWave ? `⚠ ONDA ${ondaAtual} — BOSS ⚠` : `⚔ ONDA ${ondaAtual} / ${TOTAL_ONDAS}`;
      ctx.fillText(ondaLabel, 20, 38); ctx.shadowBlur = 0;

      // UI Mago
      if (cl === 'mago') {
        const hpRdy = hollowCooldown <= 0 && hollowFase === 'idle';
        const hpCar = hollowFase === 'carregando';
        const hcdr  = hollowCooldown / HOLLOW_CD_MAX;
        const bx = canvas.width - 74, by = canvas.height - 74, bs = 58;
        ctx.fillStyle = hpCar ? 'rgba(88,28,135,.97)' : hpRdy ? 'rgba(60,10,100,.92)' : 'rgba(15,5,25,.85)'; ctx.fillRect(bx, by, bs, bs);
        ctx.strokeStyle = hpCar ? '#f0abfc' : hpRdy ? '#e879f9' : '#4c1d95'; ctx.lineWidth = hpCar || hpRdy ? 2.5 : 1.5;
        if (hpCar || hpRdy) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = hpCar ? 22 : 12; }
        ctx.strokeRect(bx, by, bs, bs); ctx.shadowBlur = 0;
        if (!hpRdy && !hpCar) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx, by, bs, bs * hcdr); }
        ctx.save(); ctx.translate(bx + bs / 2, by + 29);
        const gleft = ctx.createRadialGradient(-9, 0, 0, -9, 0, 13);
        gleft.addColorStop(0, '#bfdbfe'); gleft.addColorStop(0.5, '#3b82f6'); gleft.addColorStop(1, 'rgba(37,99,235,0)');
        ctx.fillStyle = gleft; ctx.beginPath(); ctx.arc(-9, 0, 13, 0, Math.PI * 2); ctx.fill();
        const gright = ctx.createRadialGradient(9, 0, 0, 9, 0, 13);
        gright.addColorStop(0, '#fecaca'); gright.addColorStop(0.5, '#ef4444'); gright.addColorStop(1, 'rgba(220,38,38,0)');
        ctx.fillStyle = gright; ctx.beginPath(); ctx.arc(9, 0, 13, 0, Math.PI * 2); ctx.fill();
        if (hpRdy || hpCar) {
          const gm = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
          gm.addColorStop(0, '#fff'); gm.addColorStop(0.4, '#e879f9'); gm.addColorStop(1, 'rgba(168,85,247,0)');
          ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
          ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.restore();
        ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = hpRdy ? '#fae8ff' : hpCar ? '#f0abfc' : '#6b21a8';
        ctx.fillText(hpCar ? 'CARREGANDO...' : 'HOLLOW', bx + bs / 2, by + 46);
        ctx.fillText('[Z] PURPLE', bx + bs / 2, by + 56);
        if (!hpRdy && !hpCar) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#e9d5ff'; ctx.fillText(`${Math.ceil(hollowCooldown / 60)}s`, bx + bs / 2, by + 18); }
        const rRdy = ryoikiMagoCooldown <= 0 && !ryoikiMagoAtivo;
        const rAt  = ryoikiMagoAtivo;
        const rcdr = ryoikiMagoCooldown / RYOIKI_M_CD_MAX;
        const ubx = canvas.width - 74, uby = canvas.height - 148, ubs = 58;
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1);
        ctx.fillStyle = rAt ? 'rgba(20,0,40,.99)' : rRdy ? 'rgba(50,5,80,.94)' : 'rgba(10,0,20,.88)'; ctx.fillRect(ubx, uby, ubs, ubs);
        ctx.strokeStyle = rAt ? `rgba(232,121,249,${0.7 + 0.3 * pulse})` : rRdy ? '#e879f9' : '#3b0764'; ctx.lineWidth = rAt || rRdy ? 2.5 : 1.5;
        if (rAt || rRdy) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = rAt ? 28 : 14; }
        ctx.strokeRect(ubx, uby, ubs, ubs); ctx.shadowBlur = 0;
        if (!rRdy && !rAt) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(ubx, uby, ubs, ubs * rcdr); }
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = rAt ? '#f0abfc' : rRdy ? '#e879f9' : '#6b21a8'; ctx.fillText('ULTIMATE', ubx + ubs / 2, uby + 11);
        ctx.font = `bold ${20 + (rAt ? Math.sin(tick * 0.12) * 3 : 0)}px monospace`;
        ctx.fillStyle = rAt ? '#f0abfc' : rRdy ? '#e879f9' : '#4c1d95';
        if (rAt || rRdy) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = rAt ? 18 : 8; }
        ctx.fillText('∞', ubx + ubs / 2, uby + 36); ctx.shadowBlur = 0;
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = rAt ? '#fae8ff' : rRdy ? '#f5d0fe' : '#4c1d95'; ctx.fillText('[X]', ubx + ubs / 2, uby + 52);
        if (rAt) {
          ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#f0abfc'; ctx.fillText(`${Math.ceil((RYOIKI_M_DUR - ryoikiMagoTimer) / 60)}s`, ubx + ubs / 2, uby + 22);
          // Indicador de invulnerabilidade na UI
          ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#fae8ff'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 6; ctx.fillText('🛡', ubx + ubs / 2, uby + 65); ctx.shadowBlur = 0;
        }
        else if (!rRdy) {
          const mins = Math.floor(ryoikiMagoCooldown / 3600), secs = Math.ceil((ryoikiMagoCooldown % 3600) / 60);
          ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#c084fc';
          ctx.fillText(mins > 0 ? `${mins}m${secs}s` : `${Math.ceil(ryoikiMagoCooldown / 60)}s`, ubx + ubs / 2, uby + 22);
        }
      }

      // UI Guerreiro
      if (cl === 'guerreiro') {
        const pr = furacaoCooldown <= 0 && !furacaoAtivo, at = furacaoAtivo, cdr = furacaoCooldown / FUR_CD_MAX;
        const bx = canvas.width - 74, by = canvas.height - 74, bs = 58;
        ctx.fillStyle = at ? 'rgba(180,83,9,.92)' : pr ? 'rgba(146,64,14,.88)' : 'rgba(20,10,5,.85)'; ctx.fillRect(bx, by, bs, bs);
        ctx.strokeStyle = at ? '#fbbf24' : pr ? '#f59e0b' : '#78350f'; ctx.lineWidth = at || pr ? 2.5 : 1.5;
        if (at || pr) { ctx.shadowColor = at ? '#fde68a' : '#f59e0b'; ctx.shadowBlur = at ? 18 : 10; }
        ctx.strokeRect(bx, by, bs, bs); ctx.shadowBlur = 0;
        if (!pr && !at) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx, by, bs, bs * cdr); }
        ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = at ? '#fde68a' : pr ? '#fbbf24' : '#92400e'; ctx.fillText('🌪', bx + bs / 2, by + 34);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = at ? '#fef9c3' : pr ? '#fef3c7' : '#78350f'; ctx.fillText('[Z]', bx + bs / 2, by + 52);
        if (at) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fde68a'; ctx.fillText(`${Math.ceil((FUR_DUR - furacaoTimer) / 60)}s`, bx + bs / 2, by + 20); }
        else if (!pr) { ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#fcd34d'; ctx.fillText(`${Math.ceil(furacaoCooldown / 60)}s`, bx + bs / 2, by + 20); }

        // Indicador de projétil guiado (ESPAÇO)
        const gprRdy = guerrProjCooldown <= 0;
        const pbx = canvas.width - 74, pby = canvas.height - 224, pbs = 58;
        ctx.fillStyle = gprRdy ? 'rgba(127,29,29,.88)' : 'rgba(20,5,5,.85)'; ctx.fillRect(pbx, pby, pbs, pbs);
        ctx.strokeStyle = gprRdy ? '#ef4444' : '#450a0a'; ctx.lineWidth = gprRdy ? 2.5 : 1.5;
        if (gprRdy) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10; }
        ctx.strokeRect(pbx, pby, pbs, pbs); ctx.shadowBlur = 0;
        if (!gprRdy) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(pbx, pby, pbs, pbs * (guerrProjCooldown / GUERR_PROJ_CD)); }
        ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = gprRdy ? '#fbbf24' : '#7f1d1d'; ctx.fillText('🔥', pbx + pbs / 2, pby + 34);
        ctx.font = 'bold 9px monospace'; ctx.fillStyle = gprRdy ? '#fef9c3' : '#78350f'; ctx.fillText('[ESPAÇO]', pbx + pbs / 2, pby + 52);

        const uPr = ryoikiCooldown <= 0 && !ryoikiAtivo && !ryoikiLimpouOnda, uAt = ryoikiAtivo || ryoikiLimpouOnda, ucdr = ryoikiCooldown / RYO_CD_MAX;
        const ubx = canvas.width - 74, uby = canvas.height - 148, ubs = 58, pul = .5 + .5 * Math.sin(tick * .08);
        ctx.fillStyle = uAt ? 'rgba(180,10,10,.97)' : uPr ? 'rgba(120,10,10,.92)' : 'rgba(20,5,5,.88)'; ctx.fillRect(ubx, uby, ubs, ubs);
        ctx.strokeStyle = uAt ? `rgba(255,${80 + Math.floor(pul * 60)},80,1)` : uPr ? '#dc2626' : '#7f1d1d'; ctx.lineWidth = uAt || uPr ? 2.5 : 1.5;
        if (uAt || uPr) { ctx.shadowColor = '#dc2626'; ctx.shadowBlur = uAt ? 22 : 12; }
        ctx.strokeRect(ubx, uby, ubs, ubs); ctx.shadowBlur = 0;
        if (!uPr && !uAt) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(ubx, uby, ubs, ubs * ucdr); }
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = uAt ? '#ff8080' : uPr ? '#fca5a5' : '#7f1d1d'; ctx.fillText('ULTIMATE', ubx + ubs / 2, uby + 11);
        ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = uAt ? '#ff4444' : uPr ? '#ef4444' : '#7f1d1d'; ctx.fillText('💢', ubx + ubs / 2, uby + 34);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = uAt ? '#fca5a5' : uPr ? '#fee2e2' : '#7f1d1d'; ctx.fillText('[X]', ubx + ubs / 2, uby + 52);
        if (uAt && ryoikiAtivo) { ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#ff8080'; ctx.fillText(`${Math.ceil((RYO_DUR - ryoikiTimer) / 60)}s`, ubx + ubs / 2, uby + 22); }
        else if (uAt && ryoikiLimpouOnda) { ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#fca5a5'; ctx.fillText('próx...', ubx + ubs / 2, uby + 22); }
        else if (!uPr) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fca5a5'; ctx.fillText(`${Math.ceil(ryoikiCooldown / 60)}s`, ubx + ubs / 2, uby + 22); }
      }

      // UI Sombrio
      if (cl === 'sombrio') {
        // Z: ARISE
        const ptu = ressurrCooldown <= 0 && killsAcum >= KILLS_NEEDED && !ariseAtivo, cdr = ressurrCooldown / RESSURR_CD_MAX;
        const bx = canvas.width - 74, by = canvas.height - 74, bs = 58;
        ctx.fillStyle = ariseAtivo ? 'rgba(100,20,160,.97)' : ptu ? 'rgba(88,28,135,.92)' : 'rgba(15,5,25,.88)'; ctx.fillRect(bx, by, bs, bs);
        ctx.strokeStyle = ariseAtivo ? '#e879f9' : ptu ? '#e879f9' : '#4c1d95'; ctx.lineWidth = ptu || ariseAtivo ? 2.5 : 1.5;
        if (ptu || ariseAtivo) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = ariseAtivo ? 22 : 14; }
        ctx.strokeRect(bx, by, bs, bs); ctx.shadowBlur = 0;
        if (!ptu && ressurrCooldown > 0 && !ariseAtivo) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx, by, bs, bs * cdr); }
        ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = ariseAtivo ? '#f0abfc' : ptu ? '#e879f9' : '#7c3aed'; ctx.fillText('💀', bx + bs / 2, by + 34);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = ariseAtivo ? '#fae8ff' : ptu ? '#fae8ff' : '#581c87';
        ctx.fillText(ariseAtivo ? 'ARISE!' : '[Z]', bx + bs / 2, by + 52);
        if (ressurrCooldown > 0 && !ariseAtivo) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d8b4fe'; ctx.fillText(`${Math.ceil(ressurrCooldown / 60)}s`, bx + bs / 2, by + 18); }
        const slSz = 10, slGp = 3, totW = KILLS_NEEDED * (slSz + slGp) - slGp, slSX = bx + (bs - totW) / 2, slSY = by - 18;
        for (let k = 0; k < KILLS_NEEDED; k++) { const f = k < killsAcum; ctx.fillStyle = f ? '#a855f7' : 'rgba(100,50,150,.3)'; if (f) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 5; } ctx.fillRect(slSX + k * (slSz + slGp), slSY, slSz, slSz); ctx.shadowBlur = 0; }
        ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#c084fc'; ctx.fillText(`${killsAcum}/${KILLS_NEEDED} KILLS`, bx + bs / 2, slSY - 3);
        if (aliados.length > 0) { ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#e879f9'; ctx.fillText(`👁 ${aliados.length} ALIADO${aliados.length > 1 ? 'S' : ''}`, bx + bs / 2, by - 32); }

        // X: INVOCAÇÃO IGRIS + BERU
        const invRdy = invocCooldown <= 0 && !invocAtivo && !ariseAtivo;
        const invAt  = invocAtivo;
        const icdr   = invocCooldown / INVOC_CD_MAX;
        const ubx = canvas.width - 74, uby = canvas.height - 148, ubs = 58;
        const invPulse = 0.5 + 0.5 * Math.sin(tick * 0.1);
        ctx.fillStyle = invAt ? 'rgba(25,0,50,.99)' : invRdy ? 'rgba(60,0,100,.94)' : 'rgba(10,0,20,.88)'; ctx.fillRect(ubx, uby, ubs, ubs);
        ctx.strokeStyle = invAt ? `rgba(232,121,249,${0.7 + 0.3 * invPulse})` : invRdy ? '#a855f7' : '#3b0764'; ctx.lineWidth = invAt || invRdy ? 2.5 : 1.5;
        if (invAt || invRdy) { ctx.shadowColor = invAt ? '#e879f9' : '#a855f7'; ctx.shadowBlur = invAt ? 28 : 14; }
        ctx.strokeRect(ubx, uby, ubs, ubs); ctx.shadowBlur = 0;
        if (!invRdy && !invAt) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(ubx, uby, ubs, ubs * icdr); }
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = invAt ? '#f0abfc' : invRdy ? '#c084fc' : '#6b21a8'; ctx.fillText('ULTIMATE', ubx + ubs / 2, uby + 11);
        ctx.font = `bold ${invAt ? 13 + Math.sin(tick * 0.1) * 2 : 12}px monospace`;
        ctx.fillStyle = invAt ? '#f0abfc' : invRdy ? '#e879f9' : '#4c1d95';
        if (invAt || invRdy) { ctx.shadowColor = invAt ? '#e879f9' : '#a855f7'; ctx.shadowBlur = invAt ? 18 : 8; }
        ctx.fillText('⚔🐜', ubx + ubs / 2, uby + 35); ctx.shadowBlur = 0;
        ctx.font = 'bold 8px monospace'; ctx.fillStyle = invAt ? '#fae8ff' : invRdy ? '#f5d0fe' : '#4c1d95'; ctx.fillText('IGRIS+BERU', ubx + ubs / 2, uby + 48);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = invAt ? '#fae8ff' : invRdy ? '#f5d0fe' : '#4c1d95'; ctx.fillText('[X]', ubx + ubs / 2, uby + 58);
        if (invAt) {
          ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#f0abfc'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8;
          ctx.fillText(`${Math.ceil((INVOC_DUR - invocTimer) / 60)}s`, ubx + ubs / 2, uby + 22); ctx.shadowBlur = 0;
          ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#fae8ff'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 6; ctx.fillText('🛡', ubx + ubs / 2, uby + 65); ctx.shadowBlur = 0;
        } else if (!invRdy) {
          const mins2 = Math.floor(invocCooldown / 3600), secs2 = Math.ceil((invocCooldown % 3600) / 60);
          ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#c084fc';
          ctx.fillText(mins2 > 0 ? `${mins2}m${secs2}s` : `${Math.ceil(invocCooldown / 60)}s`, ubx + ubs / 2, uby + 22);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      canvas.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(animId);
    };
  }, [status, imgPlayer, imgArmaGuerr, imgArmaMago, imgCenario, imgGuerreiro, imgMago, imgSombrio]);

  return (
    <main className="relative min-h-screen bg-black flex flex-col items-center justify-center font-serif text-white overflow-hidden">
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-80 pointer-events-none"
        style={{ backgroundImage: "url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center gap-3">
          <span>GLORY DARK | {status.nome} | {status.classe.toUpperCase()}</span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${online ? 'bg-green-900/60 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {online ? `🌐 ${qtJog}P` : 'solo'}
          </span>
        </div>
        <canvas ref={canvasRef} width={900} height={600}
          className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">
          WASD mover · ESPAÇO atacar ·{' '}
          {status.classe === 'mago'      && 'Z = Hollow Purple · X = Ryōiki Tenkai (240s) [invulnerável] · '}
          {status.classe === 'guerreiro' && 'ESPAÇO = 🔥 Projétil Guiado · Z = Furacão · X = Ryōiki Tenkai · '}
          {status.classe === 'sombrio'   && 'Z = ARISE (5 kills) · X = Invoca Igris+Beru [invulnerável] · '}
          Sobreviva até a onda 20.
        </p>
      </div>
    </main>
  );
}
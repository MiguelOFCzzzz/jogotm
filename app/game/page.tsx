'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocketUrl } from '@/app/lib/socket-url';
import { io, Socket } from 'socket.io-client';
import {
  type TipoInimigo, type Projetil, type AtaqueMelee, type Monstro,
  type ProjetilInimigo, type RaioBoss, type SombraGuardada, type SlimeAliado,
  type MonstroMorto, type SlashDomain, type ExplosaoArea, type CorteSomb,
  type JogadorRemoto, type Pocao,
  SLIME_PALETAS, PALETA_ARQUEIRO, PALETA_TANQUE, PALETA_VELOC, PALETA_MAGO_INI,
  iconeTipo,
  desenharJogadorRemoto, desenharSlime, desenharFinalBoss,
  desenharRimuruBoss, desenharRimuruCutscene,
  RIMURU_HP_FASE1, RIMURU_HP_FASE2, RIMURU_CUTSCENE_DUR, RIMURU_IMG_URL,
  desenharProjetilInimigo, desenharAliado, desenharCorteSombrio,
  desenharProjetilSombrio, desenharProjetilGuerreiro, desenharExplosaoArea,
  desenharRaio, desenharFuracao, desenharRyoikiTenkai, desenharTransicaoOnda,
  desenharAriseCutscene, desenharInvocacaoUltimate,
  desenharShadowSlash, desenharEbonySwirl, desenharIAmAtomic,
  desenharProjetilIlusao, desenharIlusaoImpacto, desenharKyokaSuigetsu, desenharHogyokuFusion,
  desenharCenarioEpico, desenharMinimapa, desenharMarcacaoJogador, desenharPocao,
  SHADOW_SLASH_DUR, SHADOW_SLASH_RAIO, EBONY_DUR, EBONY_AREA,
  ATOMIC_DUR, ATOMIC_CD_MAX,
  ILUSAO_DUR, KYOKA_DUR, KYOKA_CD_MAX, HOGYOKU_DUR, HOGYOKU_CD_MAX,
  type EbonySwirl, type IlusaoEfeito,
  CORTE_ALC, CORTE_LARG, SOMB_AREA, RAIO_AREA,
  FUR_ALCANCE, FUR_DUR, RYO_DUR, RYO_SLASH_INT,
  RYOIKI_DELAY, ARISE_DUR, INVOC_DUR, INVOC_KILL_T,
} from './helpers-draw';
import { precarregarAudios, tocarUltimate, pararAudio } from './audio-manager';

const WORLD_WIDTH = 3000, WORLD_HEIGHT = 2000;

// ── Onda 10 é o BOSS FINAL (Rimuru) ──
const TOTAL_ONDAS = 10;

// ── Fator de dano de ULT na onda do Rimuru (50% do normal) ──
const ULT_DANO_RIMURU_FATOR = 0.5;

function useImagem(src: string | null, semCors = false) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const i = new Image();
    if (!semCors) i.crossOrigin = 'anonymous';
    i.src = src;
    i.onload = () => setImg(i);
  }, [src]);
  return img;
}

export default function Jogo2D() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mouseRef   = useRef({ x: 450, y: 300 });
  const socketRef  = useRef<Socket | null>(null);
  const remotosRef = useRef<Record<string, JogadorRemoto>>({});
  const souHostRef = useRef(false);
  const [online, setOnline] = useState(false);
  const [qtJog, setQtJog]   = useState(1);

  const [status] = useState(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_classe') || 'guerreiro').toLowerCase() : 'guerreiro';
    const classe = (raw === 'mago' || raw === 'sombrio' || raw === 'shadow' || raw === 'aizen') ? raw : 'guerreiro';
    return { nome: typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_char_nome') || 'Herói') : 'Herói', classe, str:10, agi:10, int:10, vit:10, hpMax:200 };
  });

  useEffect(() => {
    precarregarAudios();
  }, []);

  const LINKS: Record<string,string> = {
    guerreiro: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/46a9374d-e7fd-4bca-9214-7e3976a050d0/dgfzl3p-11e8a47e-8122-4792-80d4-27f9b491ce2f.png/v1/fill/w_800,h_999/sukuna_png_by_vortexkun_dgfzl3p-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MTM1MCIsInBhdGgiOiIvZi80NmE5Mzc0ZC1lN2ZkLTRiY2EtOTIxNC03ZTM5NzZhMDUwZDAvZGdmemwzcC0xMWU4YTQ3ZS04MTIyLTQ3OTItODBkNC0yN2Y5YjQ5MWNlMmYucG5nIiwid2lkdGgiOiI8PTEwODAifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.vLzUOZUOZgaduP0pKUxjxW_nsjgXnKVAx5JjHjt5P3M',
    mago:      'https://upload.wikimedia.org/wikipedia/pt/0/02/Satoru_Gojo.png?_=20220310211630',
    sombrio:   'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6c3d567d-af2b-469e-b10c-d5b135964ab2/dg06u31-77d706fb-6721-4a63-9fa3-a41bd55079d2.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82YzNkNTY3ZC1hZjJiLTQ2OWUtYjEwYy1kNWIxMzU5NjRhYjIvZGcwNnUzMS03N2Q3MDZmYi02NzIxLTRhNjMtOWZhMy1hNDFiZDU1MDc5ZDIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5GyTWvKNS9dRXrc3pTv-MOq1Lbhnj8sk3CcXhxPUx88',
    shadow: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/fa5c2c66-ee27-4c1c-8c30-64a06e7fdcdb/dgnyz5t-947cf467-4dc6-4ebd-a832-9576d3b6ecb3.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi9mYTVjMmM2Ni1lZTI3LTRjMWMtOGMzMC02NGEwNmU3ZmRjZGIvZGdueXo1dC05NDdjZjQ2Ny00ZGM2LTRlYmQtYTgzMi05NTc2ZDNiNmVjYjMucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.gJpYR4qgXR_Rt_MJsdjA-y8gEYXeuVlmhsTMo2CfTSI',
    aizen:  'https://i.redd.it/new-arts-included-in-the-official-site-nel-ryuuken-aizen-v0-zprai0ll000a1.png?width=1050&format=png&auto=webp&s=216deeafb4a03fff1043c5d7a2e66f622486a83b',
  };

  const imgRimuru    = useImagem(RIMURU_IMG_URL, true); // sem crossOrigin — pnganime bloqueia CORS
  const imgPlayer    = useImagem(LINKS[status.classe] ?? null);
  const imgArmaGuerr = useImagem('https://png.pngtree.com/png-clipart/20211018/ourmid/pngtree-fire-burning-realistic-red-flame-png-image_3977689.png');
  const imgArmaMago  = useImagem('https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png');
  const imgGuerreiro = useImagem(LINKS.guerreiro);
  const imgMago      = useImagem(LINKS.mago);
  const imgSombrio   = useImagem(LINKS.sombrio);
  const imgShadow    = useImagem(LINKS.shadow ?? null);
  const imgAizen     = useImagem(LINKS.aizen  ?? null);

  // ── Socket.io ──
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const s = io(`http://${host}:3001`, { transports: ['websocket'] });
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
    s.on('voce_e_host', (val: boolean) => { souHostRef.current = val; });
    s.on('novo_host', (id: string) => { if (s.id === id) souHostRef.current = true; });
    return () => { s.disconnect(); };
  }, [status.nome, status.classe]);

  // ── Game loop ──
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

    // ── Estado do Rimuru ──
    let rimuruCutsceneAtiva = false;
    let rimuruCutsceneTimer = 0;
    // rimuruFase é controlado diretamente no objeto monstro (m.rimuruFase)
    // Quando a onda 10 começa, disparamos a cutscene antes de liberar o boss

    const RAIO_CD_MAX=600, RAIO_DANO=120+status.int*3, RAIO_DUR=40;
    let raioCooldown=0, raioAtivo=false, raioTimer=0, raioAlvo={x:0,y:0};

    const FUR_CD_MAX=1800, FUR_DANO_TICK=4, FUR_VEL=2.0;
    let furacaoCooldown=0, furacaoAtivo=false, furacaoTimer=0, furacaoAngulo=0;

    const RYO_CD_MAX=14400;
    let ryoikiCooldown=0, ryoikiAtivo=false, ryoikiTimer=0;
    let slashesDomain: SlashDomain[] = [];

    const RAIO_BOSS_CD=180, RAIO_BOSS_DANO=50, RAIO_BOSS_VEL=7, RAIO_BOSS_VIDA=1000;
    let raioBossArr: RaioBoss[] = [];

    const RESSURR_CD_MAX=1800, KILLS_NEEDED=5, MAX_SOMBRAS=8, MAX_ALIADOS=5;
    const ALIADO_DANO=12, ALIADO_ALCANCE=55, ALIADO_CD=40;
    const ALIADO_PROJ_DANO=18, ALIADO_PROJ_RANGE=350, ALIADO_PROJ_CD=80;
    let ressurrCooldown=0, killsAcum=0;
    let sombrasFila: SombraGuardada[] = [];
    let aliados: SlimeAliado[] = [];
    let mortos: MonstroMorto[] = [];
    let projetiisAliados: ProjetilInimigo[] = [];
    let corte: CorteSomb = { ativo:false, timer:0, duracao:14, anguloBase:0 };
    const CORTE_DANO=28+status.agi*1.5;
    let explosoesArea: ExplosaoArea[] = [];
    let syncMovTick=0;
    let syncMonstrosTick=0;

    const HOLLOW_CD_MAX=900, HOLLOW_DANO=88;
    const RYOIKI_M_CD_MAX=14400, RYOIKI_M_DUR=420, RYOIKI_M_KILL_T=180;
    let hollowCooldown=0, hollowFase: 'idle'|'carregando'|'disparando' = 'idle', hollowTimer=0;
    let hollowEsferaAzul = { x:0, y:0, alpha:0 };
    let hollowEsferaVerm = { x:0, y:0, alpha:0 };
    let ryoikiMagoAtivo=false, ryoikiMagoTimer=0, ryoikiMagoCooldown=0, ryoikiMagoKilled=false;
    const infoTexts = ['∞','∅','Ω','π','∂','Σ','∇','∆','λ','ξ','ψ','φ'];
    let floatingInfos: {x:number;y:number;vy:number;alpha:number;txt:string;color:string}[] = [];

    const GUERR_PROJ_CD=20, GUERR_PROJ_VEL=14, GUERR_PROJ_DAN=50+status.str*3;
    let guerrProjCooldown=0;

    const RED_VEL=16, RED_DANO=38+Math.floor(status.int*1.8), RED_CD=25, RED_RAIO_EXPLO=60;
    let redCooldown=0;
    let redExplosoes: {x:number;y:number;timer:number;maxTimer:number}[] = [];

    let ariseAtivo=false, ariseTimer=0;
    let ariseAliados: {x:number;y:number;nome:string;alpha:number;scale:number;vy:number}[] = [];
    let ariseParticulas: {x:number;y:number;vx:number;vy:number;vida:number;r:number;cor:string}[] = [];

    const INVOC_CD_MAX=18000;
    let invocCooldown=0, invocAtivo=false, invocTimer=0, invocKilled=false;
    let igrisPos = { x:0, y:0, alpha:0, scale:0 };
    let beruPos  = { x:0, y:0, alpha:0, scale:0 };
    let invocParticulas: {x:number;y:number;vx:number;vy:number;vida:number;r:number;cor:string}[] = [];

    let shadowSlashAtivo = false, shadowSlashTimer = 0, shadowSlashAngulo = 0;
    let ebonyAtivo = false, ebonyTimer = 0, ebonyCooldown = 0;
    const EBONY_CD_MAX = 900;
    let atomicAtivo = false, atomicTimer = 0, atomicCooldown = 0;
    let atomicParticulas: { x:number; y:number; vx:number; vy:number; vida:number; r:number }[] = [];
    const SHADOW_PROJ_VEL = 14, SHADOW_PROJ_DANO = 44 + status.agi * 3, SHADOW_PROJ_CD = 18;
    let shadowProjCooldown = 0;

    let ilusaoParticulas: IlusaoEfeito[] = [];
    const ILUSAO_VEL = 15, ILUSAO_DANO = 38 + status.int * 1.5, ILUSAO_CD = 22;
    let ilusaoCooldown = 0;
    let kyokaAtivo = false, kyokaTimer = 0, kyokaCooldown = 0;
    let hogyokuAtivo = false, hogyokuTimer = 0, hogyokuCooldown = 0, hogyokuKilled = false;
    let hogyokuParticulas: { x:number; y:number; vx:number; vy:number; vida:number; r:number; cor:string }[] = [];

    let pocoes: Pocao[] = [];
    let pocaoIdCounter = 0;
    const POCAO_CURA_BASE = 40;
    const POCAO_RAIO_COLETA = 50;

    function gerarPocoesDaOnda(onda: number) {
      const qt = Math.max(1, Math.floor(1 + onda * 0.5));
      for (let i = 0; i < qt; i++) {
        pocoes.push({
          x: 100 + Math.random() * (WORLD_WIDTH  - 200),
          y: 100 + Math.random() * (WORLD_HEIGHT - 200),
          id: pocaoIdCounter++,
          cura: POCAO_CURA_BASE + Math.floor(onda * 8),
          pulso: Math.random() * Math.PI * 2,
        });
      }
    }

    // ── Retorna fator de dano de ult (0.5 na onda do Rimuru) ──
    function fatorDanoUlt(): number {
      return ondaAtual === TOTAL_ONDAS ? ULT_DANO_RIMURU_FATOR : 1.0;
    }

    function criarMonstro(id:number, tipo:TipoInimigo, onda:number, x?:number, y?:number): Monstro {
      const rx = x ?? Math.random()*WORLD_WIDTH;
      const ry = y ?? Math.random()*WORLD_HEIGHT;
      const op = SLIME_PALETAS[Math.floor(Math.random()*SLIME_PALETAS.length)];
      const defs: Record<string, { hpM:number; sizeM:number; pal:typeof op; cdMax:number }> = {
        normal:    { hpM:1.0, sizeM:1.0, pal:op,              cdMax:999 },
        arqueiro:  { hpM:0.6, sizeM:0.8, pal:PALETA_ARQUEIRO, cdMax:120 },
        // ── Tanque com HP e tamanho reduzidos (~50% do original) ──
        tanque:    { hpM:1.4, sizeM:1.1, pal:PALETA_TANQUE,   cdMax:999 },
        velocista: { hpM:0.5, sizeM:0.7, pal:PALETA_VELOC,    cdMax:999 },
        mago_ini:  { hpM:0.8, sizeM:0.9, pal:PALETA_MAGO_INI, cdMax:160 },
      };
      const d = defs[tipo];
      const hp = Math.floor((180 + onda * 180) * d.hpM);
      const size = Math.floor((48 + onda * 5) * d.sizeM);
      return {
        id, x:rx, y:ry, hp, maxHp:hp, size,
        cor:d.pal.base, corVariante:d.pal.variante, corBrilho:d.pal.brilho, corOlho:d.pal.olho,
        tipo, isBoss:false, isFinalBoss:false,
        breathe:Math.random()*Math.PI*2, breatheDir:1, breatheSpeed:.025+Math.random()*.02,
        hitTimer:0, bubbletimer:Math.floor(Math.random()*80),
        ataqueCd:Math.floor(Math.random()*d.cdMax), ataqueCdMax:d.cdMax,
      };
    }

    // ── Cria o boss Rimuru com 2 fases ──
    function criarRimuru(): Monstro {
      return {
        id: 9999,
        x: WORLD_WIDTH / 2 - 60,
        y: WORLD_HEIGHT / 2 - 60,
        hp: RIMURU_HP_FASE1,
        maxHp: RIMURU_HP_FASE1,
        size: 120,
        cor: '#0a0020',
        corVariante: '#04000f',
        corBrilho: '#a855f7',
        corOlho: '#e9d5ff',
        tipo: 'normal',
        isBoss: true,
        isFinalBoss: false,
        isRimuru: true,
        rimuruFase: 1,
        breathe: 0, breatheDir: 1, breatheSpeed: 0.012,
        hitTimer: 0, bubbletimer: 999,
        ataqueCd: 60, ataqueCdMax: 60,
        raioCooldown: 60,
        megiddoCd: 0,
      };
    }

    function gerarOnda(onda: number): Monstro[] {
      gerarPocoesDaOnda(onda);

      // ── ONDA 10: Boss Rimuru — cutscene primeiro, monstros vazio até ela acabar ──
      if (onda === TOTAL_ONDAS) {
        rimuruCutsceneAtiva = true;
        rimuruCutsceneTimer = 0;
        return []; // Rimuru é adicionado após a cutscene
      }

      // ── Bosses intermediários ──
      if (onda === 5) return [{
        id:999, x:Math.random()*(WORLD_WIDTH-300)+150, y:Math.random()*(WORLD_HEIGHT-300)+150,
        hp:2800, maxHp:2800, size:210, cor:'#7f1d1d', corVariante:'#1c0404', corBrilho:'#ef4444', corOlho:'#fecaca',
        tipo:'normal', isBoss:true, isFinalBoss:false,
        breathe:0, breatheDir:1, breatheSpeed:.018, hitTimer:0, bubbletimer:999, ataqueCd:90, ataqueCdMax:90
      }];

      // ── Ondas normais (1-4, 6-9) ──
      const qt = 4 + onda * 4;
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

    // ── Eventos de sincronização de monstros ──
    const socket = socketRef.current;
    if (socket) {
      socket.on('monstros_atualizados', (data: { monstros: Monstro[]; ondaAtual: number; raioBossArr: RaioBoss[] }) => {
        if (!souHostRef.current) { monstros = data.monstros; ondaAtual = data.ondaAtual; raioBossArr = data.raioBossArr || []; }
      });
      socket.on('aplicar_dano', (data: { monstroId: number; dano: number }) => {
        if (!souHostRef.current) return;
        const m = monstros.find(m => m.id === data.monstroId);
        if (m) { m.hp -= data.dano; m.hitTimer = 6; }
      });
      socket.on('onda_mudou', (data: { ondaAtual: number }) => {
        if (!souHostRef.current) { ondaAtual = data.ondaAtual; raioBossArr = []; projetilInimigos = []; }
      });
    }

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
    const onMouse   = (e: MouseEvent) => { const r=canvas.getBoundingClientRect(); mouseRef.current={x:e.clientX-r.left,y:e.clientY-r.top}; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('mousemove', onMouse);

    const onMouseDown = (e: MouseEvent) => {
      if(cl !== 'mago' && cl !== 'aizen') return;
      if(e.button !== 0) return;
      if(cl === 'mago' && redCooldown > 0) return;
      if(cl === 'aizen' && ilusaoCooldown > 0) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left + camera.x;
      const my = e.clientY - r.top  + camera.y;
      redClickPendente = { x: mx, y: my };
    };
    canvas.addEventListener('mousedown', onMouseDown);
    let redClickPendente: { x:number; y:number } | null = null;

    let tick=0, animId=0;

    function registrarMorte(m: Monstro) {
      if(m.isBoss) return;
      contadorMorte++;
      mortos.unshift({ hp:m.maxHp, maxHp:m.maxHp, size:m.size, x:m.x, y:m.y, tipo:m.tipo });
      if(mortos.length>MAX_ALIADOS) mortos.pop();
      if(killsAcum<KILLS_NEEDED) killsAcum++;
      if(sombrasFila.length<MAX_SOMBRAS) sombrasFila.push({ tipo:m.tipo, size:m.size, maxHp:m.maxHp, ordemMorte:contadorMorte });
    }

    function causarDano(m: Monstro, dano: number) {
      if (souHostRef.current) {
        m.hp -= dano;
        m.hitTimer = 8;
      } else {
        socketRef.current?.emit('dano_monstro', { monstroId: m.id, dano });
      }
    }

    // ── causarDanoRimuru: aplica fator especial se for o Rimuru e verifica transição de fase ──
    function causarDanoRimuru(m: Monstro, dano: number, isUlt: boolean = false) {
      const danofinal = isUlt ? dano * ULT_DANO_RIMURU_FATOR : dano;

      if (souHostRef.current) {
        m.hp -= danofinal;
        m.hitTimer = 8;

        // ── Transição para fase 2 ──
        if (m.rimuruFase === 1 && m.hp <= 0) {
          m.hp = RIMURU_HP_FASE2;
          m.maxHp = RIMURU_HP_FASE2;
          m.rimuruFase = 2;
          // Fase 2: mais agressivo
          m.ataqueCdMax = 40;
          m.ataqueCd = 40;
          if (m.raioCooldown !== undefined) m.raioCooldown = 50;
        }
      } else {
        socketRef.current?.emit('dano_monstro', { monstroId: m.id, dano: danofinal });
      }
    }

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

      // ── Cutscene do Rimuru ──
      if (rimuruCutsceneAtiva) {
        rimuruCutsceneTimer++;

        // Renderiza cenário + cutscene por cima
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        desenharCenarioEpico(ctx, WORLD_WIDTH, WORLD_HEIGHT, tick);
        ctx.restore();

        desenharRimuruCutscene(ctx, rimuruCutsceneTimer, tick, canvas.width, canvas.height, imgRimuru);

        if (rimuruCutsceneTimer >= RIMURU_CUTSCENE_DUR) {
          rimuruCutsceneAtiva = false;
          // Adiciona o Rimuru ao campo após a cutscene
          monstros = [criarRimuru()];
        }

        animId = requestAnimationFrame(render);
        return;
      }

      if(ryoikiLimpouOnda){
        ryoikiDelayTimer++;
        desenharTransicaoOnda(ctx, ryoikiDelayTimer, ondaAtual, canvas.width, canvas.height);
        if(ryoikiDelayTimer>=RYOIKI_DELAY){
          ryoikiLimpouOnda=false; ryoikiDelayTimer=0;
          if(ondaAtual<TOTAL_ONDAS){
            ondaAtual++; monstros=gerarOnda(ondaAtual); raioBossArr.length=0; projetilInimigos=[];
            if(souHostRef.current) socketRef.current?.emit('nova_onda', { ondaAtual });
          } else estadoJogo='vitoria';
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

      if(souHostRef.current){
        if(++syncMonstrosTick>=6){
          syncMonstrosTick=0;
          socketRef.current?.emit('sync_monstros',{ monstros, ondaAtual, raioBossArr });
        }
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
        } else if(cl==='mago'||cl==='shadow'){
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

      if(cl==='mago' && redClickPendente && redCooldown<=0){
        const mx=redClickPendente.x, my=redClickPendente.y; redClickPendente=null;
        const ang=Math.atan2(my-(player.y+40),mx-(player.x+40)); player.direcaoRad=ang;
        projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*RED_VEL,vy:Math.sin(ang)*RED_VEL,tipo:'red',angulo:ang,dano:RED_DANO});
        redCooldown=RED_CD;
      } else if(cl==='mago' && redClickPendente && redCooldown>0){ redClickPendente=null; }
      redExplosoes=redExplosoes.filter(ex=>{ ex.timer++; return ex.timer<ex.maxTimer; });

      // ── Habilidades Mago ──
      if(cl==='mago'){
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
            projectiles.push({x:px,y:py,vx:Math.cos(ang)*18,vy:Math.sin(ang)*18,angulo:ang,dano:HOLLOW_DANO,tipo:'hollow_purple'} as any);
            hollowCooldown=HOLLOW_CD_MAX;
          }
        }
        if(hollowFase==='disparando') hollowFase='idle';
        if(hollowCooldown>0) hollowCooldown--;
        if(teclas['x']&&ryoikiMagoCooldown<=0&&!ryoikiMagoAtivo){
          ryoikiMagoAtivo=true; ryoikiMagoTimer=0; ryoikiMagoKilled=false; floatingInfos=[];
          tocarUltimate('mago');
          for(let fi=0;fi<120;fi++) floatingInfos.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vy:-(0.3+Math.random()*0.8),alpha:Math.random()*0.7+0.2,txt:infoTexts[Math.floor(Math.random()*infoTexts.length)],color:['#fff','#e879f9','#a78bfa','#c084fc','#f0abfc','#ddd6fe'][Math.floor(Math.random()*6)]});
        }
        if(ryoikiMagoAtivo){
          ryoikiMagoTimer++;
          // Na onda do Rimuru, a ult do mago NÃO mata instantaneamente
          if(ryoikiMagoTimer>=RYOIKI_M_KILL_T&&!ryoikiMagoKilled){
            if (ondaAtual === TOTAL_ONDAS) {
              // Aplica dano pesado mas não mata o Rimuru
              monstros.forEach(m => {
                if (m.isRimuru) causarDanoRimuru(m, m.maxHp * 0.35, true);
                else m.hp = 0;
              });
            } else {
              monstros.length=0;
            }
            ryoikiMagoKilled=true;
          }
          if(ryoikiMagoTimer>=RYOIKI_M_DUR){ryoikiMagoAtivo=false;ryoikiMagoCooldown=RYOIKI_M_CD_MAX;floatingInfos=[];pararAudio();}
        }
        if(ryoikiMagoCooldown>0) ryoikiMagoCooldown--;
      }

      // ── Habilidades Guerreiro ──
      if(cl==='guerreiro'){
        if(teclas['z']&&furacaoCooldown<=0&&!furacaoAtivo){furacaoAtivo=true;furacaoTimer=0;furacaoCooldown=FUR_CD_MAX;}
        if(furacaoAtivo){
          furacaoTimer++; furacaoAngulo+=.18;
          monstros.forEach(m=>{const ddx=(m.x+m.size/2)-(player.x+40),ddy=(m.y+m.size/2)-(player.y+40);if(Math.hypot(ddx,ddy)<FUR_ALCANCE+m.size/2){
            if(m.isRimuru) causarDanoRimuru(m,FUR_DANO_TICK,false);
            else causarDano(m,FUR_DANO_TICK);
            const d=Math.max(1,Math.hypot(ddx,ddy));m.x+=(ddx/d)*2.5;m.y+=(ddy/d)*2.5;
          }});
          if(furacaoTimer>=FUR_DUR) furacaoAtivo=false;
        }
        if(furacaoCooldown>0) furacaoCooldown--;
        if(teclas['x']&&ryoikiCooldown<=0&&!ryoikiAtivo&&!ryoikiLimpouOnda){
          ryoikiAtivo=true; ryoikiTimer=0; ryoikiCooldown=RYO_CD_MAX; slashesDomain=[];
          tocarUltimate('guerreiro');
        }
        if(ryoikiAtivo){
          ryoikiTimer++;
          // Na onda do Rimuru: dano total * fator de ult
          monstros.forEach(m=>{
            const danoPorFrame = (m.hp+m.maxHp)/RYO_DUR+5;
            if(m.isRimuru) causarDanoRimuru(m, danoPorFrame, true);
            else causarDano(m, danoPorFrame);
          });
          for(let i=monstros.length-1;i>=0;i--){if(monstros[i].hp<=0&&!monstros[i].isRimuru)monstros.splice(i,1);}
          if(ryoikiTimer>=RYO_DUR){
            // Remove tudo exceto Rimuru (que deve ter sobrevivido parcialmente)
            monstros=monstros.filter(m=>m.isRimuru && m.hp>0);
            ryoikiAtivo=false;slashesDomain=[];
            if(monstros.length===0) {ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
            pararAudio();
          }
        }
        if(ryoikiCooldown>0) ryoikiCooldown--;
      }

      // ── Habilidades Sombrio ──
      if(cl==='sombrio'){
        if(teclas['z']&&ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED&&!ariseAtivo&&!invocAtivo){
          ariseAtivo=true; ariseTimer=0;
          ariseParticulas=Array.from({length:60},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-0.5)*1.5,vy:-(1.5+Math.random()*2.5),vida:80+Math.random()*80,r:2+Math.random()*5,cor:['#7c3aed','#a855f7','#c084fc','#e879f9','#4c1d95'][Math.floor(Math.random()*5)]}));
          const pi=mortos.slice(0,MAX_ALIADOS);
          ariseAliados=pi.map((_,i)=>({x:canvas.width*0.5+(i-pi.length/2)*100,y:canvas.height*0.72,nome:`Sombra #${i+1}`,alpha:0,scale:1,vy:-2}));
        }
        if(ariseAtivo){
          ariseTimer++;
          if(ariseTimer===75&&killsAcum>=KILLS_NEEDED){
            const filaOrdenada=[...sombrasFila].sort((a,b)=>b.ordemMorte-a.ordemMorte);
            const pi=filaOrdenada.slice(0,MAX_ALIADOS);
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
        if(teclas['x']&&invocCooldown<=0&&!invocAtivo&&!ariseAtivo){
          invocAtivo=true; invocTimer=0; invocKilled=false;
          tocarUltimate('sombrio');
          invocParticulas=Array.from({length:80},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-0.5)*1.2,vy:-(1+Math.random()*3),vida:60+Math.random()*100,r:1.5+Math.random()*4,cor:['#7c3aed','#a855f7','#c084fc','#e879f9','#581c87'][Math.floor(Math.random()*5)]}));
        }
        if(invocAtivo){
          invocTimer++;
          if(invocTimer>=INVOC_KILL_T&&!invocKilled){
            if (ondaAtual === TOTAL_ONDAS) {
              monstros.forEach(m => {
                if (m.isRimuru) causarDanoRimuru(m, m.maxHp * 0.4, true);
                else { explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:40}); m.hp=0; }
              });
            } else {
              monstros.forEach(m=>{explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:40});});
              monstros.length=0;
            }
            invocKilled=true;
          }
          if(invocAtivo && invocTimer>=INVOC_DUR){
            invocAtivo=false;invocParticulas=[];invocCooldown=INVOC_CD_MAX;
            // Remove mortos não-Rimuru
            monstros=monstros.filter(m=>m.isRimuru&&m.hp>0);
            if(monstros.length===0){ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
            pararAudio();
          }
        }
        if(invocCooldown>0) invocCooldown--;
        aliados=aliados.filter(a=>{
          a.breathe+=a.breatheSpeed; if(a.cooldownAtaque>0)a.cooldownAtaque--;
          let ai2=-1, md=Infinity;
          monstros.forEach((m)=>{const d=Math.hypot((m.x+m.size/2)-(a.x+a.size/2),(m.y+m.size/2)-(a.y+a.size/2));if(d<md){md=d;ai2=monstros.indexOf(m);}});
          if(ai2>=0){
            const alv=monstros[ai2];
            const adx=(alv.x+alv.size/2)-(a.x+a.size/2), ady=(alv.y+alv.size/2)-(a.y+a.size/2), ad=Math.max(1,Math.hypot(adx,ady));
            a.anguloAtaque=Math.atan2(ady,adx);
            const moveRange=(a.tipo==='arqueiro'||a.tipo==='mago_ini')?ALIADO_PROJ_RANGE*.8:ALIADO_ALCANCE;
            if(ad>moveRange){const spd=a.tipo==='velocista'?3.2:1.8;a.x+=(adx/ad)*spd;a.y+=(ady/ad)*spd;}
            const danoBruto=ALIADO_DANO*(a.tipo==='tanque'?1.5:a.tipo==='velocista'?.7:1);
            if((a.tipo==='tanque'||a.tipo==='normal'||a.tipo==='velocista')&&ad<ALIADO_ALCANCE+alv.size/2&&a.cooldownAtaque<=0){
              if(alv.isRimuru) causarDanoRimuru(alv,danoBruto,false);
              else causarDano(alv,danoBruto);
              a.cooldownAtaque=ALIADO_CD*(a.tipo==='velocista'?.5:1);
            }
            if((a.tipo==='arqueiro'||a.tipo==='mago_ini')&&a.cooldownAtaque<=0&&ad<ALIADO_PROJ_RANGE){
              const spd2=a.tipo==='mago_ini'?7:12;
              projetiisAliados.push({x:a.x+a.size/2,y:a.y+a.size/2,vx:Math.cos(a.anguloAtaque)*spd2,vy:Math.sin(a.anguloAtaque)*spd2,vida:60,dano:ALIADO_PROJ_DANO,cor:a.tipo==='mago_ini'?'#4c1d95':'#14532d',corBrilho:a.tipo==='mago_ini'?'#e879f9':'#4ade80',homingTimer:0});
              a.cooldownAtaque=ALIADO_PROJ_CD;
            }
          }
          return a.hp>0;
        });
      }

      // ── Habilidades Shadow ──
      if(cl==='shadow'){
        if(teclas[' ']&&shadowProjCooldown<=0){
          const mwx=mouseRef.current.x+camera.x, mwy=mouseRef.current.y+camera.y;
          const ang=Math.atan2(mwy-(player.y+40),mwx-(player.x+40));
          player.direcaoRad=ang;
          shadowSlashAtivo=true; shadowSlashTimer=0; shadowSlashAngulo=ang;
          projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*SHADOW_PROJ_VEL,vy:Math.sin(ang)*SHADOW_PROJ_VEL,tipo:'shadow_slash',angulo:ang,dano:SHADOW_PROJ_DANO});
          shadowProjCooldown=SHADOW_PROJ_CD;
        }
        if(shadowSlashAtivo){shadowSlashTimer++;if(shadowSlashTimer>=SHADOW_SLASH_DUR)shadowSlashAtivo=false;}
        if(shadowProjCooldown>0) shadowProjCooldown--;
        if(teclas['z']&&ebonyCooldown<=0&&!ebonyAtivo){ebonyAtivo=true;ebonyTimer=0;ebonyCooldown=EBONY_CD_MAX;}
        if(ebonyAtivo){
          ebonyTimer++;
          monstros.forEach(m=>{const d=Math.hypot((m.x+m.size/2)-(player.x+40),(m.y+m.size/2)-(player.y+40));if(d<EBONY_AREA+m.size/2){
            if(m.isRimuru) causarDanoRimuru(m,1.2,false);
            else causarDano(m,1.2);
          }});
          if(ebonyTimer>=EBONY_DUR) ebonyAtivo=false;
        }
        if(ebonyCooldown>0) ebonyCooldown--;
        if(teclas['x']&&atomicCooldown<=0&&!atomicAtivo){
          atomicAtivo=true; atomicTimer=0;
          tocarUltimate('shadow');
          atomicParticulas=Array.from({length:80},()=>{const a=Math.random()*Math.PI*2,v=2+Math.random()*7;return{x:player.x+40,y:player.y+40,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vida:30+Math.random()*60,r:2+Math.random()*5};});
        }
        if(atomicAtivo){
          atomicTimer++;
          if(atomicTimer===80){
            if (ondaAtual === TOTAL_ONDAS) {
              monstros.forEach(m => {
                if(m.isRimuru) causarDanoRimuru(m, m.maxHp * 0.45, true);
                else { explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:50}); m.hp=0; }
              });
            } else {
              monstros.forEach(m=>explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:50}));
              monstros.length=0;
            }
          }
          if(atomicTimer>=ATOMIC_DUR){
            atomicAtivo=false;atomicCooldown=ATOMIC_CD_MAX;
            monstros=monstros.filter(m=>m.isRimuru&&m.hp>0);
            if(monstros.length===0){ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
            pararAudio();
          }
        }
        if(atomicCooldown>0) atomicCooldown--;
      }

      // ── Habilidades Aizen ──
      if(cl==='aizen'){
        if(redClickPendente&&ilusaoCooldown<=0){
          const mx2=redClickPendente.x, my2=redClickPendente.y; redClickPendente=null;
          const ang2=Math.atan2(my2-(player.y+40),mx2-(player.x+40)); player.direcaoRad=ang2;
          projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang2)*ILUSAO_VEL,vy:Math.sin(ang2)*ILUSAO_VEL,tipo:'ilusao',angulo:ang2,dano:ILUSAO_DANO});
          ilusaoCooldown=ILUSAO_CD;
        } else if(redClickPendente&&ilusaoCooldown>0) redClickPendente=null;
        if(ilusaoCooldown>0) ilusaoCooldown--;
        if(teclas['z']&&kyokaCooldown<=0&&!kyokaAtivo){kyokaAtivo=true;kyokaTimer=0;kyokaCooldown=KYOKA_CD_MAX;tocarUltimate('aizen');}
        if(kyokaAtivo){
          kyokaTimer++;
          if(kyokaTimer%20===0){monstros.forEach(m=>{const ri=Math.floor(Math.random()*monstros.length);if(monstros[ri]&&monstros[ri]!==m){
            const dano=15+status.int;
            if(monstros[ri].isRimuru) causarDanoRimuru(monstros[ri],dano*ULT_DANO_RIMURU_FATOR,true);
            else causarDano(monstros[ri],dano);
          }});}
          if(kyokaTimer>=KYOKA_DUR){kyokaAtivo=false;pararAudio();}
        }
        if(kyokaCooldown>0) kyokaCooldown--;
        ilusaoParticulas=ilusaoParticulas.filter(ef=>{desenharIlusaoImpacto(ctx,ef);return ef.timer<ef.maxTimer;});
        if(teclas['x']&&hogyokuCooldown<=0&&!hogyokuAtivo){
          hogyokuAtivo=true; hogyokuTimer=0; hogyokuKilled=false;
          tocarUltimate('aizen');
          hogyokuParticulas=Array.from({length:80},()=>{const a=Math.random()*Math.PI*2,v=1.5+Math.random()*5;return{x:canvasRef.current!.width/2,y:canvasRef.current!.height/2,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vida:40+Math.random()*80,r:1.5+Math.random()*4,cor:'#fbbf24'};});
        }
        if(hogyokuAtivo){
          hogyokuTimer++;
          if(hogyokuTimer===Math.floor(HOGYOKU_DUR*.45)&&!hogyokuKilled){
            if (ondaAtual === TOTAL_ONDAS) {
              monstros.forEach(m=>{
                if(m.isRimuru) causarDanoRimuru(m, m.maxHp * 0.4, true);
                else { explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:50}); m.hp=0; }
              });
            } else {
              monstros.forEach(m=>explosoesArea.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:50}));
              monstros.length=0;
            }
            hogyokuKilled=true;
          }
          if(hogyokuTimer>=HOGYOKU_DUR){
            hogyokuAtivo=false;hogyokuCooldown=HOGYOKU_CD_MAX;
            monstros=monstros.filter(m=>m.isRimuru&&m.hp>0);
            if(monstros.length===0){ryoikiLimpouOnda=true;ryoikiDelayTimer=0;}
            pararAudio();
          }
        }
        if(hogyokuCooldown>0) hogyokuCooldown--;
      }

      // ── Avançar onda ──
      if(monstros.length===0&&!ryoikiAtivo&&!ryoikiLimpouOnda&&!invocAtivo&&!atomicAtivo&&!hogyokuAtivo&&!rimuruCutsceneAtiva){
        if(ondaAtual<TOTAL_ONDAS){
          ondaAtual++;monstros=gerarOnda(ondaAtual);raioBossArr.length=0;projetilInimigos=[];
          if(souHostRef.current) socketRef.current?.emit('nova_onda',{ondaAtual});
        } else estadoJogo='vitoria';
      }

      // ── Câmera ──
      camera.x=Math.max(0,Math.min(player.x+40-canvas.width/2,WORLD_WIDTH-canvas.width));
      camera.y=Math.max(0,Math.min(player.y+40-canvas.height/2,WORLD_HEIGHT-canvas.height));

      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save();
      ctx.translate(-camera.x,-camera.y);

      desenharCenarioEpico(ctx, WORLD_WIDTH, WORLD_HEIGHT, tick);
      Object.values(remotosRef.current).forEach(jr => desenharJogadorRemoto(ctx, jr, {guerreiro:imgGuerreiro,mago:imgMago,sombrio:imgSombrio,aizen:imgAizen,shadow:imgShadow}, tick));

      pocoes = pocoes.filter(p => {
        p.pulso += 0.06;
        desenharPocao(ctx, p);
        if(Math.hypot((player.x+40)-p.x,(player.y+40)-p.y)<POCAO_RAIO_COLETA){
          playerHp=Math.min(status.hpMax,playerHp+p.cura);
          explosoesArea.push({x:player.x+40,y:player.y+40,timer:0,maxTimer:25});
          return false;
        }
        return true;
      });

      const estaInvulneravel=(cl==='mago'&&ryoikiMagoAtivo)||(cl==='sombrio'&&invocAtivo)||(cl==='shadow'&&atomicAtivo)||(cl==='aizen'&&(hogyokuAtivo||kyokaAtivo));
      const pcx=player.x+40, pcy=player.y+40;
      const monstrosParaRemover: number[] = [];

      monstros.forEach((m,idx)=>{
        m.breathe+=m.breatheSpeed;
        const pd=Math.hypot(pcx-m.x-m.size/2,pcy-m.y-m.size/2);
        const velScale=1+ondaAtual*0.04;

        // ── Rimuru: IA especial por fase ──
        if (m.isRimuru) {
          const fase = m.rimuruFase ?? 1;
          // Velocidade aumenta na fase 2
          const rimuruVel = (fase === 2 ? 0.008 : 0.005) * velScale;
          if(pd>80&&pd<1800){m.x+=(pcx-m.x-m.size/2)*rimuruVel;m.y+=(pcy-m.y-m.size/2)*rimuruVel;}

          // Tiro de projéteis
          if(m.ataqueCd>0) m.ataqueCd--;
          if(m.ataqueCd<=0){
            m.ataqueCd=m.ataqueCdMax;
            const numTiros = fase === 2 ? 8 : 5;
            for(let bi=0;bi<numTiros;bi++){
              const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+(bi/numTiros)*Math.PI*2*(fase===2?0.6:0.45);
              projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*(fase===2?9:7),vy:Math.sin(ang)*(fase===2?9:7),vida:120,dano:fase===2?40:28,cor:'#4c1d95',corBrilho:'#a855f7',homingTimer:0});
            }
          }

          // Megiddo (raio especial fase 2)
          if (fase === 2) {
            if(m.megiddoCd !== undefined) m.megiddoCd--;
            if((m.megiddoCd ?? 0) <= 0){
              m.megiddoCd = 200;
              // Salva de Megiddo: chuva de raios ao redor do jogador
              for(let r2=0;r2<6;r2++){
                const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+(r2/6)*Math.PI*2*.4;
                raioBossArr.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*RAIO_BOSS_VEL*1.3,vy:Math.sin(ang)*RAIO_BOSS_VEL*1.3,angulo:ang,vida:RAIO_BOSS_VIDA,homingTimer:0});
              }
            }
          }

          // Contato direto
          if(pd<m.size*0.6){
            if(!estaInvulneravel){
              playerHp-=(fase===2?3.5:2.2);
              if(playerHp<=0) estadoJogo='gameover';
            }
          }

          // Transição de fase se chegou a 0 com fase 1 ainda no objeto
          // (pode ter sido causado por dano direto fora do causarDanoRimuru)
          if(m.rimuruFase===1 && m.hp<=0){
            m.hp=RIMURU_HP_FASE2; m.maxHp=RIMURU_HP_FASE2; m.rimuruFase=2;
            m.ataqueCdMax=40; m.ataqueCd=40;
            if(m.raioCooldown!==undefined) m.raioCooldown=50;
          }

          desenharRimuruBoss(ctx, m, tick, canvas.width, canvas.height, imgRimuru);
          // ── PNG do Rimuru desenhado direto (igual ao player) ──
          if (imgRimuru) {
            ctx.save();
            ctx.shadowColor = (m.rimuruFase ?? 1) === 2 ? '#fbbf24' : '#9333ea';
            ctx.shadowBlur = 35;
            ctx.drawImage(imgRimuru, m.x, m.y, m.size, m.size);
            ctx.shadowBlur = 0;
            ctx.restore();
          }

          // Rimuru fase 2 morreu de verdade
          if(m.rimuruFase===2 && m.hp<=0) monstrosParaRemover.push(idx);
          return;
        }

        // ── Monstros normais ──
        let velBase=m.isBoss?.005:m.tipo==='tanque'?.006:m.tipo==='velocista'?.022:m.tipo==='arqueiro'?.007:.01;
        velBase*=velScale;
        const minDist=(m.tipo==='arqueiro'||m.tipo==='mago_ini')&&!m.isBoss?280:0;
        if(pd>minDist&&pd<1400){m.x+=(pcx-m.x-m.size/2)*velBase;m.y+=(pcy-m.y-m.size/2)*velBase;}
        else if(pd<minDist&&!m.isBoss){m.x-=(pcx-m.x-m.size/2)*velBase*1.5;m.y-=(pcy-m.y-m.size/2)*velBase*1.5;}
        if(pd<(m.isBoss?100:m.tipo==='tanque'?55:40)){
          if(!estaInvulneravel){
            playerHp-=(m.isBoss?1.5+ondaAtual*0.25:0.4+ondaAtual*0.18);
            if(playerHp<=0) estadoJogo='gameover';
          }
        }
        if(m.ataqueCd>0) m.ataqueCd--;
        if(m.ataqueCd<=0){
          m.ataqueCd=m.ataqueCdMax;
          if(m.tipo==='arqueiro'&&pd<450){const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2);projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*9,vy:Math.sin(ang)*9,vida:90,dano:15,cor:PALETA_ARQUEIRO.base,corBrilho:PALETA_ARQUEIRO.brilho,homingTimer:0});}
          if(m.tipo==='mago_ini'&&pd<500){for(let bi=-1;bi<=1;bi++){const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+bi*.25;projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*7,vy:Math.sin(ang)*7,vida:80,dano:18,cor:PALETA_MAGO_INI.base,corBrilho:PALETA_MAGO_INI.brilho,homingTimer:0});}}
          if(m.isBoss&&!m.isFinalBoss){for(let bi=0;bi<6;bi++){const ang=Math.atan2(pcy-m.y-m.size/2,pcx-m.x-m.size/2)+(bi/6)*Math.PI*2*.5;projetilInimigos.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*8,vy:Math.sin(ang)*8,vida:120,dano:25,cor:'#7f1d1d',corBrilho:'#ef4444',homingTimer:0});}}
        }

        desenharSlime(ctx,m,tick);

        if(melee.ativo){const d=Math.hypot(pcx-(m.x+m.size/2),pcy-(m.y+m.size/2));if(d<(m.isBoss?150:100)){causarDano(m,melee.dano/10);if(!m.isBoss){m.x+=Math.cos(player.direcaoRad)*10;m.y+=Math.sin(player.direcaoRad)*10;}}}
        if(cl==='sombrio'&&corte.ativo){const cdx=(m.x+m.size/2)-pcx,cdy=(m.y+m.size/2)-pcy,cd=Math.hypot(cdx,cdy);if(cd<CORTE_ALC+m.size/2){let diff=Math.atan2(cdy,cdx)-corte.anguloBase;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;if(Math.abs(diff)<CORTE_LARG/2){causarDano(m,CORTE_DANO*(1/corte.duracao));}}}
        if(m.hp<=0){registrarMorte(m);monstrosParaRemover.push(idx);}
      });
      for(let i=monstrosParaRemover.length-1;i>=0;i--) monstros.splice(monstrosParaRemover[i],1);

      raioBossArr=raioBossArr.filter(rb=>{
        rb.vida--;rb.homingTimer++;
        if(rb.homingTimer>=10){rb.homingTimer=0;let diff=Math.atan2(pcy-rb.y,pcx-rb.x)-rb.angulo;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;rb.angulo+=diff*.22;rb.vx=Math.cos(rb.angulo)*RAIO_BOSS_VEL;rb.vy=Math.sin(rb.angulo)*RAIO_BOSS_VEL;}
        rb.x+=rb.vx;rb.y+=rb.vy;
        if(Math.hypot(rb.x-pcx,rb.y-pcy)<28){if(!estaInvulneravel){playerHp-=RAIO_BOSS_DANO;if(playerHp<=0)estadoJogo='gameover';}return false;}
        if(rb.vida<=0||rb.x<0||rb.x>WORLD_WIDTH||rb.y<0||rb.y>WORLD_HEIGHT)return false;
        const al=Math.min(1,rb.vida/20);
        ctx.save();ctx.globalAlpha=al;ctx.strokeStyle='rgba(168,85,247,.3)';ctx.lineWidth=14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(rb.x-rb.vx*4,rb.y-rb.vy*4);ctx.lineTo(rb.x,rb.y);ctx.stroke();ctx.strokeStyle='#c084fc';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(rb.x-rb.vx*3,rb.y-rb.vy*3);ctx.lineTo(rb.x,rb.y);ctx.stroke();ctx.fillStyle='#e879f9';ctx.beginPath();ctx.arc(rb.x,rb.y,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.restore();return true;
      });

      projetilInimigos=projetilInimigos.filter(p=>{
        p.vida--;p.x+=p.vx;p.y+=p.vy;
        if(p.vida<=0||p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT)return false;
        desenharProjetilInimigo(ctx,p);
        if(Math.hypot(p.x-pcx,p.y-pcy)<32){if(!estaInvulneravel){playerHp-=p.dano;if(playerHp<=0)estadoJogo='gameover';}return false;}
        return true;
      });

      projetiisAliados=projetiisAliados.filter(p=>{
        p.vida--;p.x+=p.vx;p.y+=p.vy;
        if(p.vida<=0||p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT)return false;
        desenharProjetilInimigo(ctx,p);
        let hit=false;
        for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+10){
          if(m.isRimuru) causarDanoRimuru(m,p.dano,false);
          else causarDano(m,p.dano);
          hit=true;break;
        }}
        return !hit;
      });

      for(let i=projectiles.length-1;i>=0;i--){
        const p=projectiles[i];p.x+=p.vx;p.y+=p.vy;
        if(p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT){projectiles.splice(i,1);continue;}
        if(p.tipo==='guerreiro'){
          desenharProjetilGuerreiro(ctx,p);
          for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+16){
            if(m.isRimuru) causarDanoRimuru(m,p.dano,false);
            else causarDano(m,p.dano);
            explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:30});projectiles.splice(i,1);break;
          }}
          continue;
        }
        if(p.tipo==='sombrio'){
          if(p.dp===undefined)p.dp=0;p.dp+=Math.hypot(p.vx,p.vy);
          desenharProjetilSombrio(ctx,p);
          let explodiu=false;
          for(const m of monstros){if(explodiu)break;const d=Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2));if(d<m.size/2+16){explodiu=true;monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){const dano=p.dano*(1-(da/SOMB_AREA)*.5);if(alv.isRimuru)causarDanoRimuru(alv,dano,false);else causarDano(alv,dano);}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}}
          if(!explodiu&&(p.dp??0)>=SOMB_AREA*4){monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){const dano=p.dano*(1-(da/SOMB_AREA)*.5)*.6;if(alv.isRimuru)causarDanoRimuru(alv,dano,false);else causarDano(alv,dano);}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}
        } else if(p.tipo==='shadow_slash'){
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angulo);
          for(let t=1;t<=6;t++){ctx.globalAlpha=.4*(1-t/6);const sg=ctx.createRadialGradient(-t*9,0,0,-t*9,0,8);sg.addColorStop(0,'#d946ef');sg.addColorStop(1,'rgba(168,85,247,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(-t*9,0,8,0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=1;const sg2=ctx.createRadialGradient(0,0,0,0,0,14);sg2.addColorStop(0,'#fff');sg2.addColorStop(.3,'#e879f9');sg2.addColorStop(.7,'#d946ef');sg2.addColorStop(1,'rgba(168,85,247,0)');ctx.shadowColor='#d946ef';ctx.shadowBlur=22;ctx.fillStyle=sg2;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.restore();
          let hitS=false;
          for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+14){
            if(m.isRimuru)causarDanoRimuru(m,p.dano,false);else causarDano(m,p.dano);
            explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:30});hitS=true;break;
          }}
          if(hitS)projectiles.splice(i,1);
        } else if(p.tipo==='ilusao'){
          desenharProjetilIlusao(ctx,p as any);
          let hitI=false;
          for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+12){
            if(m.isRimuru)causarDanoRimuru(m,p.dano,false);else causarDano(m,p.dano);
            ilusaoParticulas.push({x:m.x+m.size/2,y:m.y+m.size/2,timer:0,maxTimer:ILUSAO_DUR});
            if(kyokaAtivo){monstros.forEach(alv=>{if(alv!==m&&Math.hypot((alv.x+alv.size/2)-(m.x+m.size/2),(alv.y+alv.size/2)-(m.y+m.size/2))<120){if(alv.isRimuru)causarDanoRimuru(alv,p.dano*.5,false);else causarDano(alv,p.dano*.5);}});}
            hitI=true;break;
          }}
          if(hitI)projectiles.splice(i,1);
        } else if((p as any).tipo==='hollow_purple'){
          ctx.save();
          for(let t=1;t<=10;t++){const tx=p.x-p.vx*t*0.65,ty=p.y-p.vy*t*0.65;const al=0.55*(1-t/10);const rs=26-t*2;if(rs<=0)continue;ctx.globalAlpha=al;const gr=ctx.createRadialGradient(tx,ty,0,tx,ty,rs);gr.addColorStop(0,'rgba(248,180,252,1)');gr.addColorStop(.4,'rgba(168,85,247,0.8)');gr.addColorStop(1,'rgba(109,40,217,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(tx,ty,rs,0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=1;const gp=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,30);gp.addColorStop(0,'#ffffff');gp.addColorStop(.15,'#f0abfc');gp.addColorStop(.5,'#a855f7');gp.addColorStop(.8,'#7c3aed');gp.addColorStop(1,'rgba(109,40,217,0)');ctx.shadowColor='#e879f9';ctx.shadowBlur=50;ctx.fillStyle=gp;ctx.beginPath();ctx.arc(p.x,p.y,30,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
          for(let sp=0;sp<6;sp++){const sa=tick*0.25+sp*(Math.PI*2/6);const sx2=p.x+Math.cos(sa)*42,sy2=p.y+Math.sin(sa)*42;const sg=ctx.createRadialGradient(sx2,sy2,0,sx2,sy2,5);sg.addColorStop(0,'rgba(255,255,255,0.9)');sg.addColorStop(1,'rgba(168,85,247,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx2,sy2,5,0,Math.PI*2);ctx.fill();}
          ctx.restore();
          for(let mi=monstros.length-1;mi>=0;mi--){const m=monstros[mi];if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+30){
            monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<200+alv.size/2){const dano=HOLLOW_DANO*(1-da/200*.5);if(alv.isRimuru)causarDanoRimuru(alv,dano*ULT_DANO_RIMURU_FATOR,true);else causarDano(alv,dano);}});
            explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:60});projectiles.splice(i,1);break;
          }}
        } else if(p.tipo==='mago'){
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angulo);if(imgArmaMago)ctx.drawImage(imgArmaMago,-20,-20,40,40);ctx.restore();
          let hit=false;for(const m of monstros){if(p.x>m.x&&p.x<m.x+m.size&&p.y>m.y&&p.y<m.y+m.size){if(m.isRimuru)causarDanoRimuru(m,p.dano/5,false);else causarDano(m,p.dano/5);hit=true;break;}}
          if(hit)projectiles.splice(i,1);
        } else if(p.tipo==='red'){
          ctx.save();
          const rp=10+Math.sin(tick*0.4)*2;
          for(let t=1;t<=8;t++){const tx=p.x-p.vx*t*0.5,ty=p.y-p.vy*t*0.5;ctx.globalAlpha=0.4*(1-t/8);const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,rp*(1-t/10));tg.addColorStop(0,'rgba(255,80,0,1)');tg.addColorStop(1,'rgba(200,0,0,0)');ctx.fillStyle=tg;ctx.beginPath();ctx.arc(tx,ty,rp*(1-t/10),0,Math.PI*2);ctx.fill();}
          ctx.globalAlpha=1;ctx.shadowColor='#ff2200';ctx.shadowBlur=30;const rg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rp);rg.addColorStop(0,'#ffffff');rg.addColorStop(0.2,'#ffaa00');rg.addColorStop(0.6,'#ff2200');rg.addColorStop(1,'rgba(180,0,0,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(p.x,p.y,rp,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.restore();
          let hitRed=false;
          for(const m of monstros){if(Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2))<m.size/2+12){
            if(m.isRimuru)causarDanoRimuru(m,p.dano,false);else causarDano(m,p.dano);
            monstros.forEach(alv=>{const dd=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(dd<RED_RAIO_EXPLO+alv.size/2){const ka=Math.atan2((alv.y+alv.size/2)-p.y,(alv.x+alv.size/2)-p.x);const force=(1-dd/RED_RAIO_EXPLO)*18;alv.x+=Math.cos(ka)*force;alv.y+=Math.sin(ka)*force;if(alv!==m){if(alv.isRimuru)causarDanoRimuru(alv,p.dano*0.3,false);else causarDano(alv,p.dano*0.3);}}});
            redExplosoes.push({x:p.x,y:p.y,timer:0,maxTimer:25});projectiles.splice(i,1);hitRed=true;break;
          }}
          if(!hitRed&&(p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT))projectiles.splice(i,1);
        }
      }

      explosoesArea=explosoesArea.filter(ex=>{desenharExplosaoArea(ctx,ex);return ex.timer<ex.maxTimer;});
      redExplosoes.forEach(ex=>{
        const prog=ex.timer/ex.maxTimer,r1=RED_RAIO_EXPLO*prog,r2=r1*0.4;
        ctx.save();ctx.globalAlpha=(1-prog)*0.7;ctx.strokeStyle='#ff4400';ctx.lineWidth=3*(1-prog)+1;ctx.shadowColor='#ff2200';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(ex.x,ex.y,r1,0,Math.PI*2);ctx.stroke();
        if(prog<0.3){ctx.globalAlpha=(0.3-prog)/0.3;const cg=ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,r2+10);cg.addColorStop(0,'rgba(255,255,255,1)');cg.addColorStop(0.5,'rgba(255,120,0,0.7)');cg.addColorStop(1,'rgba(200,0,0,0)');ctx.fillStyle=cg;ctx.beginPath();ctx.arc(ex.x,ex.y,r2+10,0,Math.PI*2);ctx.fill();}
        ctx.shadowBlur=0;ctx.restore();
      });

      if(melee.ativo){melee.duracao--;melee.anguloAtual+=Math.PI/20;ctx.save();ctx.translate(pcx,pcy);ctx.rotate(melee.anguloAtual);if(imgArmaGuerr)ctx.drawImage(imgArmaGuerr,45,-35,70,70);ctx.strokeStyle='rgba(251,191,36,.25)';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,75,melee.anguloAtual-Math.PI*.6,melee.anguloAtual);ctx.stroke();ctx.restore();if(melee.duracao<=0)melee.ativo=false;}
      if(raioAtivo){raioTimer++;desenharRaio(ctx,raioAlvo.x,raioAlvo.y,raioTimer/RAIO_DUR);if(raioTimer>=RAIO_DUR)raioAtivo=false;}
      if(furacaoAtivo&&cl==='guerreiro')desenharFuracao(ctx,player.x,player.y,furacaoAngulo,furacaoTimer,imgArmaGuerr);
      aliados.forEach(a=>desenharAliado(ctx,a,tick));
      if(cl==='sombrio'&&corte.ativo){corte.timer++;desenharCorteSombrio(ctx,player.x,player.y,corte.anguloBase,corte.timer,corte.duracao);if(corte.timer>=corte.duracao)corte.ativo=false;}
      if(cl==='shadow'){if(shadowSlashAtivo)desenharShadowSlash(ctx,player.x,player.y,shadowSlashAngulo,shadowSlashTimer,SHADOW_SLASH_DUR);if(ebonyAtivo)desenharEbonySwirl(ctx,player.x,player.y,tick,ebonyTimer);}
      if(cl==='mago'&&hollowFase==='carregando'){
        const eb=hollowEsferaAzul;ctx.save();ctx.globalAlpha=eb.alpha;ctx.shadowColor='#3b82f6';ctx.shadowBlur=35;const gbAzul=ctx.createRadialGradient(eb.x,eb.y,0,eb.x,eb.y,22);gbAzul.addColorStop(0,'#ffffff');gbAzul.addColorStop(.25,'#bfdbfe');gbAzul.addColorStop(.6,'#3b82f6');gbAzul.addColorStop(1,'rgba(37,99,235,0)');ctx.fillStyle=gbAzul;ctx.beginPath();ctx.arc(eb.x,eb.y,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle=`rgba(96,165,250,${0.7*eb.alpha})`;ctx.lineWidth=2;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(eb.x,eb.y,28+Math.sin(tick*0.5)*4,0,Math.PI*2);ctx.stroke();ctx.restore();
        const ev=hollowEsferaVerm;ctx.save();ctx.globalAlpha=ev.alpha;ctx.shadowColor='#ef4444';ctx.shadowBlur=35;const gbVerm=ctx.createRadialGradient(ev.x,ev.y,0,ev.x,ev.y,22);gbVerm.addColorStop(0,'#ffffff');gbVerm.addColorStop(.25,'#fecaca');gbVerm.addColorStop(.6,'#ef4444');gbVerm.addColorStop(1,'rgba(220,38,38,0)');ctx.fillStyle=gbVerm;ctx.beginPath();ctx.arc(ev.x,ev.y,22,0,Math.PI*2);ctx.fill();ctx.restore();
        ctx.save();ctx.globalAlpha=Math.min(eb.alpha,ev.alpha)*0.45;ctx.strokeStyle='#e879f9';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.shadowColor='#e879f9';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(eb.x,eb.y);ctx.lineTo(ev.x,ev.y);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.restore();
      }

      desenharMarcacaoJogador(ctx,player.x,player.y,player.size,'#22c55e',tick,status.nome);
      if(imgPlayer)ctx.drawImage(imgPlayer,player.x,player.y,player.size,player.size);
      else{ctx.fillStyle=player.color;ctx.fillRect(player.x,player.y,player.size,player.size);}

      if(estaInvulneravel){
        ctx.save();ctx.globalAlpha=0.35+0.25*Math.sin(tick*0.2);
        const shieldG=ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,60);shieldG.addColorStop(0,'rgba(168,85,247,0)');shieldG.addColorStop(.6,'rgba(168,85,247,0.3)');shieldG.addColorStop(1,'rgba(232,121,249,0.7)');
        ctx.fillStyle=shieldG;ctx.beginPath();ctx.arc(pcx,pcy,60,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#e879f9';ctx.lineWidth=2.5;ctx.shadowColor='#e879f9';ctx.shadowBlur=15;ctx.beginPath();ctx.arc(pcx,pcy,55+Math.sin(tick*0.15)*5,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.restore();
      }

      ctx.restore();

      // ════ CUTSCENES ════
      if(ryoikiAtivo&&cl==='guerreiro')desenharRyoikiTenkai(ctx,ryoikiTimer,tick,canvas.width,canvas.height,slashesDomain,ondaAtual);
      if(ryoikiMagoAtivo&&cl==='mago'){
        const fadeIn=Math.min(1,ryoikiMagoTimer/50),fadeOut=ryoikiMagoTimer>RYOIKI_M_DUR-60?Math.max(0,1-(ryoikiMagoTimer-(RYOIKI_M_DUR-60))/60):1,alpha=fadeIn*fadeOut;
        const cx2=canvas.width/2;
        ctx.save();ctx.globalAlpha=alpha*0.96;ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);
        for(let ring=0;ring<10;ring++){const rBase=35+ring*52,segs=80,rotDir=ring%2===0?1:-1,speed=0.003+ring*0.0008;for(let s=0;s<segs;s++){const a1=(s/segs)*Math.PI*2+tick*speed*rotDir,a2=((s+1)/segs)*Math.PI*2+tick*speed*rotDir;const wave=Math.sin(a1*4+tick*0.025)*7,r1=rBase+wave;const x1=cx2+Math.cos(a1)*r1,y1=canvas.height/2+Math.sin(a1)*r1*0.52;const x2=cx2+Math.cos(a2)*(rBase+Math.sin(a2*4+tick*0.025)*7),y2=canvas.height/2+Math.sin(a2)*(rBase+Math.sin(a2*4+tick*0.025)*7)*0.52;const hue=265+ring*10+Math.sin(tick*0.025)*25,lum=50+ring*3;const opa=(0.06+0.08*Math.sin(tick*0.04+ring))*alpha;ctx.strokeStyle=`hsla(${hue},75%,${lum}%,${opa})`;ctx.lineWidth=ring<3?2:1.5;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}}
        floatingInfos.forEach(fi=>{fi.y+=fi.vy;fi.alpha-=0.0025;if(fi.y<-20||fi.alpha<=0){fi.y=canvas.height+10;fi.x=Math.random()*canvas.width;fi.alpha=0.35+Math.random()*0.55;fi.txt=infoTexts[Math.floor(Math.random()*infoTexts.length)];}ctx.save();ctx.globalAlpha=fi.alpha*alpha;ctx.font=`bold ${7+Math.random()*5}px monospace`;ctx.textAlign='center';ctx.fillStyle=fi.color;ctx.shadowColor=fi.color;ctx.shadowBlur=8;ctx.fillText(fi.txt,fi.x,fi.y);ctx.restore();});
        const textFade=Math.min(1,ryoikiMagoTimer/35)*fadeOut;
        ctx.save();ctx.globalAlpha=textFade;ctx.textAlign='center';ctx.font='bold 32px serif';ctx.shadowColor='#e879f9';ctx.shadowBlur=30;ctx.fillStyle='#ffffff';ctx.fillText('領域展開',cx2,68);ctx.font='bold 20px monospace';ctx.fillStyle='#e879f9';ctx.shadowBlur=18;ctx.fillText('Ryōiki Tenkai',cx2,95);ctx.font='bold 15px monospace';ctx.fillStyle='#c084fc';ctx.shadowBlur=12;ctx.fillText('無量空処 — O Vazio Ilimitado',cx2,118);ctx.font='bold 11px monospace';ctx.fillStyle='#fae8ff';ctx.shadowColor='#e879f9';ctx.shadowBlur=10;ctx.fillText('🛡 INVULNERÁVEL',cx2,145);ctx.shadowBlur=0;ctx.restore();
        if(ryoikiMagoKilled){const kFade=Math.min(1,(ryoikiMagoTimer-RYOIKI_M_KILL_T)/30)*fadeOut;ctx.save();ctx.globalAlpha=kFade;ctx.textAlign='center';ctx.font='bold 14px monospace';ctx.fillStyle='#fae8ff';ctx.shadowColor='#e879f9';ctx.shadowBlur=18;ctx.fillText('— Todos os alvos: paralisados. —',cx2,canvas.height-38);ctx.shadowBlur=0;ctx.restore();}
        ctx.globalAlpha=1;ctx.restore();
      }
      if(ariseAtivo&&cl==='sombrio')desenharAriseCutscene(ctx,ariseTimer,tick,canvas.width,canvas.height,ariseParticulas,ariseAliados);
      if(invocAtivo&&cl==='sombrio')desenharInvocacaoUltimate(ctx,invocTimer,tick,canvas.width,canvas.height,invocParticulas,invocKilled,igrisPos,beruPos);
      if(atomicAtivo&&cl==='shadow')desenharIAmAtomic(ctx,atomicTimer,tick,canvas.width,canvas.height,atomicParticulas,atomicTimer<80?'charge':atomicTimer<160?'release':'blast');
      if(kyokaAtivo&&cl==='aizen')desenharKyokaSuigetsu(ctx,kyokaTimer,tick,canvas.width,canvas.height,player.x,player.y);
      if(hogyokuAtivo&&cl==='aizen')desenharHogyokuFusion(ctx,hogyokuTimer,tick,canvas.width,canvas.height,hogyokuParticulas,hogyokuKilled);

      // ════ UI HUD ════
      ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(18,canvas.height-44,204,22);
      const hpG=ctx.createLinearGradient(20,0,220,0);hpG.addColorStop(0,'#7f1d1d');hpG.addColorStop(.5,'#ef4444');hpG.addColorStop(1,'#fca5a5');
      ctx.fillStyle=hpG;ctx.fillRect(20,canvas.height-42,(Math.max(0,playerHp)/status.hpMax)*200,18);
      ctx.fillStyle='white';ctx.font='bold 11px monospace';ctx.textAlign='left';
      ctx.fillText(`❤ ${Math.floor(Math.max(0,playerHp))} / ${status.hpMax}`,26,canvas.height-29);
      if(online){ctx.font='bold 10px monospace';ctx.textAlign='right';ctx.fillStyle='#4ade80';ctx.fillText(`🌐 ${qtJog}P`,canvas.width-10,20);}
      if(souHostRef.current&&online){ctx.font='bold 9px monospace';ctx.textAlign='right';ctx.fillStyle='#fbbf24';ctx.fillText('👑 HOST',canvas.width-10,34);}

      // ── Indicador de onda ──
      ctx.font='bold 18px serif';ctx.textAlign='left';
      const isRimuruWave = ondaAtual === TOTAL_ONDAS;
      const isBossWave = ondaAtual === 5;
      ctx.fillStyle = isRimuruWave ? '#c084fc' : isBossWave ? '#fca5a5' : '#e2e8f0';
      ctx.shadowColor = isRimuruWave ? '#7c3aed' : isBossWave ? '#dc2626' : '#7c3aed';
      ctx.shadowBlur = isRimuruWave ? 18 : 12;
      ctx.fillText(
        isRimuruWave ? '💜 RIMURU TEMPEST — BOSS FINAL 💜' :
        isBossWave   ? `⚠ ONDA ${ondaAtual} — BOSS ⚠` :
                       `⚔ ONDA ${ondaAtual} / ${TOTAL_ONDAS}`,
        20, 38
      );
      ctx.shadowBlur=0;

      // ── Aviso de ULT reduzida na onda do Rimuru ──
      if(isRimuruWave && !rimuruCutsceneAtiva){
        ctx.font='bold 9px monospace';ctx.textAlign='left';ctx.fillStyle='#fde68a';ctx.shadowColor='#fbbf24';ctx.shadowBlur=8;
        ctx.fillText('⚡ ULTs: 50% de dano (Rimuru é resistente!)',20,56);ctx.shadowBlur=0;
      }

      if(pocoes.length>0){ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillStyle='#4ade80';ctx.shadowColor='#4ade80';ctx.shadowBlur=6;ctx.fillText(`✚ ${pocoes.length} poção${pocoes.length>1?'ões':''} no mapa`,20,canvas.height-56);ctx.shadowBlur=0;}
      desenharMinimapa(ctx,player.x,player.y,monstros,remotosRef.current,pocoes,WORLD_WIDTH,WORLD_HEIGHT,canvas.width,canvas.height,tick);

      // ════ UI por classe ════
      if(cl==='mago'){
        const hpRdy=hollowCooldown<=0&&hollowFase==='idle',hpCar=hollowFase==='carregando',hcdr=hollowCooldown/HOLLOW_CD_MAX;
        const bx=canvas.width-74,by=canvas.height-74,bs=58;
        ctx.fillStyle=hpCar?'rgba(88,28,135,.97)':hpRdy?'rgba(60,10,100,.92)':'rgba(15,5,25,.85)';ctx.fillRect(bx,by,bs,bs);ctx.strokeStyle=hpCar?'#f0abfc':hpRdy?'#e879f9':'#4c1d95';ctx.lineWidth=hpCar||hpRdy?2.5:1.5;if(hpCar||hpRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=hpCar?22:12;}ctx.strokeRect(bx,by,bs,bs);ctx.shadowBlur=0;
        if(!hpRdy&&!hpCar){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*hcdr);}
        ctx.save();ctx.translate(bx+bs/2,by+29);const gleft=ctx.createRadialGradient(-9,0,0,-9,0,13);gleft.addColorStop(0,'#bfdbfe');gleft.addColorStop(.5,'#3b82f6');gleft.addColorStop(1,'rgba(37,99,235,0)');ctx.fillStyle=gleft;ctx.beginPath();ctx.arc(-9,0,13,0,Math.PI*2);ctx.fill();const gright=ctx.createRadialGradient(9,0,0,9,0,13);gright.addColorStop(0,'#fecaca');gright.addColorStop(.5,'#ef4444');gright.addColorStop(1,'rgba(220,38,38,0)');ctx.fillStyle=gright;ctx.beginPath();ctx.arc(9,0,13,0,Math.PI*2);ctx.fill();if(hpRdy||hpCar){const gm=ctx.createRadialGradient(0,0,0,0,0,8);gm.addColorStop(0,'#fff');gm.addColorStop(.4,'#e879f9');gm.addColorStop(1,'rgba(168,85,247,0)');ctx.shadowColor='#e879f9';ctx.shadowBlur=16;ctx.fillStyle=gm;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}ctx.restore();
        ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillStyle=hpRdy?'#fae8ff':hpCar?'#f0abfc':'#6b21a8';ctx.fillText(hpCar?'CARREGANDO...':'HOLLOW',bx+bs/2,by+46);ctx.fillText('[Z] PURPLE',bx+bs/2,by+56);
        if(!hpRdy&&!hpCar){ctx.font='bold 14px monospace';ctx.fillStyle='#e9d5ff';ctx.fillText(`${Math.ceil(hollowCooldown/60)}s`,bx+bs/2,by+18);}
        const rRdy=ryoikiMagoCooldown<=0&&!ryoikiMagoAtivo,rAt=ryoikiMagoAtivo,rcdr=ryoikiMagoCooldown/RYOIKI_M_CD_MAX;
        const ubx=canvas.width-74,uby=canvas.height-148,ubs=58;
        ctx.fillStyle=rAt?'rgba(20,0,40,.99)':rRdy?'rgba(50,5,80,.94)':'rgba(10,0,20,.88)';ctx.fillRect(ubx,uby,ubs,ubs);ctx.strokeStyle=rAt?'#e879f9':rRdy?'#e879f9':'#3b0764';ctx.lineWidth=rAt||rRdy?2.5:1.5;if(rAt||rRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=rAt?28:14;}ctx.strokeRect(ubx,uby,ubs,ubs);ctx.shadowBlur=0;
        if(!rRdy&&!rAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*rcdr);}
        ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillStyle=rAt?'#f0abfc':rRdy?'#e879f9':'#6b21a8';ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);ctx.font='bold 20px monospace';ctx.fillStyle=rAt?'#f0abfc':rRdy?'#e879f9':'#4c1d95';if(rAt||rRdy){ctx.shadowColor='#e879f9';ctx.shadowBlur=rAt?18:8;}ctx.fillText('∞',ubx+ubs/2,uby+36);ctx.shadowBlur=0;ctx.font='bold 10px monospace';ctx.fillStyle=rAt?'#fae8ff':rRdy?'#f5d0fe':'#4c1d95';ctx.fillText('[X]',ubx+ubs/2,uby+52);
        if(rAt){ctx.font='bold 11px monospace';ctx.fillStyle='#f0abfc';ctx.fillText(`${Math.ceil((RYOIKI_M_DUR-ryoikiMagoTimer)/60)}s`,ubx+ubs/2,uby+22);}
        else if(!rRdy){const mins=Math.floor(ryoikiMagoCooldown/3600),secs=Math.ceil((ryoikiMagoCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#c084fc';ctx.fillText(mins>0?`${mins}m${secs}s`:`${Math.ceil(ryoikiMagoCooldown/60)}s`,ubx+ubs/2,uby+22);}
        const redRdy=redCooldown<=0,rbx=canvas.width-74,rby=canvas.height-220,rbs=58;
        ctx.fillStyle=redRdy?'rgba(120,20,0,.90)':'rgba(15,5,5,.85)';ctx.fillRect(rbx,rby,rbs,rbs);ctx.strokeStyle=redRdy?'#ff4400':'#7f1d1d';ctx.lineWidth=redRdy?2.5:1.5;if(redRdy){ctx.shadowColor='#ff2200';ctx.shadowBlur=14;}ctx.strokeRect(rbx,rby,rbs,rbs);ctx.shadowBlur=0;
        if(!redRdy){const rcdr2=redCooldown/RED_CD;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(rbx,rby,rbs,rbs*rcdr2);}
        ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillStyle=redRdy?'#ff6622':'#7f1d1d';if(redRdy){ctx.shadowColor='#ff2200';ctx.shadowBlur=12;}ctx.fillText('🔴',rbx+rbs/2,rby+32);ctx.shadowBlur=0;ctx.font='bold 9px monospace';ctx.fillStyle=redRdy?'#fca5a5':'#7f1d1d';ctx.fillText('[CLICK]',rbx+rbs/2,rby+44);ctx.fillText('RED',rbx+rbs/2,rby+54);
      }
      if(cl==='guerreiro'){
        const pr=furacaoCooldown<=0&&!furacaoAtivo,at=furacaoAtivo,cdr=furacaoCooldown/FUR_CD_MAX;
        const bx=canvas.width-74,by=canvas.height-74,bs=58;
        ctx.fillStyle=at?'rgba(180,83,9,.92)':pr?'rgba(146,64,14,.88)':'rgba(20,10,5,.85)';ctx.fillRect(bx,by,bs,bs);ctx.strokeStyle=at?'#fbbf24':pr?'#f59e0b':'#78350f';ctx.lineWidth=at||pr?2.5:1.5;if(at||pr){ctx.shadowColor=at?'#fde68a':'#f59e0b';ctx.shadowBlur=at?18:10;}ctx.strokeRect(bx,by,bs,bs);ctx.shadowBlur=0;
        if(!pr&&!at){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillStyle=at?'#fde68a':pr?'#fbbf24':'#92400e';ctx.fillText('🌪',bx+bs/2,by+34);ctx.font='bold 10px monospace';ctx.fillStyle=at?'#fef9c3':pr?'#fef3c7':'#78350f';ctx.fillText('[Z]',bx+bs/2,by+52);
        if(at){ctx.font='bold 14px monospace';ctx.fillStyle='#fde68a';ctx.fillText(`${Math.ceil((FUR_DUR-furacaoTimer)/60)}s`,bx+bs/2,by+20);}else if(!pr){ctx.font='bold 16px monospace';ctx.fillStyle='#fcd34d';ctx.fillText(`${Math.ceil(furacaoCooldown/60)}s`,bx+bs/2,by+20);}
        const gprRdy=guerrProjCooldown<=0,pbx=canvas.width-74,pby=canvas.height-224,pbs=58;
        ctx.fillStyle=gprRdy?'rgba(127,29,29,.88)':'rgba(20,5,5,.85)';ctx.fillRect(pbx,pby,pbs,pbs);ctx.strokeStyle=gprRdy?'#ef4444':'#450a0a';ctx.lineWidth=gprRdy?2.5:1.5;if(gprRdy){ctx.shadowColor='#fbbf24';ctx.shadowBlur=10;}ctx.strokeRect(pbx,pby,pbs,pbs);ctx.shadowBlur=0;
        if(!gprRdy){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(pbx,pby,pbs,pbs*(guerrProjCooldown/GUERR_PROJ_CD));}
        ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillStyle=gprRdy?'#fbbf24':'#7f1d1d';ctx.fillText('🔥',pbx+pbs/2,pby+34);ctx.font='bold 9px monospace';ctx.fillStyle=gprRdy?'#fef9c3':'#78350f';ctx.fillText('[ESPAÇO]',pbx+pbs/2,pby+52);
        const uPr=ryoikiCooldown<=0&&!ryoikiAtivo&&!ryoikiLimpouOnda,uAt=ryoikiAtivo||ryoikiLimpouOnda,ucdr=ryoikiCooldown/RYO_CD_MAX;
        const ubx=canvas.width-74,uby=canvas.height-148,ubs=58,pul=.5+.5*Math.sin(tick*.08);
        ctx.fillStyle=uAt?'rgba(180,10,10,.97)':uPr?'rgba(120,10,10,.92)':'rgba(20,5,5,.88)';ctx.fillRect(ubx,uby,ubs,ubs);ctx.strokeStyle=uAt?`rgba(255,${80+Math.floor(pul*60)},80,1)`:uPr?'#dc2626':'#7f1d1d';ctx.lineWidth=uAt||uPr?2.5:1.5;if(uAt||uPr){ctx.shadowColor='#dc2626';ctx.shadowBlur=uAt?22:12;}ctx.strokeRect(ubx,uby,ubs,ubs);ctx.shadowBlur=0;
        if(!uPr&&!uAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*ucdr);}
        ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillStyle=uAt?'#ff8080':uPr?'#fca5a5':'#7f1d1d';ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);ctx.font='bold 22px sans-serif';ctx.fillStyle=uAt?'#ff4444':uPr?'#ef4444':'#7f1d1d';ctx.fillText('💢',ubx+ubs/2,uby+34);ctx.font='bold 10px monospace';ctx.fillStyle=uAt?'#fca5a5':uPr?'#fee2e2':'#7f1d1d';ctx.fillText('[X]',ubx+ubs/2,uby+52);
        if(uAt&&ryoikiAtivo){ctx.font='bold 12px monospace';ctx.fillStyle='#ff8080';ctx.fillText(`${Math.ceil((RYO_DUR-ryoikiTimer)/60)}s`,ubx+ubs/2,uby+22);}
        else if(uAt&&ryoikiLimpouOnda){ctx.font='bold 10px monospace';ctx.fillStyle='#fca5a5';ctx.fillText('próx...',ubx+ubs/2,uby+22);}
        else if(!uPr){ctx.font='bold 13px monospace';ctx.fillStyle='#fca5a5';ctx.fillText(`${Math.ceil(ryoikiCooldown/60)}s`,ubx+ubs/2,uby+22);}
      }
      if(cl==='sombrio'){
        const ptu=ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED&&!ariseAtivo,cdr=ressurrCooldown/RESSURR_CD_MAX;
        const bx=canvas.width-74,by=canvas.height-74,bs=58;
        ctx.fillStyle=ariseAtivo?'rgba(100,20,160,.97)':ptu?'rgba(88,28,135,.92)':'rgba(15,5,25,.88)';ctx.fillRect(bx,by,bs,bs);ctx.strokeStyle=ariseAtivo?'#e879f9':ptu?'#e879f9':'#4c1d95';ctx.lineWidth=ptu||ariseAtivo?2.5:1.5;if(ptu||ariseAtivo){ctx.shadowColor='#e879f9';ctx.shadowBlur=ariseAtivo?22:14;}ctx.strokeRect(bx,by,bs,bs);ctx.shadowBlur=0;
        if(!ptu&&ressurrCooldown>0&&!ariseAtivo){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillStyle=ariseAtivo?'#f0abfc':ptu?'#e879f9':'#7c3aed';ctx.fillText('💀',bx+bs/2,by+34);ctx.font='bold 10px monospace';ctx.fillStyle=ariseAtivo?'#fae8ff':ptu?'#fae8ff':'#581c87';ctx.fillText(ariseAtivo?'ARISE!':'[Z]',bx+bs/2,by+52);
        if(ressurrCooldown>0&&!ariseAtivo){ctx.font='bold 14px monospace';ctx.fillStyle='#d8b4fe';ctx.fillText(`${Math.ceil(ressurrCooldown/60)}s`,bx+bs/2,by+18);}
        const slSz=10,slGp=3,totW=KILLS_NEEDED*(slSz+slGp)-slGp,slSX=bx+(bs-totW)/2,slSY=by-18;
        for(let k=0;k<KILLS_NEEDED;k++){const f=k<killsAcum;ctx.fillStyle=f?'#a855f7':'rgba(100,50,150,.3)';if(f){ctx.shadowColor='#e879f9';ctx.shadowBlur=5;}ctx.fillRect(slSX+k*(slSz+slGp),slSY,slSz,slSz);ctx.shadowBlur=0;}
        ctx.font='bold 8px monospace';ctx.fillStyle='#c084fc';ctx.fillText(`${killsAcum}/${KILLS_NEEDED} KILLS`,bx+bs/2,slSY-3);
        if(aliados.length>0){ctx.font='bold 9px monospace';ctx.fillStyle='#e879f9';ctx.fillText(`👁 ${aliados.length} ALIADO${aliados.length>1?'S':''}`,bx+bs/2,by-32);}
        if(sombrasFila.length>0){
          const filaX=canvas.width-170,filaY=canvas.height-210,filaH=Math.min(sombrasFila.length,6)*24+28;
          ctx.fillStyle='rgba(0,0,0,.7)';ctx.beginPath();ctx.roundRect(filaX-8,filaY-18,148,filaH,8);ctx.fill();ctx.strokeStyle='#7e22ce';ctx.lineWidth=1;ctx.strokeRect(filaX-8,filaY-18,148,filaH);
          ctx.font='bold 9px monospace';ctx.textAlign='left';ctx.fillStyle='#c084fc';ctx.fillText(`🌑 SOMBRAS (${sombrasFila.length}/${MAX_SOMBRAS})`,filaX,filaY-4);
          const filaOrdenada=[...sombrasFila].sort((a,b)=>b.ordemMorte-a.ordemMorte);
          filaOrdenada.slice(0,6).forEach((s,i)=>{const fy=filaY+i*24+14;const cor=s.tipo==='arqueiro'?'#4ade80':s.tipo==='tanque'?'#818cf8':s.tipo==='velocista'?'#fb923c':s.tipo==='mago_ini'?'#e879f9':'#c084fc';ctx.fillStyle=cor;ctx.font='bold 10px monospace';ctx.fillText(`${i===0?'▶':' '} ${iconeTipo(s.tipo)} ${s.tipo==='mago_ini'?'MAGO':s.tipo.toUpperCase()}`,filaX,fy);});
          if(sombrasFila.length>6){ctx.fillStyle='rgba(192,132,252,.6)';ctx.font='bold 8px monospace';ctx.fillText(`+${sombrasFila.length-6} mais...`,filaX,filaY+6*24+10);}
        }
        const invRdy=invocCooldown<=0&&!invocAtivo&&!ariseAtivo,invAt=invocAtivo,icdr=invocCooldown/INVOC_CD_MAX;
        const ubx=canvas.width-74,uby=canvas.height-148,ubs=58;
        ctx.fillStyle=invAt?'rgba(25,0,50,.99)':invRdy?'rgba(60,0,100,.94)':'rgba(10,0,20,.88)';ctx.fillRect(ubx,uby,ubs,ubs);ctx.strokeStyle=invAt?'#e879f9':invRdy?'#a855f7':'#3b0764';ctx.lineWidth=invAt||invRdy?2.5:1.5;if(invAt||invRdy){ctx.shadowColor=invAt?'#e879f9':'#a855f7';ctx.shadowBlur=invAt?28:14;}ctx.strokeRect(ubx,uby,ubs,ubs);ctx.shadowBlur=0;
        if(!invRdy&&!invAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*icdr);}
        ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillStyle=invAt?'#f0abfc':invRdy?'#c084fc':'#6b21a8';ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);ctx.font='bold 12px monospace';ctx.fillStyle=invAt?'#f0abfc':invRdy?'#e879f9':'#4c1d95';if(invAt||invRdy){ctx.shadowColor=invAt?'#e879f9':'#a855f7';ctx.shadowBlur=invAt?18:8;}ctx.fillText('⚔🐜',ubx+ubs/2,uby+35);ctx.shadowBlur=0;ctx.font='bold 8px monospace';ctx.fillStyle=invAt?'#fae8ff':invRdy?'#f5d0fe':'#4c1d95';ctx.fillText('IGRIS+BERU',ubx+ubs/2,uby+48);ctx.font='bold 10px monospace';ctx.fillStyle=invAt?'#fae8ff':invRdy?'#f5d0fe':'#4c1d95';ctx.fillText('[X]',ubx+ubs/2,uby+58);
        if(invAt){ctx.font='bold 11px monospace';ctx.fillStyle='#f0abfc';ctx.shadowColor='#e879f9';ctx.shadowBlur=8;ctx.fillText(`${Math.ceil((INVOC_DUR-invocTimer)/60)}s`,ubx+ubs/2,uby+22);ctx.shadowBlur=0;}
        else if(!invRdy){const mins2=Math.floor(invocCooldown/3600),secs2=Math.ceil((invocCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#c084fc';ctx.fillText(mins2>0?`${mins2}m${secs2}s`:`${Math.ceil(invocCooldown/60)}s`,ubx+ubs/2,uby+22);}
      }
      if(cl==='shadow'){
        const ePr=ebonyCooldown<=0&&!ebonyAtivo,eAt=ebonyAtivo,eCdr=ebonyCooldown/EBONY_CD_MAX;
        const bx=canvas.width-74,by=canvas.height-74,bs=58;
        ctx.fillStyle=eAt?'rgba(168,85,247,.97)':ePr?'rgba(124,58,237,.92)':'rgba(15,5,30,.88)';ctx.fillRect(bx,by,bs,bs);ctx.strokeStyle=eAt?'#d946ef':ePr?'#a855f7':'#4c1d95';ctx.lineWidth=eAt||ePr?2.5:1.5;if(eAt||ePr){ctx.shadowColor='#d946ef';ctx.shadowBlur=eAt?22:12;}ctx.strokeRect(bx,by,bs,bs);ctx.shadowBlur=0;
        if(!ePr&&!eAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*eCdr);}
        ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillStyle=eAt?'#f0abfc':ePr?'#d946ef':'#4c1d95';ctx.fillText('🌀',bx+bs/2,by+34);ctx.font='bold 9px monospace';ctx.fillStyle=eAt?'#faf5ff':ePr?'#e9d5ff':'#4c1d95';ctx.fillText('[Z] EBONY',bx+bs/2,by+52);
        if(!ePr&&!eAt){ctx.font='bold 14px monospace';ctx.fillStyle='#a855f7';ctx.fillText(`${Math.ceil(ebonyCooldown/60)}s`,bx+bs/2,by+18);}
        const ssPr=shadowProjCooldown<=0,ssBx=canvas.width-74,ssBy=canvas.height-148,ssBs=58;
        ctx.fillStyle=ssPr?'rgba(124,58,237,.90)':'rgba(15,5,30,.88)';ctx.fillRect(ssBx,ssBy,ssBs,ssBs);ctx.strokeStyle=ssPr?'#d946ef':'#4c1d95';ctx.lineWidth=ssPr?2.5:1.5;if(ssPr){ctx.shadowColor='#d946ef';ctx.shadowBlur=10;}ctx.strokeRect(ssBx,ssBy,ssBs,ssBs);ctx.shadowBlur=0;
        if(!ssPr){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ssBx,ssBy,ssBs,ssBs*(shadowProjCooldown/SHADOW_PROJ_CD));}
        ctx.font='bold 22px sans-serif';ctx.fillStyle=ssPr?'#f0abfc':'#4c1d95';ctx.fillText('⚔',ssBx+ssBs/2,ssBy+34);ctx.font='bold 9px monospace';ctx.fillStyle=ssPr?'#e9d5ff':'#4c1d95';ctx.fillText('[ESPAÇO]',ssBx+ssBs/2,ssBy+52);
        const aaPr=atomicCooldown<=0&&!atomicAtivo,aaAt=atomicAtivo,aaCdr=atomicCooldown/ATOMIC_CD_MAX;
        const ubx=canvas.width-74,uby=canvas.height-222,ubs=58;
        ctx.fillStyle=aaAt?'rgba(168,85,247,.99)':aaPr?'rgba(124,58,237,.95)':'rgba(15,5,30,.9)';ctx.fillRect(ubx,uby,ubs,ubs);ctx.strokeStyle=aaAt?'#f0abfc':aaPr?'#d946ef':'#4c1d95';ctx.lineWidth=aaAt||aaPr?2.5:1.5;if(aaAt||aaPr){ctx.shadowColor=aaAt?'#f0abfc':'#d946ef';ctx.shadowBlur=aaAt?28:14;}ctx.strokeRect(ubx,uby,ubs,ubs);ctx.shadowBlur=0;
        if(!aaPr&&!aaAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ubx,uby,ubs,ubs*aaCdr);}
        ctx.font='bold 7px monospace';ctx.fillStyle=aaAt?'#faf5ff':aaPr?'#e9d5ff':'#4c1d95';ctx.fillText('ULTIMATE',ubx+ubs/2,uby+11);ctx.font='bold 11px monospace';ctx.fillStyle=aaAt?'#f0abfc':aaPr?'#d946ef':'#4c1d95';if(aaAt||aaPr){ctx.shadowColor='#d946ef';ctx.shadowBlur=aaAt?14:8;}ctx.fillText('ATOMIC',ubx+ubs/2,uby+30);ctx.shadowBlur=0;ctx.font='bold 10px monospace';ctx.fillStyle=aaAt?'#faf5ff':aaPr?'#e9d5ff':'#4c1d95';ctx.fillText('[X]',ubx+ubs/2,uby+50);
        if(aaAt){ctx.font='bold 9px monospace';ctx.fillStyle='#f0abfc';ctx.fillText(`${Math.ceil((ATOMIC_DUR-atomicTimer)/60)}s`,ubx+ubs/2,uby+18);}
        else if(!aaPr){const mins3=Math.floor(atomicCooldown/3600),secs3=Math.ceil((atomicCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#a855f7';ctx.fillText(mins3>0?`${mins3}m${secs3}s`:`${Math.ceil(atomicCooldown/60)}s`,ubx+ubs/2,uby+22);}
      }
      if(cl==='aizen'){
        const ilPr=ilusaoCooldown<=0,ilBx=canvas.width-74,ilBy=canvas.height-74,ilBs=58;
        ctx.fillStyle=ilPr?'rgba(120,80,0,.92)':'rgba(20,12,0,.88)';ctx.fillRect(ilBx,ilBy,ilBs,ilBs);ctx.strokeStyle=ilPr?'#fbbf24':'#78350f';ctx.lineWidth=ilPr?2.5:1.5;if(ilPr){ctx.shadowColor='#fbbf24';ctx.shadowBlur=12;}ctx.strokeRect(ilBx,ilBy,ilBs,ilBs);ctx.shadowBlur=0;
        if(!ilPr){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(ilBx,ilBy,ilBs,ilBs*(ilusaoCooldown/ILUSAO_CD));}
        ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillStyle=ilPr?'#fde68a':'#78350f';ctx.fillText('🪞',ilBx+ilBs/2,ilBy+34);ctx.font='bold 9px monospace';ctx.fillStyle=ilPr?'#fef9c3':'#78350f';ctx.fillText('[CLICK]',ilBx+ilBs/2,ilBy+52);
        const kPr=kyokaCooldown<=0&&!kyokaAtivo,kAt=kyokaAtivo,kCdr=kyokaCooldown/KYOKA_CD_MAX;
        const kbx=canvas.width-74,kby=canvas.height-148,kbs=58;
        ctx.fillStyle=kAt?'rgba(120,80,0,.97)':kPr?'rgba(100,65,0,.92)':'rgba(18,10,0,.88)';ctx.fillRect(kbx,kby,kbs,kbs);ctx.strokeStyle=kAt?'#fde68a':kPr?'#fbbf24':'#78350f';ctx.lineWidth=kAt||kPr?2.5:1.5;if(kAt||kPr){ctx.shadowColor='#fbbf24';ctx.shadowBlur=kAt?20:12;}ctx.strokeRect(kbx,kby,kbs,kbs);ctx.shadowBlur=0;
        if(!kPr&&!kAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(kbx,kby,kbs,kbs*kCdr);}
        ctx.font='bold 9px monospace';ctx.fillStyle=kAt?'#fef9c3':kPr?'#fde68a':'#78350f';ctx.fillText('鏡花水月',kbx+kbs/2,kby+16);
        ctx.font='bold 10px monospace';ctx.fillStyle=kAt?'#fef9c3':kPr?'#fde68a':'#78350f';ctx.fillText(kAt?'🛡INVU':' KYOKA',kbx+kbs/2,kby+30);ctx.fillText('[Z]',kbx+kbs/2,kby+50);
        if(kAt){ctx.font='bold 9px monospace';ctx.fillStyle='#fde68a';ctx.fillText(`${Math.ceil((KYOKA_DUR-kyokaTimer)/60)}s`,kbx+kbs/2,kby+42);}
        else if(!kPr){ctx.font='bold 11px monospace';ctx.fillStyle='#fbbf24';ctx.fillText(`${Math.ceil(kyokaCooldown/60)}s`,kbx+kbs/2,kby+20);}
        const hPr=hogyokuCooldown<=0&&!hogyokuAtivo,hAt=hogyokuAtivo,hCdr=hogyokuCooldown/HOGYOKU_CD_MAX;
        const hbx=canvas.width-74,hby=canvas.height-222,hbs=58;
        ctx.fillStyle=hAt?'rgba(80,10,120,.99)':hPr?'rgba(60,5,90,.95)':'rgba(15,0,25,.9)';ctx.fillRect(hbx,hby,hbs,hbs);ctx.strokeStyle=hAt?'#fbbf24':hPr?'#a855f7':'#4c1d95';ctx.lineWidth=hAt||hPr?2.5:1.5;if(hAt||hPr){ctx.shadowColor=hAt?'#fbbf24':'#a855f7';ctx.shadowBlur=hAt?28:14;}ctx.strokeRect(hbx,hby,hbs,hbs);ctx.shadowBlur=0;
        if(!hPr&&!hAt){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(hbx,hby,hbs,hbs*hCdr);}
        ctx.font='bold 7px monospace';ctx.fillStyle=hAt?'#fde68a':hPr?'#c084fc':'#4c1d95';ctx.fillText('ULTIMATE',hbx+hbs/2,hby+11);ctx.font='bold 12px monospace';ctx.fillStyle=hAt?'#fde68a':hPr?'#fbbf24':'#4c1d95';if(hAt||hPr){ctx.shadowColor=hAt?'#fbbf24':'#a855f7';ctx.shadowBlur=hAt?16:8;}ctx.fillText('宝玉',hbx+hbs/2,hby+30);ctx.shadowBlur=0;ctx.font='bold 10px monospace';ctx.fillStyle=hAt?'#fde68a':hPr?'#f5d0fe':'#4c1d95';ctx.fillText('[X]',hbx+hbs/2,hby+50);
        if(hAt){ctx.font='bold 11px monospace';ctx.fillStyle='#fde68a';ctx.shadowColor='#fbbf24';ctx.shadowBlur=8;ctx.fillText(`${Math.ceil((HOGYOKU_DUR-hogyokuTimer)/60)}s`,hbx+hbs/2,hby+22);ctx.shadowBlur=0;}
        else if(!hPr){const mins4b=Math.floor(hogyokuCooldown/3600),secs4b=Math.ceil((hogyokuCooldown%3600)/60);ctx.font='bold 11px monospace';ctx.fillStyle='#a855f7';ctx.fillText(mins4b>0?`${mins4b}m${secs4b}s`:`${Math.ceil(hogyokuCooldown/60)}s`,hbx+hbs/2,hby+22);}
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
      pararAudio(0);
      const s = socketRef.current;
      if(s){s.off('monstros_atualizados');s.off('aplicar_dano');s.off('onda_mudou');}
    };
  }, [status, imgPlayer, imgArmaGuerr, imgArmaMago, imgGuerreiro, imgMago, imgSombrio, imgShadow, imgAizen, imgRimuru]);

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
          {status.classe==='mago'      && 'CLIQUE = Red (repulsão) · Z = Hollow Purple · X = Ryōiki Tenkai [invulnerável] · '}
          {status.classe==='guerreiro' && 'ESPAÇO = 🔥 Projétil · Z = Furacão · X = Ryōiki Tenkai · '}
          {status.classe==='sombrio'   && 'Z = ARISE (5 kills) · X = Igris+Beru [invulnerável] · '}
          {status.classe==='shadow'    && 'ESPAÇO = Shadow Slash · Z = Ebony Swirl · X = I AM ATOMIC [ultimate] · '}
          {status.classe==='aizen'     && 'CLIQUE = Ilusão · Z = Kyōka Suigetsu [INVENCÍVEL] · X = Hōgyoku Fusion [ultimate] · '}
          ✚ Colete poções · Sobreviva até onda 10 · Derrote Rimuru Tempest!
        </p>
      </div>
    </main>
  );
}
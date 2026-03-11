'use client';

import { useEffect, useRef, useState } from 'react';

type Projetil = { x: number; y: number; vx: number; vy: number; tipo: string; angulo: number; dano: number; };
type AtaqueMelee = { ativo: boolean; anguloAtual: number; duracao: number; dano: number; };
type Monstro = {
  id: number; x: number; y: number; hp: number; maxHp: number; size: number;
  cor: string; isBoss?: boolean; isFinalBoss?: boolean;
  breathe: number; breatheDir: number; breatheSpeed: number;
  corVariante: string; corBrilho: string; corOlho: string;
  hitTimer: number;
  bubbletimer: number;
  raioCooldown?: number;
};

type RaioBoss = {
  x: number; y: number; vx: number; vy: number;
  angulo: number; vida: number;
  homingTimer: number;
};

type SlimeAliado = {
  id: number; x: number; y: number; hp: number; maxHp: number; size: number;
  breathe: number; breatheSpeed: number; hitTimer: number;
  anguloAtaque: number; cooldownAtaque: number;
  spawnTimer: number;
};

type MonstroMorto = {
  hp: number; maxHp: number; size: number; x: number; y: number;
};

const SLIME_PALETAS = [
  { base: '#7f1d1d', variante: '#450a0a', brilho: '#ef4444', olho: '#fca5a5' },
  { base: '#14532d', variante: '#052e16', brilho: '#4ade80', olho: '#bbf7d0' },
  { base: '#1e1b4b', variante: '#0f0a2e', brilho: '#818cf8', olho: '#c7d2fe' },
  { base: '#78350f', variante: '#431407', brilho: '#fb923c', olho: '#fed7aa' },
  { base: '#164e63', variante: '#083344', brilho: '#22d3ee', olho: '#a5f3fc' },
];

export default function Jogo2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [carregado, setCarregado] = useState(false);

  const [imgPlayer, setImgPlayer] = useState<HTMLImageElement | null>(null);
  const [imgArmaGuerreiro, setImgArmaGuerreiro] = useState<HTMLImageElement | null>(null);
  const [imgArmaMago,      setImgArmaMago]      = useState<HTMLImageElement | null>(null);
  const [imgArmaSombrio,   setImgArmaSombrio]   = useState<HTMLImageElement | null>(null);
  const [imgCenarioJogo, setImgCenarioJogo] = useState<HTMLImageElement | null>(null);
  const mouseCanvasRef = useRef({ x: 450, y: 300 });

  const [imgRaioImpacto, setImgRaioImpacto] = useState<HTMLImageElement | null>(null);
  const RAIO_IMPACTO_URL = '';

  const [imgCorte, setImgCorte] = useState<HTMLImageElement | null>(null);
  const CORTE_SOMBRIO_URL = '';

  const [status, setStatus] = useState({
    nome: 'Herói', classe: 'guerreiro',
    str: 10, agi: 10, int: 10, vit: 10,
    hpMax: 100
  });

  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 2000;

  useEffect(() => {
    const nome = localStorage.getItem('glory_dark_char_nome') || 'Guilherme';
    const classe = (localStorage.getItem('glory_dark_char_classe') || 'guerreiro').toLowerCase();
    const vidaInicial = 100 + (10 * 10);
    setStatus(prev => ({ ...prev, nome, classe, hpMax: vidaInicial }));

    const linksPersonagens: { [key: string]: string } = {
      guerreiro: 'https://png.pngtree.com/png-clipart/20230819/original/pngtree-vector-pixel-game-character-pixel-man-picture-image_8061303.png',
      mago:      'https://pngimg.com/uploads/wizard/wizard_PNG18.png',
      sombrio:   'https://pnganime.com/images/download/sung-jin-woo-full-body-solo-leveling-transparent-png',
    };

    const ARMA_GUERREIRO = 'https://toppng.com/public/uploads/preview/pixel-axe-pixel-art-11562940250p3un3f5yyo.png';
    const ARMA_MAGO      = 'https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png';
    const ARMA_SOMBRIO   = 'https://w7.pngwing.com/pngs/45/626/png-transparent-pixel-art-dagger-sword-knife-sword-angle-electronics-pixel-art.png';

    const carregarImagem = (src: string, setter: (img: HTMLImageElement) => void) => {
      if (!src || src.includes('LINK_AQUI')) return;
      const img = new Image();
      img.src = src;
      img.onload = () => setter(img);
    };

    carregarImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg', setImgCenarioJogo);
    carregarImagem(linksPersonagens[classe], setImgPlayer);
    carregarImagem(ARMA_GUERREIRO, setImgArmaGuerreiro);
    carregarImagem(ARMA_MAGO,      setImgArmaMago);
    carregarImagem(ARMA_SOMBRIO,   setImgArmaSombrio);
    if (RAIO_IMPACTO_URL) carregarImagem(RAIO_IMPACTO_URL, setImgRaioImpacto);
    if (CORTE_SOMBRIO_URL) carregarImagem(CORTE_SOMBRIO_URL, setImgCorte);
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const projectiles: Projetil[] = [];
    let melee: AtaqueMelee = { ativo: false, anguloAtual: 0, duracao: 0, dano: 20 + status.str };

    let playerHp = status.hpMax;
    let ondaAtual = 1;
    let estadoJogo = 'jogando';

    const RAIO_COOLDOWN_MAX = 600;
    const RAIO_DANO         = 120 + status.int * 3;
    const RAIO_RAIO_AREA    = 120;
    const RAIO_DURACAO      = 40;

    let raioCooldown = 0;
    let raioAtivo    = false;
    let raioTimer    = 0;
    let raioAlvo     = { x: 0, y: 0 };

    const FURACAO_COOLDOWN_MAX = 900;
    const FURACAO_DURACAO      = 300;
    const FURACAO_DANO_TICK    = 4;
    const FURACAO_ALCANCE      = 160;
    const FURACAO_VELOCIDADE   = 2.0;

    let furacaoCooldown = 0;
    let furacaoAtivo    = false;
    let furacaoTimer    = 0;
    let furacaoAngulo   = 0;

    // ─── RAIOS DO BOSS FINAL ─────────────────────────────────────────────────
    const RAIO_BOSS_COOLDOWN  = 180;  // 3 segundos a 60fps entre rajadas
    const RAIO_BOSS_DANO      = 35;   // dano por acerto (alto — desviável)
    const RAIO_BOSS_VEL       = 7;    // velocidade do projétil
    const RAIO_BOSS_VIDA      = 180;  // frames de vida do projétil
    let raioBossArr: RaioBoss[] = [];  // projéteis ativos do boss final
    // ─────────────────────────────────────────────────────────────────────────

    const RESSURR_COOLDOWN_MAX  = 1800;
    const RESSURR_KILLS_NEEDED  = 5;
    const RESSURR_MAX_ALIADOS   = 5;
    const ALIADO_DANO           = 8;
    const ALIADO_ALCANCE        = 55;
    const ALIADO_ATAQUE_CD      = 40;

    let ressurrCooldown  = 0;
    let killsAcumulados  = 0;
    let slimesAliados: SlimeAliado[] = [];
    let monstrosMortos: MonstroMorto[] = [];

    // ─── CORTE DO SOMBRIO ────────────────────────────────────────────────────
    // Alcance médio: 150px (guerreiro ~100px, mais curto que projétil do mago)
    // Largura do arco: 1.1 rad (~63°) — mais preciso/elegante que o guerreiro
    // Guiado pelo mouse
    type CorteSombrio = { ativo: boolean; timer: number; duracao: number; anguloBase: number; };
    let corte: CorteSombrio = { ativo: false, timer: 0, duracao: 14, anguloBase: 0 };
    const CORTE_ALCANCE  = 150;  // alcance médio — entre guerreiro (100) e mago (infinito)
    const CORTE_LARGURA  = 1.1;  // radianos (~63°) — arco mais fino e preciso
    const CORTE_DANO     = 18 + status.agi;
    // ─────────────────────────────────────────────────────────────────────────

    function desenharSlime(ctx: CanvasRenderingContext2D, m: Monstro, tick: number) {
      const cx = m.x + m.size / 2;
      const cy = m.y + m.size / 2;
      const r = m.size / 2;

      const breathScale = 1 + Math.sin(m.breathe) * 0.07;
      const hitOffX = m.hitTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
      const hitOffY = m.hitTimer > 0 ? (Math.random() - 0.5) * 8 : 0;
      if (m.hitTimer > 0) m.hitTimer--;

      ctx.save();
      ctx.translate(cx + hitOffX, cy + hitOffY);
      ctx.scale(breathScale, 2 - breathScale);

      ctx.save();
      ctx.scale(1, 0.2);
      ctx.translate(0, r * 4.5);
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.05, 0, 0, r * 1.2);
      bodyGrad.addColorStop(0, m.corBrilho);
      bodyGrad.addColorStop(0.35, m.cor);
      bodyGrad.addColorStop(1, m.corVariante);
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = m.corBrilho;
      ctx.shadowBlur = m.isBoss ? 50 : 20;

      ctx.beginPath();
      if (m.isBoss) {
        ctx.moveTo(0, -r * 1.1);
        for (let i = 0; i < 5; i++) {
          const a = (-Math.PI / 2) + (i - 2) * 0.35;
          const spike = r * (i % 2 === 0 ? 1.4 : 1.0);
          ctx.lineTo(Math.cos(a) * spike * 0.6, Math.sin(a) * spike);
        }
        ctx.bezierCurveTo(r * 1.3, -r * 0.3, r * 1.3, r * 0.5, r * 0.8, r);
        ctx.bezierCurveTo(r * 0.4, r * 1.2, -r * 0.4, r * 1.2, -r * 0.8, r);
        ctx.bezierCurveTo(-r * 1.3, r * 0.5, -r * 1.3, -r * 0.3, 0, -r * 1.1);
      } else {
        ctx.moveTo(0, -r * 0.9);
        ctx.bezierCurveTo(r * 0.4, -r * 1.0, r * 0.85, -r * 0.7, r * 1.0, -r * 0.1);
        ctx.bezierCurveTo(r * 1.0, r * 0.4, r * 0.8, r * 0.85, r * 0.5, r * 1.05);
        ctx.lineTo(r * 0.3, r * 0.85);
        ctx.lineTo(r * 0.1, r * 1.05);
        ctx.lineTo(-r * 0.1, r * 0.85);
        ctx.lineTo(-r * 0.3, r * 1.05);
        ctx.lineTo(-r * 0.5, r * 0.85);
        ctx.bezierCurveTo(-r * 0.8, r * 0.85, -r * 1.0, r * 0.4, -r * 1.0, -r * 0.1);
        ctx.bezierCurveTo(-r * 0.85, -r * 0.7, -r * 0.4, -r * 1.0, 0, -r * 0.9);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      const hlGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 0, -r * 0.15, -r * 0.25, r * 0.5);
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.32, r * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fill();

      if (m.isBoss) {
        ctx.fillStyle = '#fef2f2';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.45, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        const irisGrad = ctx.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.2, r * 0.28);
        irisGrad.addColorStop(0, '#7f1d1d');
        irisGrad.addColorStop(0.6, '#dc2626');
        irisGrad.addColorStop(1, '#fca5a5');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.28, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.06, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(r * 0.1, -r * 0.32, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,38,38,0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.28, -r * 0.2 + Math.sin(a) * r * 0.28);
          ctx.lineTo(Math.cos(a) * r * 0.44, -r * 0.2 + Math.sin(a) * r * 0.34);
          ctx.stroke();
        }
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.22, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fafaf9';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.18, r * 0.35);
          ctx.lineTo(i * r * 0.18 - r * 0.07, r * 0.56);
          ctx.lineTo(i * r * 0.18 + r * 0.07, r * 0.56);
          ctx.closePath();
          ctx.fill();
        }
        if (Math.random() < 0.08) {
          ctx.fillStyle = m.corBrilho + 'aa';
          ctx.beginPath();
          const gx = (Math.random() - 0.5) * r * 1.5;
          const gy = r * (0.8 + Math.random() * 0.5);
          ctx.ellipse(gx, gy, r * 0.05, r * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        [-r * 0.28, r * 0.28].forEach((ox) => {
          const oy = -r * 0.25;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.ellipse(ox, oy, r * 0.17, r * 0.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = m.corBrilho;
          ctx.beginPath();
          ctx.ellipse(ox, oy, r * 0.11, r * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(ox, oy, r * 0.04, r * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(ox + r * 0.05, oy - r * 0.07, r * 0.04, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = m.corOlho;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.22);
        ctx.bezierCurveTo(-r * 0.2, r * 0.08, r * 0.2, r * 0.08, r * 0.4, r * 0.22);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.15, r * 0.17);
          ctx.lineTo(i * r * 0.15 - r * 0.04, r * 0.28);
          ctx.lineTo(i * r * 0.15 + r * 0.04, r * 0.28);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore();

      const bw = m.size * 1.1;
      const bx2 = m.x - bw * 0.05;
      const by2 = m.y - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(bx2, by2, bw, 7, 4);
      ctx.fill();

      const hpRatio = Math.max(0, m.hp / m.maxHp);
      const hpGrad = ctx.createLinearGradient(bx2, 0, bx2 + bw, 0);
      if (m.isBoss) {
        hpGrad.addColorStop(0, '#7f1d1d');
        hpGrad.addColorStop(0.5, '#ef4444');
        hpGrad.addColorStop(1, '#fca5a5');
      } else {
        hpGrad.addColorStop(0, m.corVariante);
        hpGrad.addColorStop(1, m.corBrilho);
      }
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(bx2, by2, bw * hpRatio, 7, 4);
      ctx.fill();

      ctx.fillStyle = m.isBoss ? '#fca5a5' : 'rgba(255,255,255,0.7)';
      ctx.font = `bold ${m.isBoss ? 13 : 10}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m.isBoss ? '☠ BOSS ☠' : 'SLIME', cx, by2 - 4);
    }

    function desenharRaio(wx: number, wy: number, progresso: number) {
      const fase = progresso < 0.3 ? progresso / 0.3 : 1 - (progresso - 0.3) / 0.7;
      const alpha = Math.max(0, fase);

      const origemY = wy - 600;
      const origemX = wx + (Math.random() - 0.5) * 4;

      const segmentos = 10;
      const pontos: {x: number, y: number}[] = [];
      pontos.push({ x: origemX, y: origemY });
      for (let i = 1; i < segmentos; i++) {
        const t = i / segmentos;
        const jitter = (1 - t) * 35 * (Math.random() - 0.5);
        pontos.push({
          x: wx + jitter,
          y: origemY + (wy - origemY) * t,
        });
      }
      pontos.push({ x: wx, y: wy });

      ctx.save();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pontos[0].x, pontos[0].y);
      for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i].x, pontos[i].y);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(pontos[0].x, pontos[0].y);
      for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i].x, pontos[i].y);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pontos[0].x, pontos[0].y);
      for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i].x, pontos[i].y);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2;
      for (let b = 0; b < 4; b++) {
        const bi = Math.floor(Math.random() * (pontos.length - 2)) + 1;
        const bp = pontos[bi];
        ctx.beginPath();
        ctx.moveTo(bp.x, bp.y);
        const blen = 40 + Math.random() * 60;
        const bang = Math.random() * Math.PI * 2;
        ctx.lineTo(bp.x + Math.cos(bang) * blen, bp.y + Math.sin(bang) * blen);
        ctx.stroke();
      }

      if (progresso > 0.2) {
        const impAlpha = alpha * (progresso < 0.5 ? 1 : 1 - (progresso - 0.5) / 0.5);

        const ondaR = RAIO_RAIO_AREA * (progresso / 1) * 1.3;
        const ondaGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, ondaR);
        ondaGrad.addColorStop(0,   `rgba(232,121,249,${impAlpha * 0.6})`);
        ondaGrad.addColorStop(0.4, `rgba(139,92,246,${impAlpha * 0.35})`);
        ondaGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = ondaGrad;
        ctx.beginPath();
        ctx.arc(wx, wy, ondaR, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = impAlpha * 0.8;
        ctx.strokeStyle = '#f0abfc';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(wx, wy, RAIO_RAIO_AREA, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = impAlpha * 0.9;
        const flashGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, 50);
        flashGrad.addColorStop(0,   'rgba(255,255,255,0.95)');
        flashGrad.addColorStop(0.3, 'rgba(216,180,254,0.6)');
        flashGrad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(wx, wy, 50, 0, Math.PI * 2);
        ctx.fill();

        if (imgRaioImpacto) {
          ctx.globalAlpha = impAlpha;
          const sz = 100;
          ctx.drawImage(imgRaioImpacto, wx - sz / 2, wy - sz / 2, sz, sz);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function desenharFuracao(px: number, py: number, angulo: number, timer: number) {
      const cx = px + 40;
      const cy = py + 40;
      const progresso = timer / FURACAO_DURACAO;
      const alpha = progresso < 0.1 ? progresso / 0.1
                  : progresso > 0.85 ? 1 - (progresso - 0.85) / 0.15
                  : 1;

      ctx.save();

      const numAneis = 5;
      for (let a = 0; a < numAneis; a++) {
        const raioAnel = FURACAO_ALCANCE * (0.3 + a * 0.16);
        const anguloOffset = angulo * (1 + a * 0.3) + (a * Math.PI * 2) / numAneis;
        const alphaAnel = alpha * (0.12 + a * 0.04);
        ctx.globalAlpha = alphaAnel;
        ctx.strokeStyle = a % 2 === 0 ? '#fde68a' : '#fbbf24';
        ctx.lineWidth = 3 - a * 0.4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, raioAnel, raioAnel * 0.45, anguloOffset, 0, Math.PI * 1.7);
        ctx.stroke();
      }

      const numParticulas = 18;
      for (let p = 0; p < numParticulas; p++) {
        const t = (p / numParticulas) * Math.PI * 2 + angulo * 2.5;
        const dist = FURACAO_ALCANCE * (0.5 + 0.5 * Math.sin(angulo * 3 + p));
        const px2 = cx + Math.cos(t) * dist;
        const py2 = cy + Math.sin(t) * dist * 0.5;
        const tamanho = 3 + Math.sin(angulo + p) * 2;
        ctx.globalAlpha = alpha * (0.4 + 0.4 * Math.abs(Math.sin(angulo * 2 + p)));
        ctx.fillStyle = p % 3 === 0 ? '#fef3c7' : p % 3 === 1 ? '#fcd34d' : '#ffffff';
        ctx.beginPath();
        ctx.arc(px2, py2, tamanho, 0, Math.PI * 2);
        ctx.fill();
      }

      const pulso = 0.7 + 0.3 * Math.sin(angulo * 4);
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, FURACAO_ALCANCE * pulso);
      glowGrad.addColorStop(0,   `rgba(253,230,138,${alpha * 0.55})`);
      glowGrad.addColorStop(0.3, `rgba(251,191,36,${alpha * 0.25})`);
      glowGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, FURACAO_ALCANCE * pulso, 0, Math.PI * 2);
      ctx.fill();

      const numLaminas = 3;
      for (let l = 0; l < numLaminas; l++) {
        const lAngulo = angulo * 3 + (l / numLaminas) * Math.PI * 2;
        const lDist = FURACAO_ALCANCE * 0.65;
        const lx = cx + Math.cos(lAngulo) * lDist;
        const ly = cy + Math.sin(lAngulo) * lDist * 0.6;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(lAngulo + Math.PI / 2);
        ctx.globalAlpha = alpha * 0.95;
        if (imgArmaGuerreiro) {
          ctx.drawImage(imgArmaGuerreiro, -22, -22, 44, 44);
        } else {
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#fde68a';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(0, -20); ctx.lineTo(10, 0); ctx.lineTo(0, 20); ctx.lineTo(-10, 0);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }

      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, FURACAO_ALCANCE, FURACAO_ALCANCE * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const segsRestantes = Math.ceil((FURACAO_DURACAO - timer) / 60);
      ctx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(angulo * 6));
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.fillText(`🌪 ${segsRestantes}s`, cx, cy - FURACAO_ALCANCE * 0.6 - 8);
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function desenharSlimeAliado(ctx: CanvasRenderingContext2D, a: SlimeAliado) {
      const cx = a.x + a.size / 2;
      const cy = a.y + a.size / 2;
      const r  = a.size / 2;
      const breathScale = 1 + Math.sin(a.breathe) * 0.07;
      const hitOffX = a.hitTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
      const hitOffY = a.hitTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
      if (a.hitTimer > 0) a.hitTimer--;

      ctx.save();
      ctx.translate(cx + hitOffX, cy + hitOffY);
      ctx.scale(breathScale, 2 - breathScale);

      ctx.save();
      ctx.scale(1, 0.2); ctx.translate(0, r * 4.5);
      const sg = ctx.createRadialGradient(0,0,0,0,0,r);
      sg.addColorStop(0,'rgba(88,28,135,0.5)'); sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath();
      ctx.ellipse(0,0,r*0.9,r*0.5,0,0,Math.PI*2); ctx.fill(); ctx.restore();

      const bg = ctx.createRadialGradient(-r*0.25,-r*0.25,r*0.05,0,0,r*1.2);
      bg.addColorStop(0,'#e879f9'); bg.addColorStop(0.35,'#7e22ce'); bg.addColorStop(1,'#3b0764');
      ctx.fillStyle = bg;
      ctx.shadowColor = '#c026d3'; ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(0,-r*0.9);
      ctx.bezierCurveTo(r*0.4,-r*1.0,r*0.85,-r*0.7,r*1.0,-r*0.1);
      ctx.bezierCurveTo(r*1.0,r*0.4,r*0.8,r*0.85,r*0.5,r*1.05);
      ctx.lineTo(r*0.3,r*0.85); ctx.lineTo(r*0.1,r*1.05);
      ctx.lineTo(-r*0.1,r*0.85); ctx.lineTo(-r*0.3,r*1.05); ctx.lineTo(-r*0.5,r*0.85);
      ctx.bezierCurveTo(-r*0.8,r*0.85,-r*1.0,r*0.4,-r*1.0,-r*0.1);
      ctx.bezierCurveTo(-r*0.85,-r*0.7,-r*0.4,-r*1.0,0,-r*0.9);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;

      const hl = ctx.createRadialGradient(-r*0.3,-r*0.4,0,-r*0.15,-r*0.25,r*0.5);
      hl.addColorStop(0,'rgba(255,255,255,0.45)'); hl.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.beginPath();
      ctx.ellipse(-r*0.25,-r*0.35,r*0.32,r*0.22,-0.4,0,Math.PI*2); ctx.fill();

      [-r*0.28, r*0.28].forEach(ox => {
        const oy = -r*0.25;
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath();
        ctx.ellipse(ox,oy,r*0.17,r*0.2,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e879f9'; ctx.beginPath();
        ctx.ellipse(ox,oy,r*0.11,r*0.14,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath();
        ctx.ellipse(ox,oy,r*0.04,r*0.12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath();
        ctx.arc(ox+r*0.05,oy-r*0.07,r*0.04,0,Math.PI*2); ctx.fill();
      });
      ctx.strokeStyle = '#fae8ff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r*0.35,r*0.18); ctx.bezierCurveTo(-r*0.15,r*0.32,r*0.15,r*0.32,r*0.35,r*0.18);
      ctx.stroke();

      ctx.restore();

      if (a.spawnTimer < 80) {
        const spawnProg = a.spawnTimer / 80;
        for (let p = 0; p < 5; p++) {
          const angle = (p / 5) * Math.PI * 2 + spawnProg * 6;
          const dist  = r * (0.8 + 0.5 * spawnProg);
          const px2   = cx + Math.cos(angle) * dist;
          const py2   = cy + Math.sin(angle) * dist - spawnProg * 40;
          ctx.globalAlpha = (1 - spawnProg) * 0.9;
          ctx.fillStyle   = p % 2 === 0 ? '#e879f9' : '#a855f7';
          ctx.shadowColor = '#c026d3'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(px2, py2, 4 - spawnProg*3, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        }
        if (spawnProg < 0.4) {
          ctx.globalAlpha = 1 - spawnProg * 2.5;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e879f9';
          ctx.shadowColor = '#7e22ce'; ctx.shadowBlur = 6;
          ctx.fillText('🩸 RESSUSCITADO', cx, cy - r - 14);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
        a.spawnTimer++;
      }

      const bw = a.size * 1.1;
      const bx2 = a.x - bw * 0.05;
      const by2 = a.y - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath();
      ctx.roundRect(bx2, by2, bw, 7, 4); ctx.fill();
      const hg = ctx.createLinearGradient(bx2, 0, bx2+bw, 0);
      hg.addColorStop(0,'#581c87'); hg.addColorStop(1,'#e879f9');
      ctx.fillStyle = hg; ctx.beginPath();
      ctx.roundRect(bx2, by2, bw * Math.max(0, a.hp/a.maxHp), 7, 4); ctx.fill();
      ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('👁 ALIADO', cx, by2 - 4);
    }

    // ─── CORTE DO SOMBRIO — arco brilhante de alcance médio guiado pelo mouse ──
    // Diferente do guerreiro (arco largo, curto, sweep animation):
    //   • Alcance: 150px (médio — 1.5x o do guerreiro)
    //   • Largura: 1.1 rad (~63°) — arco mais fino e preciso, estilo assassino
    //   • Visual: dois arcos concêntricos finos + linha central brilhante + partículas de energia
    //   • Animação: aparece instantâneo, fade elegante (sem sweep)
    function desenharCorteSombrio(px: number, py: number, anguloBase: number, timer: number, duracao: number) {
      const cx = px + 40;
      const cy = py + 40;
      const prog    = timer / duracao;
      // Fade: surge rápido (0→0.25) e some suave (0.25→1)
      const alpha   = prog < 0.25 ? prog / 0.25 : 1 - (prog - 0.25) / 0.75;

      const anguloInicio = anguloBase - CORTE_LARGURA / 2;
      const anguloFim    = anguloBase + CORTE_LARGURA / 2;

      ctx.save();
      ctx.translate(cx, cy);

      // ── Camada 1: glow exterior suave (roxo escuro) ──
      ctx.globalAlpha = alpha * 0.25;
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, CORTE_ALCANCE * 0.9, anguloInicio, anguloFim);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── Camada 2: arco médio (violeta) ──
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, CORTE_ALCANCE * 0.88, anguloInicio, anguloFim);
      ctx.stroke();

      // ── Camada 3: linha central brilhante (branco-lilás) ──
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#f0e6ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, CORTE_ALCANCE * 0.86, anguloInicio, anguloFim);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── Camada 4: arco interior menor (depth) ──
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, CORTE_ALCANCE * 0.68, anguloInicio, anguloFim);
      ctx.stroke();

      // ── Linhas de slash (2 riscos finos diagonais — estilo dagger) ──
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#e9d5ff';
      ctx.shadowBlur = 6;
      for (let s = 0; s < 2; s++) {
        const sa = anguloBase + (s - 0.5) * (CORTE_LARGURA * 0.55);
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * CORTE_ALCANCE * 0.25, Math.sin(sa) * CORTE_ALCANCE * 0.25);
        ctx.lineTo(Math.cos(sa) * CORTE_ALCANCE * 0.92, Math.sin(sa) * CORTE_ALCANCE * 0.92);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // ── Partículas de energia nas pontas do arco (sparkles) ──
      if (prog < 0.5) {
        const sparkAlpha = alpha * (1 - prog * 2);
        ctx.globalAlpha = sparkAlpha * 0.9;
        for (let s = 0; s < 2; s++) {
          const ang = s === 0 ? anguloInicio : anguloFim;
          const sx  = Math.cos(ang) * CORTE_ALCANCE * 0.87;
          const sy  = Math.sin(ang) * CORTE_ALCANCE * 0.87;
          ctx.fillStyle = '#f0abfc';
          ctx.shadowColor = '#c026d3';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
          // Mini faíscas saindo das pontas
          for (let k = 0; k < 3; k++) {
            const fang = ang + (k - 1) * 0.5 + (s === 0 ? -0.3 : 0.3);
            const flen = 10 + k * 6;
            ctx.strokeStyle = '#e879f9';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(fang) * flen, sy + Math.sin(fang) * flen);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }
      }

      // ── Imagem opcional do corte ──
      if (imgCorte) {
        ctx.globalAlpha = alpha;
        const sz = CORTE_ALCANCE * 1.1;
        ctx.rotate(anguloBase);
        ctx.drawImage(imgCorte, -sz * 0.4, -sz * 0.5, sz * 0.8, sz);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ─── BOSS FINAL — desenho monstruoso ────────────────────────────────────
    function desenharFinalBoss(ctx: CanvasRenderingContext2D, m: Monstro, tick: number) {
      const cx = m.x + m.size / 2;
      const cy = m.y + m.size / 2;
      const r  = m.size / 2;
      const breathScale = 1 + Math.sin(m.breathe) * 0.05;
      const hitOffX = m.hitTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
      const hitOffY = m.hitTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
      if (m.hitTimer > 0) m.hitTimer--;

      ctx.save();
      ctx.translate(cx + hitOffX, cy + hitOffY);
      ctx.scale(breathScale, 2 - breathScale);

      // ── 1. Aura de trevas pulsante (3 anéis concêntricos) ──
      for (let ring = 3; ring >= 1; ring--) {
        const rRing = r * (1.1 + ring * 0.35) + Math.sin(tick * 0.04 + ring) * 8;
        const auraGrad = ctx.createRadialGradient(0, 0, rRing * 0.5, 0, 0, rRing);
        auraGrad.addColorStop(0, `rgba(255,0,144,${0.04 * ring})`);
        auraGrad.addColorStop(0.6, `rgba(120,0,200,${0.06 * ring})`);
        auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath(); ctx.arc(0, 0, rRing, 0, Math.PI*2); ctx.fill();
      }

      // ── 2. Corpo principal (forma irregular, muito grande) ──
      const bodyGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.05, 0, 0, r*1.3);
      bodyGrad.addColorStop(0, '#3d0050');
      bodyGrad.addColorStop(0.3, '#0c0010');
      bodyGrad.addColorStop(0.7, '#020005');
      bodyGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 60;

      // Forma orgânica ameaçadora com tentáculos/espinhos
      ctx.beginPath();
      const numPontas = 12;
      for (let i = 0; i <= numPontas; i++) {
        const a = (i / numPontas) * Math.PI * 2 - Math.PI/2;
        const spike = i % 2 === 0 ? r * 1.15 : r * (0.7 + 0.2 * Math.sin(tick * 0.06 + i));
        const wobble = Math.sin(tick * 0.05 + i * 0.8) * 8;
        if (i === 0) ctx.moveTo(Math.cos(a) * (spike + wobble), Math.sin(a) * (spike + wobble));
        else ctx.lineTo(Math.cos(a) * (spike + wobble), Math.sin(a) * (spike + wobble));
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;

      // ── 3. Estrias de energia na pele (linhas brilhantes) ──
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(tick * 0.08);
      for (let v = 0; v < 8; v++) {
        const va = (v / 8) * Math.PI * 2 + tick * 0.01;
        ctx.strokeStyle = v % 2 === 0 ? '#ff0090' : '#9900ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(va) * r * 0.1, Math.sin(va) * r * 0.1);
        ctx.bezierCurveTo(
          Math.cos(va + 0.5) * r * 0.5, Math.sin(va + 0.5) * r * 0.5,
          Math.cos(va - 0.5) * r * 0.7, Math.sin(va - 0.5) * r * 0.7,
          Math.cos(va) * r * 0.95, Math.sin(va) * r * 0.95
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── 4. Olhos — 3 pares + 1 central enorme ──
      // Olho central: gigante, íris com fenda, com veias pulsando
      ctx.fillStyle = '#1a001a';
      ctx.beginPath(); ctx.ellipse(0, -r*0.15, r*0.55, r*0.42, 0, 0, Math.PI*2); ctx.fill();
      const irisGrad = ctx.createRadialGradient(0, -r*0.15, 0, 0, -r*0.15, r*0.35);
      irisGrad.addColorStop(0, '#ff0090');
      irisGrad.addColorStop(0.4, '#9900ff');
      irisGrad.addColorStop(0.8, '#ff6fff');
      irisGrad.addColorStop(1, '#ff0090');
      ctx.fillStyle = irisGrad;
      ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.ellipse(0, -r*0.15, r*0.35, r*0.32, 0, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // Pupila horizontal rasgada (predatório)
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, -r*0.15, r*0.28, r*0.06, 0, 0, Math.PI*2); ctx.fill();
      // Reflexo
      ctx.fillStyle = 'rgba(255,200,255,0.9)';
      ctx.beginPath(); ctx.arc(r*0.12, -r*0.28, r*0.07, 0, Math.PI*2); ctx.fill();
      // Veias no olho central
      ctx.strokeStyle = `rgba(255,0,144,${0.4 + 0.3*Math.sin(tick*0.1)})`;
      ctx.lineWidth = 1.5;
      for (let v = 0; v < 6; v++) {
        const va = (v/6)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(va)*r*0.35, -r*0.15 + Math.sin(va)*r*0.32);
        ctx.lineTo(Math.cos(va)*r*0.52, -r*0.15 + Math.sin(va)*r*0.4);
        ctx.stroke();
      }

      // Olhos secundários (4, em pares) — menores, frenéticos
      const olhoPos = [
        { x: -r*0.55, y: -r*0.52 }, { x: r*0.55, y: -r*0.52 },
        { x: -r*0.7, y: r*0.1 },    { x: r*0.7, y: r*0.1 },
      ];
      olhoPos.forEach((op, oi) => {
        ctx.fillStyle = '#0d000d';
        ctx.beginPath(); ctx.ellipse(op.x, op.y, r*0.14, r*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = oi % 2 === 0 ? '#ff0090' : '#cc00ff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(op.x, op.y, r*0.08, r*0.08, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(op.x, op.y, r*0.025, r*0.07, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ── 5. Boca ─ enorme, cheia de presas irregulares, escorrendo energia ──
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.ellipse(0, r*0.42, r*0.72, r*0.28, 0, 0, Math.PI); ctx.fill();
      // Presas superiores e inferiores
      const numPresas = 9;
      for (let t = 0; t < numPresas; t++) {
        const tx2 = (t/(numPresas-1) - 0.5) * r*1.3;
        const presaH = r * (t % 2 === 0 ? 0.28 : 0.18) + Math.sin(tick*0.08 + t)*4;
        ctx.fillStyle = t % 3 === 0 ? '#ff6fff' : '#e0aaff';
        ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 6;
        // Presa de cima
        ctx.beginPath();
        ctx.moveTo(tx2 - r*0.06, r*0.42);
        ctx.lineTo(tx2, r*0.42 + presaH);
        ctx.lineTo(tx2 + r*0.06, r*0.42);
        ctx.closePath(); ctx.fill();
        // Presa de baixo (menor)
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(tx2 - r*0.04, r*0.42 + presaH*0.1);
        ctx.lineTo(tx2, r*0.42 - presaH*0.4);
        ctx.lineTo(tx2 + r*0.04, r*0.42 + presaH*0.1);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      // Gosma de energia escorrendo da boca
      for (let g = 0; g < 5; g++) {
        const gx2 = (g/4 - 0.5)*r*1.1;
        const gLen = r*(0.15 + 0.1*Math.sin(tick*0.07 + g));
        const gGrad = ctx.createLinearGradient(gx2, r*0.7, gx2, r*0.7+gLen);
        gGrad.addColorStop(0, 'rgba(255,0,144,0.8)');
        gGrad.addColorStop(1, 'rgba(255,0,144,0)');
        ctx.fillStyle = gGrad;
        ctx.beginPath(); ctx.ellipse(gx2, r*0.7+gLen/2, r*0.04, gLen/2, 0, 0, Math.PI*2); ctx.fill();
      }

      // ── 6. Coroa de espinhos de energia no topo ──
      ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 15;
      for (let s = 0; s < 7; s++) {
        const sa = (-Math.PI/2) + (s-3)*0.22;
        const sLen = r*(s%2===0 ? 0.55 : 0.35) + Math.sin(tick*0.07+s)*6;
        const sx2 = Math.cos(sa)*r*0.85; const sy2 = Math.sin(sa)*r*0.85;
        const ex2 = Math.cos(sa)*(r*0.85+sLen); const ey2 = Math.sin(sa)*(r*0.85+sLen);
        const spkGrad = ctx.createLinearGradient(sx2, sy2, ex2, ey2);
        spkGrad.addColorStop(0, '#cc00ff'); spkGrad.addColorStop(1, '#ff0090');
        ctx.strokeStyle = spkGrad; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(ex2, ey2); ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.restore();

      // ── HP Bar do Boss Final (extra larga, roxa-magenta) ──
      const bw = m.size * 1.3;
      const bx2 = m.x - (bw - m.size)/2;
      const by2 = m.y - 28;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.roundRect(bx2, by2, bw, 11, 6); ctx.fill();
      const hpRatio = Math.max(0, m.hp / m.maxHp);
      const hpGradB = ctx.createLinearGradient(bx2, 0, bx2+bw, 0);
      hpGradB.addColorStop(0, '#4c0070'); hpGradB.addColorStop(0.4, '#cc00ff');
      hpGradB.addColorStop(0.7, '#ff0090'); hpGradB.addColorStop(1, '#ff6fff');
      ctx.fillStyle = hpGradB;
      ctx.beginPath(); ctx.roundRect(bx2, by2, bw * hpRatio, 11, 6); ctx.fill();
      // Borda brilhante
      ctx.strokeStyle = '#ff6fff'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(bx2, by2, bw, 11, 6); ctx.stroke();
      ctx.shadowBlur = 0;
      // Label
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6fff'; ctx.shadowColor = '#9900ff'; ctx.shadowBlur = 10;
      ctx.fillText('💀 BOSS FINAL 💀', cx, by2 - 6);
      ctx.shadowBlur = 0;
      // HP numérico
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#e9d5ff';
      ctx.fillText(`${Math.max(0,Math.floor(m.hp))} / ${m.maxHp}`, cx, by2 + 21);
    }
    // ─────────────────────────────────────────────────────────────────────────

        const gerarOnda = (onda: number): Monstro[] => {
      // ── BOSS FINAL — ONDA 10 ──────────────────────────────────────────────
      if (onda === 10) {
        return [{
          id: 9999,
          x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2,
          hp: 8000, maxHp: 8000, size: 280,
          cor: '#0c0010', corVariante: '#020005', corBrilho: '#ff0090', corOlho: '#ff6fff',
          isBoss: true, isFinalBoss: true,
          breathe: 0, breatheDir: 1, breatheSpeed: 0.01,
          hitTimer: 0, bubbletimer: 999,
          raioCooldown: 120, // começa a atacar logo
        }];
      }

      // ── MINI-BOSS — ONDA 5 ────────────────────────────────────────────────
      if (onda === 5) {
        return [{
          id: 999, x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT,
          hp: 1200, maxHp: 1200, size: 200,
          cor: '#7f1d1d', corVariante: '#1c0404', corBrilho: '#ef4444', corOlho: '#fecaca',
          isBoss: true,
          breathe: 0, breatheDir: 1, breatheSpeed: 0.018,
          hitTimer: 0, bubbletimer: 999
        }];
      }

      // ── ONDAS NORMAIS 1–4 e 6–9 ──────────────────────────────────────────
      const quantidade = 3 + (onda * 3); // escala mais rápido: onda1=6, 4=15, 9=30
      return Array.from({ length: quantidade }, (_, i) => {
        const paleta = SLIME_PALETAS[Math.floor(Math.random() * SLIME_PALETAS.length)];
        return {
          id: i,
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          hp: 25 + (onda * 25), maxHp: 25 + (onda * 25),
          size: 48 + (onda * 6),
          cor: paleta.base, corVariante: paleta.variante, corBrilho: paleta.brilho, corOlho: paleta.olho,
          breathe: Math.random() * Math.PI * 2,
          breatheDir: 1,
          breatheSpeed: 0.025 + Math.random() * 0.02,
          hitTimer: 0, bubbletimer: Math.floor(Math.random() * 80)
        };
      });
    };

    let monstros = gerarOnda(ondaAtual);

    const player = {
      x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2,
      speed: 3 + (status.agi * 0.15), size: 80,
      direcaoRad: 0,
      color: status.classe === 'mago' ? '#a855f7' : status.classe === 'guerreiro' ? '#ef4444' : '#10b981',
      cooldownAtaque: 0
    };

    const camera = { x: 0, y: 0 };
    const teclas: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => teclas[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => teclas[e.key.toLowerCase()] = false;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseCanvasRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    let tick = 0;
    let animationId: number;

    const render = () => {
      tick++;

      if (estadoJogo !== 'jogando') {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = estadoJogo === 'vitoria' ? '#fbbf24' : '#ef4444';
        ctx.font = 'bold 48px serif';
        ctx.fillText(estadoJogo === 'vitoria' ? '✨ VITÓRIA! ✨' : '💀 GAME OVER 💀', canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Recarregue a página (F5) para jogar novamente', canvas.width / 2, canvas.height / 2 + 45);
        return;
      }

      let dx = 0, dy = 0;
      if (teclas['w']) dy = -1; if (teclas['s']) dy = 1;
      if (teclas['a']) dx = -1; if (teclas['d']) dx = 1;
      if (dx !== 0 || dy !== 0) {
        const speedMult = (furacaoAtivo && status.classe === 'guerreiro') ? FURACAO_VELOCIDADE : 1;
        const nx = player.x + dx * player.speed * speedMult;
        const ny = player.y + dy * player.speed * speedMult;
        if (nx > 0 && nx < WORLD_WIDTH - player.size) player.x = nx;
        if (ny > 0 && ny < WORLD_HEIGHT - player.size) player.y = ny;
        player.direcaoRad = Math.atan2(dy, dx);
      }

      if (teclas[' '] && player.cooldownAtaque <= 0) {
        if (status.classe === 'guerreiro') {
          melee.ativo = true;
          melee.duracao = 20;
          melee.anguloAtual = player.direcaoRad - Math.PI / 2;
          player.cooldownAtaque = 30;
        } else if (status.classe === 'mago') {
          const mouseWorldX = mouseCanvasRef.current.x + camera.x;
          const mouseWorldY = mouseCanvasRef.current.y + camera.y;
          const anguloMouse = Math.atan2(
            mouseWorldY - (player.y + player.size / 2),
            mouseWorldX - (player.x + player.size / 2)
          );
          player.direcaoRad = anguloMouse;
          projectiles.push({
            x: player.x + player.size / 2, y: player.y + player.size / 2,
            vx: Math.cos(anguloMouse) * 15, vy: Math.sin(anguloMouse) * 15,
            tipo: 'mago', angulo: anguloMouse, dano: 15 + status.int,
          });
          player.cooldownAtaque = 15;
        } else {
          // ─── SOMBRIO: Projétil de corte guiado pelo mouse, alcance médio ────
          // Projétil roxo que percorre ~300px e some (alcance médio vs mago que vai até borda)
          const mouseWorldX = mouseCanvasRef.current.x + camera.x;
          const mouseWorldY = mouseCanvasRef.current.y + camera.y;
          const anguloMouse = Math.atan2(
            mouseWorldY - (player.y + player.size / 2),
            mouseWorldX - (player.x + player.size / 2)
          );
          player.direcaoRad = anguloMouse;
          projectiles.push({
            x: player.x + player.size / 2, y: player.y + player.size / 2,
            vx: Math.cos(anguloMouse) * 11, vy: Math.sin(anguloMouse) * 11,
            tipo: 'sombrio', angulo: anguloMouse, dano: CORTE_DANO,
          });
          player.cooldownAtaque = 18;
          // ─────────────────────────────────────────────────────────────────────
        }
      }
      if (player.cooldownAtaque > 0) player.cooldownAtaque--;

      // ─── HABILIDADE ESPECIAL DO MAGO: RAIO (tecla Z) ─────────────────────
      if (status.classe === 'mago') {
        if (teclas['z'] && raioCooldown <= 0 && !raioAtivo) {
          raioAlvo = {
            x: mouseCanvasRef.current.x + camera.x,
            y: mouseCanvasRef.current.y + camera.y,
          };
          raioAtivo  = true;
          raioTimer  = 0;
          raioCooldown = RAIO_COOLDOWN_MAX;

          monstros.forEach((m) => {
            const dx = (m.x + m.size / 2) - raioAlvo.x;
            const dy = (m.y + m.size / 2) - raioAlvo.y;
            if (Math.hypot(dx, dy) < RAIO_RAIO_AREA + m.size / 2) {
              m.hp -= RAIO_DANO;
              m.hitTimer = 12;
            }
          });
        }
        if (raioCooldown > 0) raioCooldown--;
      }

      // ─── HABILIDADE ESPECIAL DO GUERREIRO: FURACÃO (tecla Z) ──────────────
      if (status.classe === 'guerreiro') {
        if (teclas['z'] && furacaoCooldown <= 0 && !furacaoAtivo) {
          furacaoAtivo  = true;
          furacaoTimer  = 0;
          furacaoCooldown = FURACAO_COOLDOWN_MAX;
        }
        if (furacaoAtivo) {
          furacaoTimer++;
          furacaoAngulo += 0.18;

          monstros.forEach((m) => {
            const ddx = (m.x + m.size / 2) - (player.x + 40);
            const ddy = (m.y + m.size / 2) - (player.y + 40);
            if (Math.hypot(ddx, ddy) < FURACAO_ALCANCE + m.size / 2) {
              m.hp -= FURACAO_DANO_TICK;
              m.hitTimer = 3;
              const dist = Math.max(1, Math.hypot(ddx, ddy));
              m.x += (ddx / dist) * 2.5;
              m.y += (ddy / dist) * 2.5;
            }
          });

          if (furacaoTimer >= FURACAO_DURACAO) {
            furacaoAtivo = false;
          }
        }
        if (furacaoCooldown > 0) furacaoCooldown--;
      }

      // ─── HABILIDADE ESPECIAL DO SOMBRIO: RESSURREIÇÃO (tecla Z) ───────────
      if (status.classe === 'sombrio') {
        if (teclas['z'] && ressurrCooldown <= 0 && killsAcumulados >= RESSURR_KILLS_NEEDED) {
          const paraInvocar = monstrosMortos.splice(0, RESSURR_MAX_ALIADOS);
          paraInvocar.forEach((m, i) => {
            const anguloSpawn = (i / Math.max(1, paraInvocar.length)) * Math.PI * 2;
            const distSpawn = 80 + i * 20;
            slimesAliados.push({
              id: Date.now() + i,
              x: player.x + Math.cos(anguloSpawn) * distSpawn,
              y: player.y + Math.sin(anguloSpawn) * distSpawn,
              hp: m.maxHp, maxHp: m.maxHp,
              size: m.size,
              breathe: Math.random() * Math.PI * 2,
              breatheSpeed: 0.03,
              hitTimer: 0,
              anguloAtaque: 0,
              cooldownAtaque: 0,
              spawnTimer: 0,
            });
          });
          killsAcumulados  = 0;
          ressurrCooldown  = RESSURR_COOLDOWN_MAX;
        }
        if (ressurrCooldown > 0) ressurrCooldown--;

        slimesAliados.forEach((a, ai) => {
          a.breathe += a.breatheSpeed;
          if (a.cooldownAtaque > 0) a.cooldownAtaque--;

          let alvoIdx = -1; let menorDist = Infinity;
          monstros.forEach((m, mi) => {
            const d = Math.hypot((m.x+m.size/2)-(a.x+a.size/2), (m.y+m.size/2)-(a.y+a.size/2));
            if (d < menorDist) { menorDist = d; alvoIdx = mi; }
          });

          if (alvoIdx >= 0) {
            const alvo = monstros[alvoIdx];
            const adx = (alvo.x+alvo.size/2)-(a.x+a.size/2);
            const ady = (alvo.y+alvo.size/2)-(a.y+a.size/2);
            const ad  = Math.max(1, Math.hypot(adx, ady));
            a.anguloAtaque = Math.atan2(ady, adx);

            if (ad > ALIADO_ALCANCE) {
              a.x += (adx / ad) * 1.8;
              a.y += (ady / ad) * 1.8;
            }
            if (ad < ALIADO_ALCANCE + alvo.size/2 && a.cooldownAtaque <= 0) {
              alvo.hp -= ALIADO_DANO;
              alvo.hitTimer = 6;
              a.cooldownAtaque = ALIADO_ATAQUE_CD;
            }
          }

          if (a.hp <= 0) slimesAliados.splice(ai, 1);
        });
      }

      if (monstros.length === 0) {
        if (ondaAtual < 10) { ondaAtual++; monstros = gerarOnda(ondaAtual); raioBossArr.length = 0; }
        else { estadoJogo = 'vitoria'; }
      }

      camera.x = Math.max(0, Math.min(player.x + player.size / 2 - canvas.width / 2, WORLD_WIDTH - canvas.width));
      camera.y = Math.max(0, Math.min(player.y + player.size / 2 - canvas.height / 2, WORLD_HEIGHT - canvas.height));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      if (imgCenarioJogo) {
        const ptrn = ctx.createPattern(imgCenarioJogo, 'repeat');
        if (ptrn) { ctx.fillStyle = ptrn; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); }
      } else {
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      }

      monstros.forEach((m, idx) => {
        m.breathe += m.breatheSpeed;

        const playerDist = Math.hypot(player.x - m.x, player.y - m.y);
        let alvoX = player.x, alvoY = player.y, alvoMinDist = playerDist;
        let alvoEhAliado = false; let alvoAliadoIdx = -1;

        slimesAliados.forEach((a, ai) => {
          const ad = Math.hypot(a.x - m.x, a.y - m.y);
          if (ad < alvoMinDist) { alvoMinDist = ad; alvoX = a.x; alvoY = a.y; alvoEhAliado = true; alvoAliadoIdx = ai; }
        });

        if (alvoMinDist < 1200) {
          const vel = m.isFinalBoss ? 0.003 : m.isBoss ? 0.005 : 0.01;
          m.x += (alvoX - m.x) * vel;
          m.y += (alvoY - m.y) * vel;

          if (!alvoEhAliado) {
            if (playerDist < (m.isFinalBoss ? 140 : m.isBoss ? 100 : 40)) {
              playerHp -= (m.isFinalBoss ? 3 : m.isBoss ? 2 : 0.5);
              if (playerHp <= 0) estadoJogo = 'gameover';
            }
          } else if (alvoAliadoIdx >= 0) {
            if (alvoMinDist < (m.isBoss ? 100 : 40)) {
              slimesAliados[alvoAliadoIdx].hp -= (m.isBoss ? 1.5 : 0.4);
            }
          }
        }

        // ── Boss Final: dispara raios teleguiados (desviáveis) ────────────────
        if (m.isFinalBoss) {
          if (m.raioCooldown === undefined) m.raioCooldown = RAIO_BOSS_COOLDOWN;
          m.raioCooldown--;
          if (m.raioCooldown <= 0) {
            m.raioCooldown = RAIO_BOSS_COOLDOWN;
            // Dispara 3 raios em leque
            for (let r2 = 0; r2 < 3; r2++) {
              const spread = (r2 - 1) * 0.4;
              const ang = Math.atan2(
                (player.y + 40) - (m.y + m.size/2),
                (player.x + 40) - (m.x + m.size/2)
              ) + spread;
              raioBossArr.push({
                x: m.x + m.size/2, y: m.y + m.size/2,
                vx: Math.cos(ang) * RAIO_BOSS_VEL,
                vy: Math.sin(ang) * RAIO_BOSS_VEL,
                angulo: ang,
                vida: RAIO_BOSS_VIDA,
                homingTimer: 0,
              });
            }
          }
        }

        if (m.isFinalBoss) {
          desenharFinalBoss(ctx, m, tick);
        } else {
          desenharSlime(ctx, m, tick);
        }

        if (melee.ativo) {
          const mDist = Math.hypot((player.x + player.size / 2) - (m.x + m.size / 2), (player.y + player.size / 2) - (m.y + m.size / 2));
          if (mDist < (m.isBoss ? 150 : 100)) {
            m.hp -= 2;
            m.hitTimer = 6;
            if (!m.isBoss) { m.x += Math.cos(player.direcaoRad) * 10; m.y += Math.sin(player.direcaoRad) * 10; }
          }
        }

        // ── Corte do Sombrio: hitbox em arco médio guiado pelo mouse ──
        if (status.classe === 'sombrio' && corte.ativo) {
          const cdx = (m.x+m.size/2) - (player.x+40);
          const cdy = (m.y+m.size/2) - (player.y+40);
          const cd  = Math.hypot(cdx, cdy);
          if (cd < CORTE_ALCANCE + m.size/2) {
            const angAlvo = Math.atan2(cdy, cdx);
            let diff = angAlvo - corte.anguloBase;
            while (diff > Math.PI) diff -= Math.PI*2;
            while (diff < -Math.PI) diff += Math.PI*2;
            if (Math.abs(diff) < CORTE_LARGURA / 2) {
              m.hp -= CORTE_DANO * (1 / corte.duracao);
              m.hitTimer = 4;
            }
          }
        }

        if (m.hp <= 0) {
          if (!m.isBoss && status.classe === 'sombrio') {
            monstrosMortos.unshift({ hp: m.maxHp, maxHp: m.maxHp, size: m.size, x: m.x, y: m.y });
            if (monstrosMortos.length > RESSURR_MAX_ALIADOS) monstrosMortos.pop();
            if (killsAcumulados < RESSURR_KILLS_NEEDED) killsAcumulados++;
          }
          monstros.splice(idx, 1);
        }
      });

      // ─── Raios do Boss Final: move, homing suave, colisão, desenho ───────────
      raioBossArr.forEach((rb, ri) => {
        rb.vida--;
        rb.homingTimer++;
        // Homing suave a cada 10 frames (dá tempo de desviar)
        if (rb.homingTimer >= 10) {
          rb.homingTimer = 0;
          const tx = player.x + 40; const ty = player.y + 40;
          const da = Math.atan2(ty - rb.y, tx - rb.x);
          // Gira suavemente até a direção do player
          let diff = da - rb.angulo;
          while (diff > Math.PI) diff -= Math.PI*2;
          while (diff < -Math.PI) diff += Math.PI*2;
          rb.angulo += diff * 0.22; // giro lento — dá pra desviar
          rb.vx = Math.cos(rb.angulo) * RAIO_BOSS_VEL;
          rb.vy = Math.sin(rb.angulo) * RAIO_BOSS_VEL;
        }
        rb.x += rb.vx; rb.y += rb.vy;

        // Colisão com player
        const rdist = Math.hypot(rb.x - (player.x+40), rb.y - (player.y+40));
        if (rdist < 28) {
          playerHp -= RAIO_BOSS_DANO;
          if (playerHp <= 0) estadoJogo = 'gameover';
          raioBossArr.splice(ri, 1);
          return;
        }

        // Remove se acabou a vida ou saiu do mundo
        if (rb.vida <= 0 || rb.x < 0 || rb.x > WORLD_WIDTH || rb.y < 0 || rb.y > WORLD_HEIGHT) {
          raioBossArr.splice(ri, 1);
          return;
        }

        // ── Desenha o raio do boss ──
        const alpha = Math.min(1, rb.vida / 20); // fade out nos últimos 20 frames
        ctx.save();
        ctx.globalAlpha = alpha;
        // Trilha de glow
        ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 22;
        ctx.strokeStyle = 'rgba(255,0,144,0.3)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(rb.x - rb.vx*4, rb.y - rb.vy*4);
        ctx.lineTo(rb.x, rb.y);
        ctx.stroke();
        // Núcleo
        ctx.strokeStyle = '#ff6fff'; ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(rb.x - rb.vx*3, rb.y - rb.vy*3);
        ctx.lineTo(rb.x, rb.y);
        ctx.stroke();
        // Centro branco
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(rb.x - rb.vx*2, rb.y - rb.vy*2);
        ctx.lineTo(rb.x, rb.y);
        ctx.stroke();
        // Ponta brilhante
        ctx.fillStyle = '#ff6fff'; ctx.shadowColor = '#ff0090'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(rb.x, rb.y, 6, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.restore();
      });
      // ─────────────────────────────────────────────────────────────────────────

      projectiles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;

        // Sombrio: projétil com alcance médio — desenhar como arco roxo brilhante
        if (p.tipo === 'sombrio') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angulo);
          // Glow exterior roxo
          ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 14; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, 10, -0.55, 0.55); ctx.stroke();
          // Arco médio violeta
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, 9, -0.5, 0.5); ctx.stroke();
          // Linha brilhante central
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 8, -0.45, 0.45); ctx.stroke();
          // Risco central
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(14, 0); ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          ctx.restore();
          // Alcance médio: ~300px de percurso antes de sumir
          if (!('dist' in p)) (p as any).dist = 0;
          (p as any).dist += Math.hypot(p.vx, p.vy);
          if ((p as any).dist > 300) { projectiles.splice(i, 1); return; }
        } else {
          const imgProjetil = p.tipo === 'mago' ? imgArmaMago : null;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angulo);
          if (imgProjetil) ctx.drawImage(imgProjetil, -20, -20, 40, 40);
          ctx.restore();
        }

        monstros.forEach(m => {
          if (p.x > m.x && p.x < m.x + m.size && p.y > m.y && p.y < m.y + m.size) {
            m.hp -= p.dano / 5;
            m.hitTimer = 6;
            projectiles.splice(i, 1);
          }
        });
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) projectiles.splice(i, 1);
      });

      if (melee.ativo) {
        melee.duracao--;
        melee.anguloAtual += Math.PI / 20;
        ctx.save();
        ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
        ctx.rotate(melee.anguloAtual);
        if (imgArmaGuerreiro) ctx.drawImage(imgArmaGuerreiro, 45, -35, 70, 70);
        ctx.strokeStyle = 'rgba(251,191,36,0.25)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 75, melee.anguloAtual - Math.PI * 0.6, melee.anguloAtual);
        ctx.stroke();
        ctx.restore();
        if (melee.duracao <= 0) melee.ativo = false;
      }

      if (raioAtivo) {
        raioTimer++;
        const prog = raioTimer / RAIO_DURACAO;
        desenharRaio(raioAlvo.x, raioAlvo.y, prog);
        if (raioTimer >= RAIO_DURACAO) raioAtivo = false;
      }

      if (furacaoAtivo && status.classe === 'guerreiro') {
        desenharFuracao(player.x, player.y, furacaoAngulo, furacaoTimer);
      }

      slimesAliados.forEach(a => desenharSlimeAliado(ctx, a));

      // ─── Corte do Sombrio ─────────────────────────────────────────────────
      if (status.classe === 'sombrio' && corte.ativo) {
        corte.timer++;
        desenharCorteSombrio(player.x, player.y, corte.anguloBase, corte.timer, corte.duracao);
        if (corte.timer >= corte.duracao) corte.ativo = false;
      }

      if (imgPlayer) {
        ctx.drawImage(imgPlayer, player.x, player.y, player.size, player.size);
      } else {
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.size, player.size);
      }

      ctx.restore();

      // UI — HP Bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(18, canvas.height - 44, 204, 22, 6);
      ctx.fill();
      const hpGrad = ctx.createLinearGradient(20, 0, 220, 0);
      hpGrad.addColorStop(0, '#7f1d1d');
      hpGrad.addColorStop(0.5, '#ef4444');
      hpGrad.addColorStop(1, '#fca5a5');
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(20, canvas.height - 42, (Math.max(0, playerHp) / status.hpMax) * 200, 18, 5);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`❤ ${Math.floor(Math.max(0, playerHp))} / ${status.hpMax}`, 26, canvas.height - 29);

      // UI — Onda
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = ondaAtual === 10 ? '#ff6fff' : ondaAtual === 5 ? '#fca5a5' : '#e2e8f0';
      ctx.shadowColor = ondaAtual === 10 ? '#ff0090' : ondaAtual === 5 ? '#dc2626' : '#7c3aed';
      ctx.shadowBlur = ondaAtual === 10 ? 20 : 12;
      ctx.fillText(ondaAtual === 10 ? '💀 BOSS FINAL !! 💀' : ondaAtual === 5 ? '⚠ ONDA 5 — MINI-BOSS ⚠' : `⚔ ONDA ${ondaAtual} / 10`, 20, 38);
      ctx.shadowBlur = 0;

      // UI — Habilidade especial do Mago
      if (status.classe === 'mago') {
        const cdRatio = raioCooldown / RAIO_COOLDOWN_MAX;
        const pronto  = raioCooldown <= 0;
        const btnX = canvas.width - 74;
        const btnY = canvas.height - 74;
        const btnSize = 58;

        ctx.fillStyle = pronto ? 'rgba(126,34,206,0.85)' : 'rgba(20,10,40,0.85)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnSize, btnSize, 10);
        ctx.fill();

        ctx.strokeStyle = pronto ? '#e879f9' : '#4c1d95';
        ctx.lineWidth = pronto ? 2.5 : 1.5;
        if (pronto) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 12; }
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnSize, btnSize, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (!pronto) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnSize, btnSize * cdRatio, 10);
          ctx.fill();
        }

        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = pronto ? '#f0abfc' : '#7c3aed';
        ctx.fillText('⚡', btnX + btnSize / 2, btnY + 36);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = pronto ? '#fae8ff' : '#6b21a8';
        ctx.fillText('[Z]', btnX + btnSize / 2, btnY + 52);

        if (!pronto) {
          const segsRestantes = Math.ceil(raioCooldown / 60);
          ctx.font = 'bold 16px monospace';
          ctx.fillStyle = '#e9d5ff';
          ctx.fillText(`${segsRestantes}s`, btnX + btnSize / 2, btnY + 22);
        }
      }

      // UI — Habilidade especial do Guerreiro
      if (status.classe === 'guerreiro') {
        const cdRatio = furacaoCooldown / FURACAO_COOLDOWN_MAX;
        const pronto  = furacaoCooldown <= 0 && !furacaoAtivo;
        const ativo   = furacaoAtivo;
        const btnX = canvas.width - 74;
        const btnY = canvas.height - 74;
        const btnSize = 58;

        ctx.fillStyle = ativo   ? 'rgba(180,83,9,0.92)'
                      : pronto  ? 'rgba(146,64,14,0.88)'
                      :           'rgba(20,10,5,0.85)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnSize, btnSize, 10);
        ctx.fill();

        ctx.strokeStyle = ativo  ? '#fbbf24'
                        : pronto ? '#f59e0b'
                        :          '#78350f';
        ctx.lineWidth = ativo || pronto ? 2.5 : 1.5;
        if (ativo || pronto) {
          ctx.shadowColor = ativo ? '#fde68a' : '#f59e0b';
          ctx.shadowBlur = ativo ? 18 : 10;
        }
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnSize, btnSize, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (!pronto && !ativo) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnSize, btnSize * cdRatio, 10);
          ctx.fill();
        }

        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ativo ? '#fde68a' : pronto ? '#fbbf24' : '#92400e';
        ctx.fillText('🌪', btnX + btnSize / 2, btnY + 34);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = ativo ? '#fef9c3' : pronto ? '#fef3c7' : '#78350f';
        ctx.fillText('[Z]', btnX + btnSize / 2, btnY + 52);

        if (ativo) {
          const segsAtivo = Math.ceil((FURACAO_DURACAO - furacaoTimer) / 60);
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = '#fde68a';
          ctx.fillText(`${segsAtivo}s`, btnX + btnSize / 2, btnY + 20);
        } else if (!pronto) {
          const segsCD = Math.ceil(furacaoCooldown / 60);
          ctx.font = 'bold 16px monospace';
          ctx.fillStyle = '#fcd34d';
          ctx.fillText(`${segsCD}s`, btnX + btnSize / 2, btnY + 20);
        }
      }

      // UI — Habilidade especial do Sombrio
      if (status.classe === 'sombrio') {
        const prontoParaUsar = ressurrCooldown <= 0 && killsAcumulados >= RESSURR_KILLS_NEEDED;
        const cdRatio   = ressurrCooldown / RESSURR_COOLDOWN_MAX;
        const btnX = canvas.width - 74;
        const btnY = canvas.height - 74;
        const btnSize = 58;

        ctx.fillStyle = prontoParaUsar ? 'rgba(88,28,135,0.92)' : 'rgba(15,5,25,0.88)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 10); ctx.fill();

        ctx.strokeStyle = prontoParaUsar ? '#e879f9' : '#4c1d95';
        ctx.lineWidth = prontoParaUsar ? 2.5 : 1.5;
        if (prontoParaUsar) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 10); ctx.stroke();
        ctx.shadowBlur = 0;

        if (!prontoParaUsar && ressurrCooldown > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize * cdRatio, 10); ctx.fill();
        }

        ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = prontoParaUsar ? '#e879f9' : '#7c3aed';
        ctx.fillText('💀', btnX + btnSize/2, btnY + 34);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = prontoParaUsar ? '#fae8ff' : '#581c87';
        ctx.fillText('[Z]', btnX + btnSize/2, btnY + 52);

        if (ressurrCooldown > 0) {
          ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d8b4fe';
          ctx.fillText(`${Math.ceil(ressurrCooldown/60)}s`, btnX + btnSize/2, btnY + 18);
        }

        const slotSize = 10; const slotGap = 3;
        const totalW = RESSURR_KILLS_NEEDED * (slotSize + slotGap) - slotGap;
        const slotStartX = btnX + (btnSize - totalW) / 2;
        const slotY = btnY - 18;
        for (let k = 0; k < RESSURR_KILLS_NEEDED; k++) {
          const filled = k < killsAcumulados;
          ctx.fillStyle = filled ? '#a855f7' : 'rgba(100,50,150,0.3)';
          if (filled) { ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 6; }
          ctx.beginPath();
          ctx.roundRect(slotStartX + k*(slotSize+slotGap), slotY, slotSize, slotSize, 3);
          ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#c084fc';
        ctx.fillText(`${killsAcumulados}/${RESSURR_KILLS_NEEDED} KILLS`, btnX + btnSize/2, slotY - 3);

        if (slimesAliados.length > 0) {
          ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#e879f9';
          ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 4;
          ctx.fillText(`👁 ${slimesAliados.length} ALIADO${slimesAliados.length > 1 ? 'S' : ''}`, btnX + btnSize/2, btnY - 32);
          ctx.shadowBlur = 0;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [carregado, status, imgPlayer, imgArmaGuerreiro, imgArmaMago, imgArmaSombrio, imgRaioImpacto, imgCorte, imgCenarioJogo]);

  return (
    <main className="relative min-h-screen bg-black flex flex-col items-center justify-center font-serif text-white overflow-hidden">
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-80 pointer-events-none"
        style={{ backgroundImage: "url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl">
          MODO COMBATE | {status.nome} | CLASSE: {status.classe.toUpperCase()}
        </div>
        <canvas ref={canvasRef} width={900} height={600} className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">WASD mover · ESPAÇO atacar · {status.classe === 'mago' ? 'Z = Raio Arcano (mire com o mouse) · ' : status.classe === 'guerreiro' ? 'Z = Furacão (5s de redemoinho devastador) · ' : status.classe === 'sombrio' ? 'Z = Ressurreição (mate 5 inimigos para ativar) · ' : ''}Sobreviva até a onda 5.</p>
      </div>
    </main>
  );
}
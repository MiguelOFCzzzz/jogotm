'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Projetil      = { x:number; y:number; vx:number; vy:number; tipo:string; angulo:number; dano:number; dp?:number };
type AtaqueMelee   = { ativo:boolean; anguloAtual:number; duracao:number; dano:number };
type Monstro = {
  id:number; x:number; y:number; hp:number; maxHp:number; size:number;
  cor:string; isBoss?:boolean; isFinalBoss?:boolean;
  breathe:number; breatheDir:number; breatheSpeed:number;
  corVariante:string; corBrilho:string; corOlho:string;
  hitTimer:number; bubbletimer:number; raioCooldown?:number;
};
type RaioBoss      = { x:number; y:number; vx:number; vy:number; angulo:number; vida:number; homingTimer:number };
type SlimeAliado   = { id:number; x:number; y:number; hp:number; maxHp:number; size:number; breathe:number; breatheSpeed:number; hitTimer:number; anguloAtaque:number; cooldownAtaque:number; spawnTimer:number };
type MonstroMorto  = { hp:number; maxHp:number; size:number; x:number; y:number };
type SlashDomain   = { x:number; y:number; angulo:number; vel:number; vida:number; maxVida:number; tipo:'dismantle'|'cleave'; comprimento:number };
type ParticulaDomain = { x:number; y:number; vx:number; vy:number; vida:number; maxVida:number; r:number; cor:string };
type ExplosaoArea  = { x:number; y:number; timer:number; maxTimer:number };
type JogadorRemoto = { id:string; nome:string; classe:string; x:number; y:number; hp:number; hpMax:number; direcaoRad:number };
type Classe = 'guerreiro'|'mago'|'sombrio';
type Status = { nome:string; classe:string; str:number; agi:number; int:number; vit:number; hpMax:number };

const SLIME_PALETAS = [
  { base:'#7f1d1d', variante:'#450a0a', brilho:'#ef4444', olho:'#fca5a5' },
  { base:'#14532d', variante:'#052e16', brilho:'#4ade80', olho:'#bbf7d0' },
  { base:'#1e1b4b', variante:'#0f0a2e', brilho:'#818cf8', olho:'#c7d2fe' },
  { base:'#78350f', variante:'#431407', brilho:'#fb923c', olho:'#fed7aa' },
  { base:'#164e63', variante:'#083344', brilho:'#22d3ee', olho:'#a5f3fc' },
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
    mago:      'https://pngimg.com/uploads/wizard/wizard_PNG18.png',
    sombrio:   'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/6c3d567d-af2b-469e-b10c-d5b135964ab2/dg06u31-77d706fb-6721-4a63-9fa3-a41bd55079d2.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi82YzNkNTY3ZC1hZjJiLTQ2OWUtYjEwYy1kNWIxMzU5NjRhYjIvZGcwNnUzMS03N2Q3MDZmYi02NzIxLTRhNjMtOWZhMy1hNDFiZDU1MDc5ZDIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5GyTWvKNS9dRXrc3pTv-MOq1Lbhnj8sk3CcXhxPUx88',
  };
  const imgPlayer    = useImagem(LINKS[status.classe] ?? null);
  const imgArmaGuerr = useImagem('https://png.pngtree.com/png-clipart/20211018/ourmid/pngtree-fire-burning-realistic-red-flame-png-image_3977689.png');
  const imgArmaMago  = useImagem('https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png');
  const imgCenario   = useImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg');
  const imgGuerreiro = useImagem(LINKS.guerreiro);
  const imgMago      = useImagem(LINKS.mago);
  const imgSombrio   = useImagem(LINKS.sombrio);

  useEffect(() => {
    // Conecta ao server.js na porta 3001
    const s = io('http://localhost:3001', { transports: ['websocket'] });
    socketRef.current = s;

    const codigoSala = typeof window !== 'undefined' ? (localStorage.getItem('glory_dark_sala') || 'default') : 'default';

    s.on('connect', () => {
      setOnline(true);
      // Entra no mapa com os dados do personagem
      s.emit('entrar_no_jogo', {
        codigo: codigoSala,
        nome: status.nome,
        classe: status.classe,
        x: 1500, y: 1000,
      });
    });
    s.on('disconnect', () => setOnline(false));

    // Lista inicial de jogadores na sala
    s.on('lista_jogadores', (lista: JogadorRemoto[]) => {
      lista.forEach(j => { if (j.id !== s.id) remotosRef.current[j.id] = j; });
      setQtJog(1 + Object.keys(remotosRef.current).length);
    });
    // Novo jogador entrou
    s.on('novo_jogador_conectado', (j: JogadorRemoto) => {
      remotosRef.current[j.id] = j;
      setQtJog(q => q + 1);
    });
    // Movimento de outro jogador
    s.on('jogador_moveu', (d: { id:string; x:number; y:number; direcaoRad:number }) => {
      if (remotosRef.current[d.id]) {
        remotosRef.current[d.id].x = d.x;
        remotosRef.current[d.id].y = d.y;
        remotosRef.current[d.id].direcaoRad = d.direcaoRad;
      }
    });
    // HP sync
    s.on('hp_jogador', (d: { id:string; hp:number; hpMax:number }) => {
      if (remotosRef.current[d.id]) {
        remotosRef.current[d.id].hp    = d.hp;
        remotosRef.current[d.id].hpMax = d.hpMax;
      }
    });
    // Jogador saiu
    s.on('jogador_saiu', (id: string) => {
      delete remotosRef.current[id];
      setQtJog(q => Math.max(1, q - 1));
    });

    return () => { s.disconnect(); };
  }, [status.nome, status.classe]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    // desativa anti-aliasing para performance
    ctx.imageSmoothingEnabled = false;

    const cl = status.classe; // string — sem cast, sem erro TS2367

    const projectiles: Projetil[] = [];
    let melee: AtaqueMelee = { ativo:false, anguloAtual:0, duracao:0, dano: 20 + status.str };
    let playerHp = status.hpMax, ondaAtual = 1;
    let estadoJogo: 'jogando'|'vitoria'|'gameover' = 'jogando';

    // Ryōiki Tenkai
    let ryoikiLimpouOnda = false, ryoikiDelayTimer = 0;
    const RYOIKI_DELAY = 120;

    const RAIO_CD_MAX=600, RAIO_DANO=120+status.int*3, RAIO_AREA=120, RAIO_DUR=40;
    let raioCooldown=0, raioAtivo=false, raioTimer=0, raioAlvo={x:0,y:0};

    const FUR_CD_MAX=900, FUR_DUR=300, FUR_DANO_TICK=4, FUR_ALCANCE=160, FUR_VEL=2.0;
    let furacaoCooldown=0, furacaoAtivo=false, furacaoTimer=0, furacaoAngulo=0;

    const RYO_CD_MAX=14400, RYO_DUR=600, RYO_SLASH_INT=8;
    let ryoikiCooldown=0, ryoikiAtivo=false, ryoikiTimer=0;
    let slashesDomain: SlashDomain[]=[], particulasDomain: ParticulaDomain[]=[];

    const RAIO_BOSS_CD=180, RAIO_BOSS_DANO=35, RAIO_BOSS_VEL=7, RAIO_BOSS_VIDA=180;
    let raioBossArr: RaioBoss[]=[];

    const RESSURR_CD_MAX=1800, KILLS_NEEDED=5, MAX_ALIADOS=5;
    const ALIADO_DANO=8, ALIADO_ALCANCE=55, ALIADO_CD=40;
    let ressurrCooldown=0, killsAcum=0;
    let aliados: SlimeAliado[]=[], mortos: MonstroMorto[]=[];
    type CorteSomb = { ativo:boolean; timer:number; duracao:number; anguloBase:number };
    let corte: CorteSomb = { ativo:false, timer:0, duracao:14, anguloBase:0 };
    const CORTE_ALC=150, CORTE_LARG=1.1, CORTE_DANO=18+status.agi;
    const SOMB_ALC=320, SOMB_AREA=80;
    let explosoesArea: ExplosaoArea[]=[];
    let syncMovTick=0;

    // cache de padrão do cenário (evita recriar todo frame)
    let cenarioPtrn: CanvasPattern | null = null;
    if (imgCenario) cenarioPtrn = ctx.createPattern(imgCenario, 'repeat');

    const gerarOnda = (onda: number): Monstro[] => {
      if (onda === 10) return [{ id:9999, x:WORLD_WIDTH/2, y:WORLD_HEIGHT/2, hp:8000, maxHp:8000, size:280, cor:'#0c0010', corVariante:'#020005', corBrilho:'#ff0090', corOlho:'#ff6fff', isBoss:true, isFinalBoss:true, breathe:0, breatheDir:1, breatheSpeed:.01, hitTimer:0, bubbletimer:999, raioCooldown:120 }];
      if (onda === 5)  return [{ id:999, x:Math.random()*WORLD_WIDTH, y:Math.random()*WORLD_HEIGHT, hp:1200, maxHp:1200, size:200, cor:'#7f1d1d', corVariante:'#1c0404', corBrilho:'#ef4444', corOlho:'#fecaca', isBoss:true, breathe:0, breatheDir:1, breatheSpeed:.018, hitTimer:0, bubbletimer:999 }];
      const qt = 3 + onda * 3;
      return Array.from({ length: qt }, (_, i) => {
        const p = SLIME_PALETAS[Math.floor(Math.random() * SLIME_PALETAS.length)];
        return { id:i, x:Math.random()*WORLD_WIDTH, y:Math.random()*WORLD_HEIGHT, hp:25+onda*25, maxHp:25+onda*25, size:48+onda*6, cor:p.base, corVariante:p.variante, corBrilho:p.brilho, corOlho:p.olho, breathe:Math.random()*Math.PI*2, breatheDir:1, breatheSpeed:.025+Math.random()*.02, hitTimer:0, bubbletimer:Math.floor(Math.random()*80) };
      });
    };
    let monstros = gerarOnda(ondaAtual);

    const player = { x:WORLD_WIDTH/2, y:WORLD_HEIGHT/2, speed:3+status.agi*.15, size:80, direcaoRad:0, color:cl==='mago'?'#a855f7':cl==='guerreiro'?'#ef4444':'#10b981', cooldownAtaque:0 };
    const camera = { x:0, y:0 };
    const teclas: Record<string,boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = true; };
    const onKeyUp   = (e: KeyboardEvent) => { teclas[e.key.toLowerCase()] = false; };
    const onMouse   = (e: MouseEvent)    => { const r=canvas.getBoundingClientRect(); mouseRef.current={x:e.clientX-r.left,y:e.clientY-r.top}; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('mousemove', onMouse);

    let tick=0, animId=0;

    // ═══════════════════════════════════════════════════
    // DRAW HELPERS — shadowBlur só onde essencial, gradientes cacheados quando possível
    // ═══════════════════════════════════════════════════

    function desenharJogadorRemoto(jr: JogadorRemoto) {
      const imgMap: Record<string, HTMLImageElement|null> = { guerreiro:imgGuerreiro, mago:imgMago, sombrio:imgSombrio };
      const img = imgMap[jr.classe] ?? null;
      if (img) ctx.drawImage(img, jr.x, jr.y, 80, 80);
      else { ctx.fillStyle = jr.classe==='mago'?'#a855f7':jr.classe==='guerreiro'?'#ef4444':'#10b981'; ctx.fillRect(jr.x,jr.y,80,80); }
      ctx.save();
      ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#fff';
      ctx.fillText(jr.nome, jr.x+40, jr.y-22);
      const bw=80, bx=jr.x, by=jr.y-14;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx,by,bw,6);
      ctx.fillStyle='#4ade80'; ctx.fillRect(bx,by,bw*Math.max(0,jr.hp/(jr.hpMax||200)),6);
      ctx.restore();
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
      // corpo com gradiente radial
      const bg=ctx.createRadialGradient(-r*.25,-r*.25,r*.05,0,0,r*1.2);
      bg.addColorStop(0,m.corBrilho); bg.addColorStop(.35,m.cor); bg.addColorStop(1,m.corVariante);
      ctx.fillStyle=bg;
      if(m.isBoss){ ctx.shadowColor=m.corBrilho; ctx.shadowBlur=50; }
      ctx.beginPath();
      if(m.isBoss){
        ctx.moveTo(0,-r*1.1);
        for(let i=0;i<5;i++){const a=(-Math.PI/2)+(i-2)*.35,s=r*(i%2===0?1.4:1.0);ctx.lineTo(Math.cos(a)*s*.6,Math.sin(a)*s);}
        ctx.bezierCurveTo(r*1.3,-r*.3,r*1.3,r*.5,r*.8,r);
        ctx.bezierCurveTo(r*.4,r*1.2,-r*.4,r*1.2,-r*.8,r);
        ctx.bezierCurveTo(-r*1.3,r*.5,-r*1.3,-r*.3,0,-r*1.1);
      } else {
        ctx.moveTo(0,-r*.9); ctx.bezierCurveTo(r*.4,-r*1.0,r*.85,-r*.7,r*1.0,-r*.1);
        ctx.bezierCurveTo(r*1.0,r*.4,r*.8,r*.85,r*.5,r*1.05);
        ctx.lineTo(r*.3,r*.85);ctx.lineTo(r*.1,r*1.05);ctx.lineTo(-r*.1,r*.85);ctx.lineTo(-r*.3,r*1.05);ctx.lineTo(-r*.5,r*.85);
        ctx.bezierCurveTo(-r*.8,r*.85,-r*1.0,r*.4,-r*1.0,-r*.1);
        ctx.bezierCurveTo(-r*.85,-r*.7,-r*.4,-r*1.0,0,-r*.9);
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
      // highlight
      const hl=ctx.createRadialGradient(-r*.3,-r*.4,0,-r*.15,-r*.25,r*.5);
      hl.addColorStop(0,'rgba(255,255,255,.5)'); hl.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=hl; ctx.beginPath(); ctx.ellipse(-r*.25,-r*.35,r*.32,r*.22,-.4,0,Math.PI*2); ctx.fill();
      // olhos + boca
      if(m.isBoss){
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
        ctx.fillStyle='rgba(255,255,255,.75)';
        for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*r*.15,r*.17);ctx.lineTo(i*r*.15-r*.04,r*.28);ctx.lineTo(i*r*.15+r*.04,r*.28);ctx.closePath();ctx.fill();}
      }
      ctx.restore();
      // HP bar
      const bw=m.size*1.1, bx2=m.x-bw*.05, by2=m.y-18;
      ctx.fillStyle='rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(bx2,by2,bw,7,4); ctx.fill();
      const hg=ctx.createLinearGradient(bx2,0,bx2+bw,0);
      if(m.isBoss){hg.addColorStop(0,'#7f1d1d');hg.addColorStop(.5,'#ef4444');hg.addColorStop(1,'#fca5a5');}
      else{hg.addColorStop(0,m.corVariante);hg.addColorStop(1,m.corBrilho);}
      ctx.fillStyle=hg; ctx.beginPath(); ctx.roundRect(bx2,by2,bw*Math.max(0,m.hp/m.maxHp),7,4); ctx.fill();
      ctx.fillStyle=m.isBoss?'#fca5a5':'rgba(255,255,255,.7)';
      ctx.font=`bold ${m.isBoss?13:10}px monospace`; ctx.textAlign='center';
      ctx.fillText(m.isBoss?'☠ BOSS ☠':'SLIME', cx, by2-4);
    }

    function desenharFinalBoss(m: Monstro) {
      const cx=m.x+m.size/2, cy=m.y+m.size/2, r=m.size/2;
      const bs=1+Math.sin(m.breathe)*.05;
      const hox=m.hitTimer>0?(Math.random()-.5)*12:0, hoy=m.hitTimer>0?(Math.random()-.5)*12:0;
      if(m.hitTimer>0) m.hitTimer--;
      ctx.save(); ctx.translate(cx+hox,cy+hoy); ctx.scale(bs,2-bs);
      // aura (1 camada em vez de 3 para perf)
      const rR=r*1.6+Math.sin(tick*.04)*8;
      const aG=ctx.createRadialGradient(0,0,rR*.5,0,0,rR);
      aG.addColorStop(0,'rgba(255,0,144,.08)'); aG.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=aG; ctx.beginPath(); ctx.arc(0,0,rR,0,Math.PI*2); ctx.fill();
      // corpo
      ctx.shadowColor='#ff0090'; ctx.shadowBlur=50;
      ctx.fillStyle='#0c0010';
      ctx.beginPath();
      for(let i=0;i<=12;i++){
        const a=(i/12)*Math.PI*2-Math.PI/2, s=i%2===0?r*1.15:r*(.7+.2*Math.sin(tick*.06+i)), w=Math.sin(tick*.05+i*.8)*8;
        if(i===0) ctx.moveTo(Math.cos(a)*(s+w),Math.sin(a)*(s+w));
        else ctx.lineTo(Math.cos(a)*(s+w),Math.sin(a)*(s+w));
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
      // tentáculos (reduzido de 8 para 5)
      ctx.globalAlpha=.4+.2*Math.sin(tick*.08);
      for(let v=0;v<5;v++){
        const va=(v/5)*Math.PI*2+tick*.01;
        ctx.strokeStyle=v%2===0?'#ff0090':'#9900ff'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(va)*r*.1,Math.sin(va)*r*.1);
        ctx.bezierCurveTo(Math.cos(va+.5)*r*.5,Math.sin(va+.5)*r*.5,Math.cos(va-.5)*r*.7,Math.sin(va-.5)*r*.7,Math.cos(va)*r*.95,Math.sin(va)*r*.95);
        ctx.stroke();
      }
      ctx.globalAlpha=1;
      // olho central
      ctx.fillStyle='#1a001a'; ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.55,r*.42,0,0,Math.PI*2); ctx.fill();
      const iG=ctx.createRadialGradient(0,-r*.15,0,0,-r*.15,r*.35);
      iG.addColorStop(0,'#ff0090'); iG.addColorStop(.5,'#9900ff'); iG.addColorStop(1,'#ff0090');
      ctx.fillStyle=iG; ctx.shadowColor='#ff0090'; ctx.shadowBlur=25;
      ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.35,r*.32,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,-r*.15,r*.28,r*.06,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,200,255,.9)'; ctx.beginPath(); ctx.arc(r*.12,-r*.28,r*.07,0,Math.PI*2); ctx.fill();
      // mini-olhos (4)
      [{x:-r*.55,y:-r*.52},{x:r*.55,y:-r*.52},{x:-r*.7,y:r*.1},{x:r*.7,y:r*.1}].forEach((op,oi)=>{
        ctx.fillStyle='#0d000d'; ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.14,r*.12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=oi%2===0?'#ff0090':'#cc00ff';
        ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.08,r*.08,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(op.x,op.y,r*.025,r*.07,0,0,Math.PI*2); ctx.fill();
      });
      // boca + dentes
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(0,r*.42,r*.72,r*.28,0,0,Math.PI); ctx.fill();
      for(let t=0;t<7;t++){
        const tx=(t/6-.5)*r*1.2, ph=r*(t%2===0?.26:.16)+Math.sin(tick*.08+t)*4;
        ctx.fillStyle=t%3===0?'#ff6fff':'#e0aaff';
        ctx.beginPath(); ctx.moveTo(tx-r*.06,r*.42); ctx.lineTo(tx,r*.42+ph); ctx.lineTo(tx+r*.06,r*.42); ctx.closePath(); ctx.fill();
      }
      // espinhos (reduzido de 7 para 5)
      for(let s=0;s<5;s++){
        const sa=(-Math.PI/2)+(s-2)*.28, sl=r*(s%2===0?.55:.35)+Math.sin(tick*.07+s)*6;
        const sx2=Math.cos(sa)*r*.85, sy2=Math.sin(sa)*r*.85, ex2=Math.cos(sa)*(r*.85+sl), ey2=Math.sin(sa)*(r*.85+sl);
        ctx.strokeStyle=s%2===0?'#cc00ff':'#ff0090'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(sx2,sy2); ctx.lineTo(ex2,ey2); ctx.stroke();
      }
      ctx.restore();
      // HP bar
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

    function desenharRaio(wx:number, wy:number, prog:number) {
      const fase=prog<.3?prog/.3:1-(prog-.3)/.7, alpha=Math.max(0,fase);
      const origemY=wy-600;
      const pts: {x:number;y:number}[] = [{x:wx+(Math.random()-.5)*4,y:origemY}];
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
      // espirais (reduzido de 5 para 3)
      for(let a=0;a<3;a++){ctx.globalAlpha=al*(.15+a*.06);ctx.strokeStyle=a%2===0?'#fde68a':'#fbbf24';ctx.lineWidth=3-a*.5;ctx.beginPath();ctx.ellipse(cx,cy,FUR_ALCANCE*(.3+a*.2),FUR_ALCANCE*(.3+a*.2)*.45,ang*(1+a*.3)+(a*Math.PI*2)/3,0,Math.PI*1.7);ctx.stroke();}
      // partículas (reduzido de 18 para 10)
      for(let p=0;p<10;p++){const t=(p/10)*Math.PI*2+ang*2.5,d=FUR_ALCANCE*(.5+.5*Math.sin(ang*3+p));ctx.globalAlpha=al*.5;ctx.fillStyle=p%2===0?'#fcd34d':'#fff';ctx.beginPath();ctx.arc(cx+Math.cos(t)*d,cy+Math.sin(t)*d*.5,3,0,Math.PI*2);ctx.fill();}
      // glow central
      const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,FUR_ALCANCE);
      gg.addColorStop(0,`rgba(253,230,138,${al*.45})`); gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(cx,cy,FUR_ALCANCE,0,Math.PI*2); ctx.fill();
      // machados orbitando
      for(let l=0;l<3;l++){const la=ang*3+(l/3)*Math.PI*2,ld=FUR_ALCANCE*.65;ctx.save();ctx.translate(cx+Math.cos(la)*ld,cy+Math.sin(la)*ld*.6);ctx.rotate(la+Math.PI/2);ctx.globalAlpha=al*.95;if(imgArmaGuerr)ctx.drawImage(imgArmaGuerr,-22,-22,44,44);ctx.restore();}
      ctx.globalAlpha=al; ctx.font='bold 11px monospace'; ctx.textAlign='center';
      ctx.fillStyle='#fde68a'; ctx.fillText(`🌪 ${Math.ceil((FUR_DUR-timer)/60)}s`,cx,cy-FUR_ALCANCE*.6-8);
      ctx.globalAlpha=1; ctx.restore();
    }

    function desenharAliado(a: SlimeAliado) {
      const cx=a.x+a.size/2, cy=a.y+a.size/2, r=a.size/2, bs=1+Math.sin(a.breathe)*.07;
      ctx.save(); ctx.translate(cx,cy); ctx.scale(bs,2-bs);
      ctx.fillStyle='#7e22ce';
      ctx.beginPath(); ctx.moveTo(0,-r*.9); ctx.bezierCurveTo(r*.4,-r*1.0,r*.85,-r*.7,r*1.0,-r*.1); ctx.bezierCurveTo(r*1.0,r*.4,r*.8,r*.85,r*.5,r*1.05);
      ctx.lineTo(r*.3,r*.85);ctx.lineTo(r*.1,r*1.05);ctx.lineTo(-r*.1,r*.85);ctx.lineTo(-r*.3,r*1.05);ctx.lineTo(-r*.5,r*.85);
      ctx.bezierCurveTo(-r*.8,r*.85,-r*1.0,r*.4,-r*1.0,-r*.1); ctx.bezierCurveTo(-r*.85,-r*.7,-r*.4,-r*1.0,0,-r*.9);
      ctx.closePath(); ctx.fill();
      [-r*.28,r*.28].forEach(ox=>{ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.ellipse(ox,-r*.25,r*.17,r*.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e879f9';ctx.beginPath();ctx.ellipse(ox,-r*.25,r*.11,r*.14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(ox,-r*.25,r*.04,r*.12,0,0,Math.PI*2);ctx.fill();});
      ctx.restore();
      const bw=a.size*1.1, bx2=a.x-bw*.05, by2=a.y-16;
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx2,by2,bw,6);
      const hg=ctx.createLinearGradient(bx2,0,bx2+bw,0); hg.addColorStop(0,'#581c87'); hg.addColorStop(1,'#e879f9');
      ctx.fillStyle=hg; ctx.fillRect(bx2,by2,bw*Math.max(0,a.hp/a.maxHp),6);
      ctx.fillStyle='#e9d5ff'; ctx.font='bold 9px monospace'; ctx.textAlign='center'; ctx.fillText('👁 ALIADO',cx,by2-3);
    }

    function desenharCorteSombrio(px:number, py:number, anguloBase:number, timer:number, duracao:number) {
      const cx=px+40, cy=py+40, prog=timer/duracao, alpha=prog<.25?prog/.25:1-(prog-.25)/.75;
      const ai=anguloBase-CORTE_LARG/2, af=anguloBase+CORTE_LARG/2;
      ctx.save(); ctx.translate(cx,cy);
      ctx.globalAlpha=alpha*.2; ctx.strokeStyle='#7c3aed'; ctx.lineWidth=18; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.9,ai,af); ctx.stroke();
      ctx.globalAlpha=alpha*.9; ctx.strokeStyle='#f0e6ff'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.86,ai,af); ctx.stroke();
      ctx.globalAlpha=alpha*.7; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
      for(let s=0;s<2;s++){const sa=anguloBase+(s-.5)*(CORTE_LARG*.55);ctx.beginPath();ctx.moveTo(Math.cos(sa)*CORTE_ALC*.25,Math.sin(sa)*CORTE_ALC*.25);ctx.lineTo(Math.cos(sa)*CORTE_ALC*.92,Math.sin(sa)*CORTE_ALC*.92);ctx.stroke();}
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

    function desenharExplosaoArea(ex: ExplosaoArea) {
      const prog=ex.timer/ex.maxTimer, alpha=prog<.3?prog/.3:1-(prog-.3)/.7, raio=SOMB_AREA*(.3+prog*.7);
      ctx.save();
      ctx.globalAlpha=alpha*.6; ctx.strokeStyle='#e879f9'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(ex.x,ex.y,raio,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=alpha*.25; ctx.fillStyle='#a855f7';
      ctx.beginPath(); ctx.arc(ex.x,ex.y,raio*.8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.restore(); ex.timer++;
    }

    // ═══════════════════════════════════════════════════
    // RYŌIKI TENKAI — completo e otimizado
    // ═══════════════════════════════════════════════════
    function desenharRyoikiTenkai(timer: number) {
      const W=canvas.width, H=canvas.height, prog=timer/RYO_DUR;
      const alpha=prog<.05?prog/.05:prog>.92?1-(prog-.92)/.08:1;
      ctx.save();

      // fundo escuro + vinheta vermelha
      ctx.globalAlpha=alpha*.97; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
      const vg=ctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.9);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(.6,'rgba(80,0,0,.35)'); vg.addColorStop(1,'rgba(140,0,0,.75)');
      ctx.globalAlpha=alpha; ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

      // templo central
      const sx=W/2, sy=H*.52, sw=320, sh=280;
      ctx.globalAlpha=alpha*.92;
      // degraus
      for(let d=0;d<3;d++){const dw=sw*(.55+d*.15),dh=14,dy=sy+sh*.42+d*dh;ctx.fillStyle=d===0?'#1c0a00':d===1?'#150800':'#0f0500';ctx.strokeStyle='#7f1d1d';ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(sx-dw/2,dy,dw,dh);ctx.fill();ctx.stroke();}
      // corpo do templo
      ctx.fillStyle='#0d0400'; ctx.strokeStyle='#991b1b'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.rect(sx-sw*.28,sy-sh*.35,sw*.56,sh*.78); ctx.fill(); ctx.stroke();
      // telhado triangular
      ctx.fillStyle='#1c0700'; ctx.strokeStyle='#991b1b'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(sx-sw*.42,sy-sh*.32); ctx.lineTo(sx,sy-sh*.70); ctx.lineTo(sx+sw*.42,sy-sh*.32); ctx.closePath(); ctx.fill(); ctx.stroke();
      // janela/lanterna no topo
      ctx.fillStyle='rgba(255, 0, 0, 0.35)'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.ellipse(sx,sy-sh*.52,sw*.06,sh*.1,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      // colunas laterais
      for(let c=-1;c<=1;c+=2){
        ctx.fillStyle='#150600'; ctx.strokeStyle='#7f1d1d'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.rect(sx+c*sw*.22,sy-sh*.3,sw*.06,sh*.66); ctx.fill(); ctx.stroke();
      }

      // slashes voando pela tela
      if(timer%RYO_SLASH_INT===0){
        const tipo:'dismantle'|'cleave'=Math.random()<.5?'dismantle':'cleave';
        const ang=Math.random()*Math.PI*2, vel=tipo==='dismantle'?18+Math.random()*12:10+Math.random()*8;
        const sx2=Math.random()<.5?(Math.random()<.5?-20:W+20):Math.random()*W;
        const sy2=Math.random()<.5?Math.random()*H:(Math.random()<.5?-20:H+20);
        const vida=tipo==='dismantle'?18+Math.floor(Math.random()*10):30+Math.floor(Math.random()*15);
        slashesDomain.push({x:sx2,y:sy2,angulo:ang,vel,vida,maxVida:vida,tipo,comprimento:tipo==='dismantle'?80+Math.random()*80:60+Math.random()*60});
      }
      // remover mortos primeiro
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

      // partículas vermelhas caindo (substituem parte das partículas antigas)
      for(let i=0;i<8;i++){
        const px2=((tick*3+i*137)%W), py2=((tick*2+i*93)%H);
        ctx.globalAlpha=alpha*(.3+.3*Math.sin(tick*.1+i));
        ctx.fillStyle=i%2===0?'#930000':'#a59e9e';
        ctx.beginPath(); ctx.arc(px2,py2,2+Math.sin(tick*.08+i),0,Math.PI*2); ctx.fill();
      }

      // texto kanji + nome da técnica
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

      // flash vermelho na entrada
      if(prog<.06){ctx.globalAlpha=(1-prog/.06)*.85;ctx.fillStyle='#dc2626';ctx.fillRect(0,0,W,H);}

      // barra de progresso discreta
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
        animId = requestAnimationFrame(render); return;
      }

      if(ryoikiLimpouOnda){
        ryoikiDelayTimer++;
        desenharTransicaoOnda(ryoikiDelayTimer);
        if(ryoikiDelayTimer>=RYOIKI_DELAY){
          ryoikiLimpouOnda=false; ryoikiDelayTimer=0;
          if(ondaAtual<10){ondaAtual++;monstros=gerarOnda(ondaAtual);raioBossArr.length=0;}
          else estadoJogo='vitoria';
        }
        animId = requestAnimationFrame(render); return;
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

      // ── Sync multiplayer ──
      if(++syncMovTick>=2){
        syncMovTick=0;
        socketRef.current?.emit('mover',{x:player.x,y:player.y,direcaoRad:player.direcaoRad});
        // sync HP para outros jogadores
        socketRef.current?.emit('sync_hp',{hp:playerHp,hpMax:status.hpMax});
      }

      // ── Ataque ESPAÇO ──
      if(teclas[' ']&&player.cooldownAtaque<=0){
        if(cl==='guerreiro'){
          melee.ativo=true; melee.duracao=20; melee.anguloAtual=player.direcaoRad-Math.PI/2; player.cooldownAtaque=30;
          socketRef.current?.emit('atacar',{tipo:'melee',angulo:player.direcaoRad});
        } else if(cl==='mago'){
          const mwx=mouseRef.current.x+camera.x, mwy=mouseRef.current.y+camera.y;
          const ang=Math.atan2(mwy-(player.y+40),mwx-(player.x+40)); player.direcaoRad=ang;
          projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*15,vy:Math.sin(ang)*15,tipo:'mago',angulo:ang,dano:15+status.int});
          player.cooldownAtaque=15;
        } else {
          const mwx=mouseRef.current.x+camera.x, mwy=mouseRef.current.y+camera.y;
          const ang=Math.atan2(mwy-(player.y+40),mwx-(player.x+40)); player.direcaoRad=ang;
          projectiles.push({x:player.x+40,y:player.y+40,vx:Math.cos(ang)*11,vy:Math.sin(ang)*11,tipo:'sombrio',angulo:ang,dano:CORTE_DANO});
          player.cooldownAtaque=18;
        }
      }
      if(player.cooldownAtaque>0) player.cooldownAtaque--;

      // ── Habilidades ──
      if(cl==='mago'){
        if(teclas['z']&&raioCooldown<=0&&!raioAtivo){
          raioAlvo={x:mouseRef.current.x+camera.x,y:mouseRef.current.y+camera.y};
          raioAtivo=true; raioTimer=0; raioCooldown=RAIO_CD_MAX;
          monstros.forEach(m=>{const d=Math.hypot((m.x+m.size/2)-raioAlvo.x,(m.y+m.size/2)-raioAlvo.y);if(d<RAIO_AREA+m.size/2){m.hp-=RAIO_DANO;m.hitTimer=12;}});
        }
        if(raioCooldown>0) raioCooldown--;
      }
      if(cl==='guerreiro'){
        if(teclas['z']&&furacaoCooldown<=0&&!furacaoAtivo){ furacaoAtivo=true; furacaoTimer=0; furacaoCooldown=FUR_CD_MAX; socketRef.current?.emit('habilidade_z',{tipo:'furacao'}); }
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
          monstros.forEach(m=>{m.hp-=(m.hp+m.maxHp)/RYO_DUR+5; m.hitTimer=3;});
         for(let i=monstros.length-1;i>=0;i--){
            if(monstros[i].hp<=0){
              // Apenas corta e elimina o inimigo da existência!
              monstros.splice(i,1);
            }
          }
          if(ryoikiTimer>=RYO_DUR){ monstros.length=0; ryoikiAtivo=false; slashesDomain=[]; ryoikiLimpouOnda=true; ryoikiDelayTimer=0; }
        }
        if(ryoikiCooldown>0) ryoikiCooldown--;
      }
      if(cl==='sombrio'){
        if(teclas['z']&&ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED){
          const pi=mortos.splice(0,MAX_ALIADOS);
          pi.forEach((m,i)=>{const as=(i/Math.max(1,pi.length))*Math.PI*2,ds=80+i*20;aliados.push({id:Date.now()+i,x:player.x+Math.cos(as)*ds,y:player.y+Math.sin(as)*ds,hp:m.maxHp,maxHp:m.maxHp,size:m.size,breathe:Math.random()*Math.PI*2,breatheSpeed:.03,hitTimer:0,anguloAtaque:0,cooldownAtaque:0,spawnTimer:0});});
          killsAcum=0; ressurrCooldown=RESSURR_CD_MAX;
          socketRef.current?.emit('habilidade_z',{tipo:'ressurr'});
        }
        if(ressurrCooldown>0) ressurrCooldown--;
        // aliados IA — usar filter em vez de splice dentro de forEach
        aliados = aliados.filter(a=>{
          a.breathe+=a.breatheSpeed; if(a.cooldownAtaque>0)a.cooldownAtaque--;
          let ai2=-1,md=Infinity;
          monstros.forEach((m,mi)=>{const d=Math.hypot((m.x+m.size/2)-(a.x+a.size/2),(m.y+m.size/2)-(a.y+a.size/2));if(d<md){md=d;ai2=mi;}});
          if(ai2>=0){const alv=monstros[ai2],adx=(alv.x+alv.size/2)-(a.x+a.size/2),ady=(alv.y+alv.size/2)-(a.y+a.size/2),ad=Math.max(1,Math.hypot(adx,ady));a.anguloAtaque=Math.atan2(ady,adx);if(ad>ALIADO_ALCANCE){a.x+=(adx/ad)*1.8;a.y+=(ady/ad)*1.8;}if(ad<ALIADO_ALCANCE+alv.size/2&&a.cooldownAtaque<=0){alv.hp-=ALIADO_DANO;alv.hitTimer=6;a.cooldownAtaque=ALIADO_CD;}}
          return a.hp>0;
        });
      }

      // ── Avanço de onda ──
      if(monstros.length===0&&!ryoikiAtivo&&!ryoikiLimpouOnda){
        if(ondaAtual<10){ondaAtual++;monstros=gerarOnda(ondaAtual);raioBossArr.length=0;} else estadoJogo='vitoria';
      }

      // ── Câmera ──
      camera.x=Math.max(0,Math.min(player.x+40-canvas.width/2,WORLD_WIDTH-canvas.width));
      camera.y=Math.max(0,Math.min(player.y+40-canvas.height/2,WORLD_HEIGHT-canvas.height));

      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save();
      ctx.translate(-camera.x,-camera.y);

      // Cenário (padrão cacheado)
      if(cenarioPtrn){ctx.fillStyle=cenarioPtrn;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);}
      else{ctx.fillStyle='#0f0f1a';ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);}

      // Jogadores remotos
      Object.values(remotosRef.current).forEach(jr=>desenharJogadorRemoto(jr));

      // ── Monstros (filter seguro em vez de splice dentro de forEach) ──
      const monstrosParaRemover: number[] = [];
      monstros.forEach((m,idx)=>{
        m.breathe+=m.breatheSpeed;
        const pd=Math.hypot(player.x-m.x,player.y-m.y);
        let ax=player.x,ay=player.y,amd=pd,aEh=false,aIdx=-1;
        aliados.forEach((a,ai)=>{const d=Math.hypot(a.x-m.x,a.y-m.y);if(d<amd){amd=d;ax=a.x;ay=a.y;aEh=true;aIdx=ai;}});
        if(amd<1200){
          const vel=m.isFinalBoss?.003:m.isBoss?.005:.01;
          m.x+=(ax-m.x)*vel; m.y+=(ay-m.y)*vel;
          if(!aEh){if(pd<(m.isFinalBoss?140:m.isBoss?100:40)){playerHp-=(m.isFinalBoss?3:m.isBoss?2:.5);if(playerHp<=0)estadoJogo='gameover';}}
          else if(aIdx>=0){if(amd<(m.isBoss?100:40))aliados[aIdx].hp-=(m.isBoss?1.5:.4);}
        }
        if(m.isFinalBoss){
          if(m.raioCooldown===undefined)m.raioCooldown=RAIO_BOSS_CD;
          m.raioCooldown!--;
          if(m.raioCooldown!<=0){m.raioCooldown=RAIO_BOSS_CD;for(let r2=0;r2<3;r2++){const sp=(r2-1)*.4,ang=Math.atan2((player.y+40)-(m.y+m.size/2),(player.x+40)-(m.x+m.size/2))+sp;raioBossArr.push({x:m.x+m.size/2,y:m.y+m.size/2,vx:Math.cos(ang)*RAIO_BOSS_VEL,vy:Math.sin(ang)*RAIO_BOSS_VEL,angulo:ang,vida:RAIO_BOSS_VIDA,homingTimer:0});}}
          desenharFinalBoss(m);
        } else {
          desenharSlime(m);
        }
        if(melee.ativo){const d=Math.hypot((player.x+40)-(m.x+m.size/2),(player.y+40)-(m.y+m.size/2));if(d<(m.isBoss?150:100)){m.hp-=2;m.hitTimer=6;if(!m.isBoss){m.x+=Math.cos(player.direcaoRad)*10;m.y+=Math.sin(player.direcaoRad)*10;}}}
        if(cl==='sombrio'&&corte.ativo){const cdx=(m.x+m.size/2)-(player.x+40),cdy=(m.y+m.size/2)-(player.y+40),cd=Math.hypot(cdx,cdy);if(cd<CORTE_ALC+m.size/2){let diff=Math.atan2(cdy,cdx)-corte.anguloBase;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;if(Math.abs(diff)<CORTE_LARG/2){m.hp-=CORTE_DANO*(1/corte.duracao);m.hitTimer=4;}}}
        if(m.hp<=0){
          if(!m.isBoss&&cl==='sombrio'){mortos.unshift({hp:m.maxHp,maxHp:m.maxHp,size:m.size,x:m.x,y:m.y});if(mortos.length>MAX_ALIADOS)mortos.pop();if(killsAcum<KILLS_NEEDED)killsAcum++;}
          monstrosParaRemover.push(idx);
        }
      });
      // remover mortos de trás pra frente
      for(let i=monstrosParaRemover.length-1;i>=0;i--) monstros.splice(monstrosParaRemover[i],1);

      // Raios boss
      raioBossArr = raioBossArr.filter(rb=>{
        rb.vida--; rb.homingTimer++;
        if(rb.homingTimer>=10){rb.homingTimer=0;let diff=Math.atan2(player.y+40-rb.y,player.x+40-rb.x)-rb.angulo;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;rb.angulo+=diff*.22;rb.vx=Math.cos(rb.angulo)*RAIO_BOSS_VEL;rb.vy=Math.sin(rb.angulo)*RAIO_BOSS_VEL;}
        rb.x+=rb.vx; rb.y+=rb.vy;
        if(Math.hypot(rb.x-(player.x+40),rb.y-(player.y+40))<28){playerHp-=RAIO_BOSS_DANO;if(playerHp<=0)estadoJogo='gameover';return false;}
        if(rb.vida<=0||rb.x<0||rb.x>WORLD_WIDTH||rb.y<0||rb.y>WORLD_HEIGHT)return false;
        const al=Math.min(1,rb.vida/20);
        ctx.save(); ctx.globalAlpha=al;
        ctx.strokeStyle='rgba(255,0,144,.3)'; ctx.lineWidth=14; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(rb.x-rb.vx*4,rb.y-rb.vy*4); ctx.lineTo(rb.x,rb.y); ctx.stroke();
        ctx.strokeStyle='#ff6fff'; ctx.lineWidth=5;
        ctx.beginPath(); ctx.moveTo(rb.x-rb.vx*3,rb.y-rb.vy*3); ctx.lineTo(rb.x,rb.y); ctx.stroke();
        ctx.fillStyle='#ff6fff'; ctx.beginPath(); ctx.arc(rb.x,rb.y,5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.restore();
        return true;
      });

      // Projéteis (filter seguro)
      for(let i=projectiles.length-1;i>=0;i--){
        const p=projectiles[i]; p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>WORLD_WIDTH||p.y<0||p.y>WORLD_HEIGHT){projectiles.splice(i,1);continue;}
        if(p.tipo==='sombrio'){
          if(p.dp===undefined)p.dp=0; p.dp+=Math.hypot(p.vx,p.vy);
          desenharProjetilSombrio(p);
          let explodiu=false;
          for(const m of monstros){if(explodiu)break;const d=Math.hypot(p.x-(m.x+m.size/2),p.y-(m.y+m.size/2));if(d<m.size/2+16){explodiu=true;monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){alv.hp-=p.dano*(1-(da/SOMB_AREA)*.5);alv.hitTimer=8;}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}}
          if(!explodiu&&(p.dp??0)>=SOMB_ALC){monstros.forEach(alv=>{const da=Math.hypot((alv.x+alv.size/2)-p.x,(alv.y+alv.size/2)-p.y);if(da<SOMB_AREA+alv.size/2){alv.hp-=p.dano*(1-(da/SOMB_AREA)*.5)*.6;alv.hitTimer=6;}});explosoesArea.push({x:p.x,y:p.y,timer:0,maxTimer:40});projectiles.splice(i,1);}
        } else {
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angulo);
          if(imgArmaMago)ctx.drawImage(imgArmaMago,-20,-20,40,40);
          ctx.restore();
          let hit=false;
          for(const m of monstros){if(p.x>m.x&&p.x<m.x+m.size&&p.y>m.y&&p.y<m.y+m.size){m.hp-=p.dano/5;m.hitTimer=6;hit=true;break;}}
          if(hit)projectiles.splice(i,1);
        }
      }

      // Explosões área
      explosoesArea=explosoesArea.filter(ex=>{desenharExplosaoArea(ex);return ex.timer<ex.maxTimer;});

      // Melee
      if(melee.ativo){
        melee.duracao--; melee.anguloAtual+=Math.PI/20;
        ctx.save(); ctx.translate(player.x+40,player.y+40); ctx.rotate(melee.anguloAtual);
        if(imgArmaGuerr)ctx.drawImage(imgArmaGuerr,45,-35,70,70);
        ctx.strokeStyle='rgba(251,191,36,.25)'; ctx.lineWidth=8;
        ctx.beginPath(); ctx.arc(0,0,75,melee.anguloAtual-Math.PI*.6,melee.anguloAtual); ctx.stroke();
        ctx.restore(); if(melee.duracao<=0)melee.ativo=false;
      }
      // Raio mago
      if(raioAtivo){raioTimer++;desenharRaio(raioAlvo.x,raioAlvo.y,raioTimer/RAIO_DUR);if(raioTimer>=RAIO_DUR)raioAtivo=false;}
      // Furacão
      if(furacaoAtivo&&cl==='guerreiro')desenharFuracao(player.x,player.y,furacaoAngulo,furacaoTimer);
      // Aliados
      aliados.forEach(a=>desenharAliado(a));
      // Corte sombrio
      if(cl==='sombrio'&&corte.ativo){corte.timer++;desenharCorteSombrio(player.x,player.y,corte.anguloBase,corte.timer,corte.duracao);if(corte.timer>=corte.duracao)corte.ativo=false;}

      // Player
      if(imgPlayer)ctx.drawImage(imgPlayer,player.x,player.y,player.size,player.size);
      else{ctx.fillStyle=player.color;ctx.fillRect(player.x,player.y,player.size,player.size);}

      ctx.restore(); // fim câmera

      // Ryōiki Tenkai (fullscreen — após restore da câmera)
      if(ryoikiAtivo&&cl==='guerreiro')desenharRyoikiTenkai(ryoikiTimer);

      // ── UI ──────────────────────────────────────────
      // HP Bar
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(18,canvas.height-44,204,22);
      const hpG=ctx.createLinearGradient(20,0,220,0);
      hpG.addColorStop(0,'#7f1d1d'); hpG.addColorStop(.5,'#ef4444'); hpG.addColorStop(1,'#fca5a5');
      ctx.fillStyle=hpG; ctx.fillRect(20,canvas.height-42,(Math.max(0,playerHp)/status.hpMax)*200,18);
      ctx.fillStyle='white'; ctx.font='bold 11px monospace'; ctx.textAlign='left';
      ctx.fillText(`❤ ${Math.floor(Math.max(0,playerHp))} / ${status.hpMax}`,26,canvas.height-29);

      // Online
      if(online){ctx.font='bold 10px monospace';ctx.textAlign='right';ctx.fillStyle='#4ade80';ctx.fillText(`🌐 ${qtJog}P`,canvas.width-10,20);}

      // Onda
      ctx.font='bold 18px serif'; ctx.textAlign='left';
      ctx.fillStyle=ondaAtual===10?'#ff6fff':ondaAtual===5?'#fca5a5':'#e2e8f0';
      ctx.shadowColor=ondaAtual===10?'#ff0090':ondaAtual===5?'#dc2626':'#7c3aed'; ctx.shadowBlur=12;
      ctx.fillText(ondaAtual===10?'💀 BOSS FINAL !! 💀':ondaAtual===5?'⚠ ONDA 5 — MINI-BOSS ⚠':`⚔ ONDA ${ondaAtual} / 10`,20,38); ctx.shadowBlur=0;

      // UI Mago
      if(cl==='mago'){
        const pr=raioCooldown<=0, cdr=raioCooldown/RAIO_CD_MAX;
        const bx=canvas.width-74, by=canvas.height-74, bs=58;
        ctx.fillStyle=pr?'rgba(126,34,206,.85)':'rgba(20,10,40,.85)'; ctx.fillRect(bx,by,bs,bs);
        ctx.strokeStyle=pr?'#e879f9':'#4c1d95'; ctx.lineWidth=pr?2.5:1.5; if(pr){ctx.shadowColor='#e879f9';ctx.shadowBlur=12;}
        ctx.strokeRect(bx,by,bs,bs); ctx.shadowBlur=0;
        if(!pr){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 26px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=pr?'#f0abfc':'#7c3aed'; ctx.fillText('⚡',bx+bs/2,by+36);
        ctx.font='bold 10px monospace'; ctx.fillStyle=pr?'#fae8ff':'#6b21a8'; ctx.fillText('[Z]',bx+bs/2,by+52);
        if(!pr){ctx.font='bold 16px monospace';ctx.fillStyle='#e9d5ff';ctx.fillText(`${Math.ceil(raioCooldown/60)}s`,bx+bs/2,by+22);}
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
        // X — Ultimate
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
        const ptu=ressurrCooldown<=0&&killsAcum>=KILLS_NEEDED, cdr=ressurrCooldown/RESSURR_CD_MAX;
        const bx=canvas.width-74, by=canvas.height-74, bs=58;
        ctx.fillStyle=ptu?'rgba(88,28,135,.92)':'rgba(15,5,25,.88)'; ctx.fillRect(bx,by,bs,bs);
        ctx.strokeStyle=ptu?'#e879f9':'#4c1d95'; ctx.lineWidth=ptu?2.5:1.5;
        if(ptu){ctx.shadowColor='#e879f9';ctx.shadowBlur=14;}
        ctx.strokeRect(bx,by,bs,bs); ctx.shadowBlur=0;
        if(!ptu&&ressurrCooldown>0){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(bx,by,bs,bs*cdr);}
        ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.fillStyle=ptu?'#e879f9':'#7c3aed'; ctx.fillText('💀',bx+bs/2,by+34);
        ctx.font='bold 10px monospace'; ctx.fillStyle=ptu?'#fae8ff':'#581c87'; ctx.fillText('[Z]',bx+bs/2,by+52);
        if(ressurrCooldown>0){ctx.font='bold 14px monospace';ctx.fillStyle='#d8b4fe';ctx.fillText(`${Math.ceil(ressurrCooldown/60)}s`,bx+bs/2,by+18);}
        const slSz=10,slGp=3,totW=KILLS_NEEDED*(slSz+slGp)-slGp,slSX=bx+(bs-totW)/2,slSY=by-18;
        for(let k=0;k<KILLS_NEEDED;k++){const f=k<killsAcum;ctx.fillStyle=f?'#a855f7':'rgba(100,50,150,.3)';if(f){ctx.shadowColor='#e879f9';ctx.shadowBlur=5;}ctx.fillRect(slSX+k*(slSz+slGp),slSY,slSz,slSz);ctx.shadowBlur=0;}
        ctx.font='bold 8px monospace';ctx.fillStyle='#c084fc';ctx.fillText(`${killsAcum}/${KILLS_NEEDED} KILLS`,bx+bs/2,slSY-3);
        if(aliados.length>0){ctx.font='bold 9px monospace';ctx.fillStyle='#e879f9';ctx.fillText(`👁 ${aliados.length} ALIADO${aliados.length>1?'S':''}`,bx+bs/2,by-32);}
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
        style={{ backgroundImage:"url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center gap-3">
          <span>GLORY DARK | {status.nome} | {status.classe.toUpperCase()}</span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${online?'bg-green-900/60 text-green-400':'bg-zinc-800 text-zinc-500'}`}>
            {online?`🌐 ${qtJog}P`:'solo'}
          </span>
        </div>
        <canvas ref={canvasRef} width={900} height={600}
          className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">
          WASD mover · ESPAÇO atacar ·{' '}
          {status.classe==='mago'      && 'Z = Raio Arcano · '}
          {status.classe==='guerreiro' && 'Z = Furacão · X = Ryōiki Tenkai · '}
          {status.classe==='sombrio'   && 'Z = Ressurreição (5 kills) · '}
          Sobreviva até a onda 10.
        </p>
      </div>
    </main>
  );
}
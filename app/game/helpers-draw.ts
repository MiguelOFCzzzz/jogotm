// app/game/helpers-draw.ts
// Funções puras de desenho — recebem ctx, dados e desenham. Sem estado próprio.

import type { RefObject } from 'react';

// ─── Re-export de tipos usados externamente ───────────────────────────────────
export type TipoInimigo = 'normal'|'arqueiro'|'tanque'|'velocista'|'mago_ini';
export type Projetil      = { x:number; y:number; vx:number; vy:number; tipo:string; angulo:number; dano:number; dp?:number; homing?:boolean };
export type AtaqueMelee   = { ativo:boolean; anguloAtual:number; duracao:number; dano:number };
export type Monstro = {
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
export type ProjetilInimigo = { x:number; y:number; vx:number; vy:number; vida:number; dano:number; cor:string; corBrilho:string; homingTimer:number };
export type RaioBoss      = { x:number; y:number; vx:number; vy:number; angulo:number; vida:number; homingTimer:number };
export type SombraGuardada = { tipo:TipoInimigo; size:number; maxHp:number; ordemMorte:number };
export type SlimeAliado   = { id:number; x:number; y:number; hp:number; maxHp:number; size:number; breathe:number; breatheSpeed:number; hitTimer:number; anguloAtaque:number; cooldownAtaque:number; spawnTimer:number; tipo:TipoInimigo };
export type MonstroMorto  = { hp:number; maxHp:number; size:number; x:number; y:number; tipo:TipoInimigo };
export type SlashDomain   = { x:number; y:number; angulo:number; vel:number; vida:number; maxVida:number; tipo:'dismantle'|'cleave'; comprimento:number };
export type ParticulaDomain = { x:number; y:number; vx:number; vy:number; vida:number; maxVida:number; r:number; cor:string };
export type ExplosaoArea  = { x:number; y:number; timer:number; maxTimer:number };
export type CorteSomb     = { ativo:boolean; timer:number; duracao:number; anguloBase:number };
export type JogadorRemoto = { id:string; nome:string; classe:string; x:number; y:number; hp:number; hpMax:number; direcaoRad:number };

export const SLIME_PALETAS = [
  { base:'#7f1d1d', variante:'#450a0a', brilho:'#ef4444', olho:'#fca5a5' },
  { base:'#14532d', variante:'#052e16', brilho:'#4ade80', olho:'#bbf7d0' },
  { base:'#1e1b4b', variante:'#0f0a2e', brilho:'#818cf8', olho:'#c7d2fe' },
  { base:'#78350f', variante:'#431407', brilho:'#fb923c', olho:'#fed7aa' },
  { base:'#164e63', variante:'#083344', brilho:'#22d3ee', olho:'#a5f3fc' },
];
export const PALETA_ARQUEIRO = { base:'#1a3a1a', variante:'#0a200a', brilho:'#86efac', olho:'#bbf7d0' };
export const PALETA_TANQUE   = { base:'#1c1c2e', variante:'#0a0a1a', brilho:'#6366f1', olho:'#c7d2fe' };
export const PALETA_VELOC    = { base:'#7f1d00', variante:'#400e00', brilho:'#fb923c', olho:'#fed7aa' };
export const PALETA_MAGO_INI = { base:'#2e1065', variante:'#1a0040', brilho:'#e879f9', olho:'#f5d0fe' };

export function iconeTipo(tipo: string): string {
  if(tipo==='arqueiro') return '🏹';
  if(tipo==='tanque')   return '🛡';
  if(tipo==='velocista') return '⚡';
  if(tipo==='mago_ini') return '🔮';
  return 'SLIME';
}

// ─── Jogador remoto ───────────────────────────────────────────────────────────
export function desenharJogadorRemoto(
  ctx: CanvasRenderingContext2D,
  jr: JogadorRemoto,
  imgs: { guerreiro: HTMLImageElement|null; mago: HTMLImageElement|null; sombrio: HTMLImageElement|null }
) {
  const img = imgs[jr.classe as keyof typeof imgs] ?? null;
  if (img) ctx.drawImage(img, jr.x, jr.y, 80, 80);
  else { ctx.fillStyle=jr.classe==='mago'?'#a855f7':jr.classe==='guerreiro'?'#ef4444':'#10b981'; ctx.fillRect(jr.x,jr.y,80,80); }
  ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#fff';
  ctx.fillText(jr.nome, jr.x+40, jr.y-22);
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(jr.x,jr.y-14,80,6);
  ctx.fillStyle='#4ade80'; ctx.fillRect(jr.x,jr.y-14,80*Math.max(0,jr.hp/(jr.hpMax||200)),6);
}

// ─── Slime / Monstro ──────────────────────────────────────────────────────────
export function desenharSlime(ctx: CanvasRenderingContext2D, m: Monstro) {
  const cx=m.x+m.size/2, cy=m.y+m.size/2, r=m.size/2;
  const bs=1+Math.sin(m.breathe)*.07;
  const hox=m.hitTimer>0?(Math.random()-.5)*8:0, hoy=m.hitTimer>0?(Math.random()-.5)*8:0;
  if(m.hitTimer>0) m.hitTimer--;
  ctx.save(); ctx.translate(cx+hox,cy+hoy); ctx.scale(bs,2-bs);
  ctx.save(); ctx.scale(1,.2); ctx.translate(0,r*4.5);
  const sg=ctx.createRadialGradient(0,0,0,0,0,r);
  sg.addColorStop(0,'rgba(0,0,0,.5)'); sg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,0,r*.9,r*.5,0,0,Math.PI*2); ctx.fill(); ctx.restore();
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
  const hl=ctx.createRadialGradient(-r*.3,-r*.4,0,-r*.15,-r*.25,r*.5);
  hl.addColorStop(0,'rgba(255,255,255,.5)'); hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hl; ctx.beginPath(); ctx.ellipse(-r*.25,-r*.35,r*.32,r*.22,-.4,0,Math.PI*2); ctx.fill();
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

// ─── Boss Final ───────────────────────────────────────────────────────────────
export function desenharFinalBoss(ctx: CanvasRenderingContext2D, m: Monstro, tick: number) {
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

// ─── Projétil inimigo ─────────────────────────────────────────────────────────
export function desenharProjetilInimigo(ctx: CanvasRenderingContext2D, p: ProjetilInimigo) {
  ctx.save(); ctx.translate(p.x,p.y);
  const al=Math.min(1,p.vida/15);
  ctx.globalAlpha=al;
  const pg=ctx.createRadialGradient(0,0,0,0,0,10);
  pg.addColorStop(0,'#fff'); pg.addColorStop(.4,p.corBrilho); pg.addColorStop(1,p.cor);
  ctx.shadowColor=p.corBrilho; ctx.shadowBlur=12;
  ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore();
}

// ─── Aliado sombrio ───────────────────────────────────────────────────────────
export function desenharAliado(ctx: CanvasRenderingContext2D, a: SlimeAliado, tick: number) {
  const cx=a.x+a.size/2, cy=a.y+a.size/2, r=a.size/2, bs=1+Math.sin(a.breathe)*.07;
  const auraG=ctx.createRadialGradient(cx,cy,0,cx,cy,r*2.2);
  auraG.addColorStop(0,'rgba(168,85,247,0.35)'); auraG.addColorStop(.5,'rgba(109,40,217,0.18)'); auraG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=auraG; ctx.beginPath(); ctx.arc(cx,cy,r*2.2,0,Math.PI*2); ctx.fill();
  for(let p=0;p<4;p++){
    const pa=tick*0.08+p*(Math.PI/2);
    const px2=cx+Math.cos(pa)*r*1.6, py2=cy+Math.sin(pa)*r*1.6*0.5;
    ctx.save(); ctx.globalAlpha=0.7+0.3*Math.sin(tick*0.12+p);
    ctx.fillStyle=p%2===0?'#e879f9':'#a855f7'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(px2,py2,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx,cy); ctx.scale(bs,2-bs);
  ctx.shadowColor='#a855f7'; ctx.shadowBlur=18;
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
  const bw=a.size*1.1, bx2=a.x-bw*.05, by2=a.y-18;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx2,by2,bw,6);
  const hg=ctx.createLinearGradient(bx2,0,bx2+bw,0); hg.addColorStop(0,'#581c87'); hg.addColorStop(1,'#e879f9');
  ctx.fillStyle=hg; ctx.fillRect(bx2,by2,bw*Math.max(0,a.hp/a.maxHp),6);
  ctx.fillStyle='#e9d5ff'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
  ctx.fillText(`👁 ${iconeTipo(a.tipo)}`,cx,by2-3);
}

// ─── Corte sombrio ────────────────────────────────────────────────────────────
export const CORTE_ALC=150, CORTE_LARG=1.1;
export function desenharCorteSombrio(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  anguloBase: number, timer: number, duracao: number
) {
  const cx=px+40, cy=py+40, prog=timer/duracao, alpha=prog<.25?prog/.25:1-(prog-.25)/.75;
  const ai=anguloBase-CORTE_LARG/2, af=anguloBase+CORTE_LARG/2;
  ctx.save(); ctx.translate(cx,cy);
  ctx.globalAlpha=alpha*.2; ctx.strokeStyle='#7c3aed'; ctx.lineWidth=18; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.9,ai,af); ctx.stroke();
  ctx.globalAlpha=alpha*.9; ctx.strokeStyle='#f0e6ff'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,0,CORTE_ALC*.86,ai,af); ctx.stroke();
  ctx.globalAlpha=1; ctx.restore();
}

// ─── Projétil sombrio ─────────────────────────────────────────────────────────
export function desenharProjetilSombrio(ctx: CanvasRenderingContext2D, p: Projetil) {
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angulo);
  ctx.globalAlpha=.65; ctx.strokeStyle='#c084fc'; ctx.lineWidth=9; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,0,13,-.65,.65); ctx.stroke();
  ctx.globalAlpha=1; ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(18,0); ctx.stroke();
  ctx.fillStyle='#f0abfc'; ctx.beginPath(); ctx.arc(13,0,4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ─── Projétil guerreiro ───────────────────────────────────────────────────────
export function desenharProjetilGuerreiro(ctx: CanvasRenderingContext2D, p: Projetil) {
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

// ─── Explosão de área ─────────────────────────────────────────────────────────
export const SOMB_AREA=80;
export function desenharExplosaoArea(ctx: CanvasRenderingContext2D, ex: ExplosaoArea) {
  const prog=ex.timer/ex.maxTimer, alpha=prog<.3?prog/.3:1-(prog-.3)/.7, raio=SOMB_AREA*(.3+prog*.7);
  ctx.save();
  ctx.globalAlpha=alpha*.6; ctx.strokeStyle='#e879f9'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(ex.x,ex.y,raio,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=alpha*.25; ctx.fillStyle='#a855f7';
  ctx.beginPath(); ctx.arc(ex.x,ex.y,raio*.8,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1; ctx.restore(); ex.timer++;
}

// ─── Raio (guerreiro Z) ───────────────────────────────────────────────────────
export const RAIO_AREA=120;
export function desenharRaio(
  ctx: CanvasRenderingContext2D,
  wx: number, wy: number, prog: number
) {
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

// ─── Furacão (guerreiro Z) ────────────────────────────────────────────────────
export const FUR_ALCANCE=160, FUR_DUR=200;
export function desenharFuracao(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  ang: number, timer: number,
  imgArmaGuerr: HTMLImageElement|null
) {
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

// ─── Ryōiki Tenkai (guerreiro X) ─────────────────────────────────────────────
export const RYO_DUR=600, RYO_SLASH_INT=8;
export function desenharRyoikiTenkai(
  ctx: CanvasRenderingContext2D,
  timer: number,
  tick: number,
  canvasW: number, canvasH: number,
  slashesDomain: SlashDomain[],
  ondaAtual: number
) {
  const W=canvasW, H=canvasH, prog=timer/RYO_DUR;
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

// ─── Transição de onda ────────────────────────────────────────────────────────
export const RYOIKI_DELAY=120;
export function desenharTransicaoOnda(
  ctx: CanvasRenderingContext2D,
  dt: number, ondaAtual: number,
  canvasW: number, canvasH: number
) {
  const prog=dt/RYOIKI_DELAY, alpha=prog<.2?1:prog>.7?1-(prog-.7)/.3:1;
  ctx.save();
  ctx.globalAlpha=alpha*.85; ctx.fillStyle='#000'; ctx.fillRect(0,0,canvasW,canvasH);
  ctx.globalAlpha=alpha; ctx.textAlign='center';
  ctx.font='bold 28px serif'; ctx.fillStyle='#ef4444'; ctx.shadowColor='#dc2626'; ctx.shadowBlur=16;
  ctx.fillText(`⚔ ONDA ${ondaAtual} ELIMINADA`,canvasW/2,canvasH/2-20); ctx.shadowBlur=0;
  ctx.font='bold 16px monospace'; ctx.fillStyle='#fca5a5';
  ctx.fillText(`Próxima onda em ${Math.ceil((RYOIKI_DELAY-dt)/60)}s...`,canvasW/2,canvasH/2+20);
  ctx.globalAlpha=1; ctx.restore();
}

// ─── ARISE cutscene (sombrio Z) ───────────────────────────────────────────────
export const ARISE_DUR=150;
export function desenharAriseCutscene(
  ctx: CanvasRenderingContext2D,
  timer: number, tick: number,
  canvasW: number, canvasH: number,
  ariseParticulas: {x:number;y:number;vx:number;vy:number;vida:number;r:number;cor:string}[],
  ariseAliados: {x:number;y:number;nome:string;alpha:number;scale:number;vy:number}[]
) {
  const W=canvasW, H=canvasH;
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

// ─── Invocação Igris+Beru (sombrio X) ────────────────────────────────────────
export const INVOC_DUR=360, INVOC_KILL_T=180;
export function desenharInvocacaoUltimate(
  ctx: CanvasRenderingContext2D,
  timer: number, tick: number,
  canvasW: number, canvasH: number,
  invocParticulas: {x:number;y:number;vx:number;vy:number;vida:number;r:number;cor:string}[],
  invocKilled: boolean,
  igrisPos: {x:number;y:number;alpha:number;scale:number},
  beruPos:  {x:number;y:number;alpha:number;scale:number}
) {
  const W=canvasW, H=canvasH;
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
  igrisPos.x=W*(0.1+igrisEnter*0.22); igrisPos.y=H*0.5; igrisPos.alpha=igrisEnter; igrisPos.scale=0.5+igrisEnter*0.5;
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
  beruPos.x=W*(0.9-beruEnter*0.22); beruPos.y=H*0.5; beruPos.alpha=beruEnter; beruPos.scale=0.5+beruEnter*0.5;
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
    ctx.fillStyle='rgba(168,85,247,0.4)'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.moveTo(ws*18,-12); ctx.bezierCurveTo(ws*60,-70,ws*85,-30,ws*62,28); ctx.bezierCurveTo(ws*48,48,ws*28,35,ws*18,14); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.shadowBlur=0; ctx.restore();
  ctx.save(); ctx.globalAlpha=beruEnter*alpha; ctx.textAlign='center';
  ctx.font='bold 16px monospace'; ctx.fillStyle='#f0abfc'; ctx.shadowColor='#e879f9'; ctx.shadowBlur=14;
  ctx.fillText('🐜 BERU',beruPos.x,beruPos.y+70*beruPos.scale+10); ctx.shadowBlur=0; ctx.restore();
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

// ══════════════════════════════════════════════════════════════
//  CID KAGENOU (Shadow) — habilidades
// ══════════════════════════════════════════════════════════════

export const SHADOW_SLASH_DUR  = 14;
export const SHADOW_SLASH_RAIO = 130;
export const EBONY_DUR         = 220;
export const EBONY_AREA        = 280; // ← área bem mais longe ao redor do player
export const ATOMIC_DUR        = 480;
export const ATOMIC_CD_MAX     = 16200;

export type EbonySwirl = {
  x: number; y: number;
  angulo: number; vel: number;
  vida: number; maxVida: number;
  raio: number;
};

/** Projétil ciano do Shadow Slash (espaço) — cor roxa neon */
export function desenharShadowSlash(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  anguloBase: number, timer: number, duracao: number
) {
  const cx = px + 40, cy = py + 40;
  const prog = timer / duracao;
  const alpha = prog < .25 ? prog / .25 : 1 - (prog - .25) / .75;
  const ai = anguloBase - 1.3, af = anguloBase + 1.3;

  ctx.save(); ctx.translate(cx, cy);

  // Glow externo roxo
  ctx.globalAlpha = alpha * .2;
  ctx.strokeStyle = '#c026d3'; ctx.lineWidth = 32; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, SHADOW_SLASH_RAIO * .92, ai, af); ctx.stroke();

  // Anel médio
  ctx.globalAlpha = alpha * .55;
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.arc(0, 0, SHADOW_SLASH_RAIO * .90, ai, af); ctx.stroke();

  // Corpo principal — roxo neon
  ctx.globalAlpha = alpha * .9;
  ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(0, 0, SHADOW_SLASH_RAIO * .87, ai, af); ctx.stroke();

  // Borda interna brilhante
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1.5;
  ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, 0, SHADOW_SLASH_RAIO * .83, ai, af); ctx.stroke();
  ctx.shadowBlur = 0;

  // Partículas neon roxas
  for (let i = 0; i < 8; i++) {
    const pa = ai + (af - ai) * (i / 7);
    const pr = SHADOW_SLASH_RAIO * (.82 + Math.random() * .12);
    ctx.globalAlpha = alpha * (.6 + Math.random() * .4);
    ctx.fillStyle = i % 2 === 0 ? '#e879f9' : '#c026d3';
    ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore();
}

/** Ebony Swirl — redemoinho roxo NEON em volta do player (Z) */
export function desenharEbonySwirl(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  tick: number, timer: number
) {
  const cx = px + 40, cy = py + 40;
  const prog = timer / EBONY_DUR;
  const alpha = prog < .12 ? prog / .12 : prog > .85 ? 1 - (prog - .85) / .15 : 1;

  ctx.save(); ctx.translate(cx, cy);

  // Anel de base grande
  ctx.globalAlpha = alpha * .18;
  ctx.strokeStyle = '#9333ea'; ctx.lineWidth = 60; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, EBONY_AREA * .75, 0, Math.PI * 2); ctx.stroke();

  // Anéis giratórios roxo neon
  for (let r = 0; r < 5; r++) {
    const ra = tick * (.05 + r * .018) + r * Math.PI / 2.5;
    const rr = EBONY_AREA * (.3 + r * .16);
    ctx.globalAlpha = alpha * (.7 - r * .06);
    ctx.strokeStyle = r % 2 === 0 ? '#d946ef' : '#7c3aed';
    ctx.lineWidth = 3.5 - r * .45;
    ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, rr, ra, ra + Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rr, ra + Math.PI, ra + Math.PI * 2.5); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Anel externo pulsante
  ctx.globalAlpha = alpha * (.4 + .3 * Math.sin(tick * .14));
  ctx.strokeStyle = '#c026d3'; ctx.lineWidth = 2;
  ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.arc(0, 0, EBONY_AREA * .98, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;

  // Partículas orbitais roxas
  for (let p = 0; p < 18; p++) {
    const pa = tick * .1 + p * (Math.PI * 2 / 18);
    const pd = EBONY_AREA * (.55 + Math.sin(tick * .1 + p) * .32);
    ctx.globalAlpha = alpha * (.5 + Math.sin(tick * .1 + p) * .45);
    const cols = ['#e879f9', '#d946ef', '#c026d3', '#a855f7', '#f0abfc'];
    ctx.fillStyle = cols[p % cols.length];
    ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(Math.cos(pa) * pd, Math.sin(pa) * pd, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Faíscas rápidas no anel externo
  for (let s = 0; s < 6; s++) {
    const sa = tick * .2 + s * (Math.PI * 2 / 6);
    const sd = EBONY_AREA * (.92 + Math.sin(tick * .3 + s) * .06);
    ctx.globalAlpha = alpha * (.8 + Math.sin(tick * .4 + s) * .2);
    ctx.fillStyle = '#f5d0fe';
    ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Centro brilhante roxo
  ctx.globalAlpha = alpha * (.7 + .3 * Math.sin(tick * .15));
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  cg.addColorStop(0, '#faf5ff'); cg.addColorStop(.35, '#d946ef'); cg.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = cg; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1; ctx.restore();
}

/**
 * I AM ATOMIC — cutscene épica (X)
 * ESPAÇO PARA IMAGEM DO CID: substitua a seção "// ── IMAGEM CID ──" abaixo.
 * Para usar: passe imgCid (HTMLImageElement) como parâmetro extra e descomente o drawImage.
 */
export function desenharIAmAtomic(
  ctx: CanvasRenderingContext2D,
  timer: number, tick: number,
  canvasW: number, canvasH: number,
  atomicParticulas: { x: number; y: number; vx: number; vy: number; vida: number; r: number }[],
  atomicFase: 'charge' | 'release' | 'blast'
) {
  const W = canvasW, H = canvasH, prog = timer / ATOMIC_DUR;
  const fadeIn  = Math.min(1, timer / 30);
  const fadeOut = timer > ATOMIC_DUR - 50 ? Math.max(0, 1 - (timer - (ATOMIC_DUR - 50)) / 50) : 1;
  const alpha   = fadeIn * fadeOut;

  ctx.save();

  // ── Fundo escuro ──
  ctx.globalAlpha = alpha * .97;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // ── Raios roxos partindo do centro ──
  const cx = W / 2, cy = H * .5;
  const numRaios = 36;
  ctx.globalAlpha = alpha * (.3 + .2 * Math.sin(tick * .12));
  for (let i = 0; i < numRaios; i++) {
    const ra = (i / numRaios) * Math.PI * 2 + tick * .018;
    const len = (H * .75) * (.5 + Math.abs(Math.sin(ra * 3 + tick * .04)) * .5);
    const col = i % 3 === 0 ? '#d946ef' : i % 3 === 1 ? '#7c3aed' : '#a855f7';
    ctx.strokeStyle = col; ctx.lineWidth = .8 + Math.sin(tick * .07 + i) * .5;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ra) * len, cy + Math.sin(ra) * len * .7);
    ctx.stroke();
  }

  // ── Listras horizontais roxo neon (I Am Atomic lines) ──
  const numListras = 22;
  for (let l = 0; l < numListras; l++) {
    const ly = H * .04 + l * (H * .92 / numListras);
    const phase = tick * .06 + l * .7;
    const lAlpha = (.12 + .28 * Math.abs(Math.sin(phase))) * alpha;
    const lLen   = W * (.25 + .75 * Math.abs(Math.sin(phase * .5)));
    const lX     = (W - lLen) / 2 + Math.sin(phase * .3) * 50;
    const lCol   = l % 2 === 0 ? '#d946ef' : '#7c3aed';
    const lW     = l % 4 === 0 ? 3 : l % 2 === 0 ? 1.5 : .7;
    ctx.globalAlpha = lAlpha;
    ctx.strokeStyle = lCol; ctx.lineWidth = lW; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lX, ly); ctx.lineTo(lX + lLen, ly); ctx.stroke();
  }

  // ── Listras verticais ──
  const numVert = 12;
  for (let v = 0; v < numVert; v++) {
    const vx = W * .04 + v * (W * .92 / numVert) + Math.sin(tick * .05 + v) * 15;
    const vAlpha = (.08 + .2 * Math.abs(Math.sin(tick * .08 + v))) * alpha;
    const vH    = H * (.2 + .6 * Math.abs(Math.sin(tick * .04 + v * 1.3)));
    const vY    = (H - vH) / 2;
    ctx.globalAlpha = vAlpha;
    ctx.strokeStyle = v % 2 === 0 ? '#9333ea' : '#6d28d9';
    ctx.lineWidth = v % 3 === 0 ? 2 : .8;
    ctx.beginPath(); ctx.moveTo(vx, vY); ctx.lineTo(vx, vY + vH); ctx.stroke();
  }

  // ── Círculo de energia central roxo ──
  const rBase = 65 + Math.sin(tick * .1) * 18;
  const rPhase = prog < .15 ? prog / .15 : prog > .7 ? 1 - (prog - .7) / .3 : 1;
  ctx.globalAlpha = alpha * rPhase;
  const ecG = ctx.createRadialGradient(cx, cy, 0, cx, cy, rBase * 3.5);
  ecG.addColorStop(0, 'rgba(245,208,254,1)');
  ecG.addColorStop(.2, 'rgba(217,70,239,.85)');
  ecG.addColorStop(.5, 'rgba(124,58,237,.5)');
  ecG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ecG; ctx.beginPath(); ctx.arc(cx, cy, rBase * 3.5, 0, Math.PI * 2); ctx.fill();

  // Núcleo branco
  ctx.globalAlpha = alpha * (.85 + .15 * Math.sin(tick * .2));
  ctx.fillStyle = '#faf5ff'; ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 50;
  ctx.beginPath(); ctx.arc(cx, cy, rBase * .38, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ── Anel expansivo do blast ──
  if (prog > .22 && prog < .72) {
    const bp = (prog - .22) / .5;
    const bR = bp * Math.max(W, H) * 1.5;
    const bA = (1 - bp) * alpha;
    ctx.globalAlpha = bA * .75;
    ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 9 * (1 - bp);
    ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(cx, cy, bR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3.5 * (1 - bp);
    ctx.beginPath(); ctx.arc(cx, cy, bR * .82, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── Partículas ──
  ctx.globalAlpha = alpha;
  atomicParticulas.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vida--;
    if (p.vida <= 0) {
      p.x = cx + (Math.random() - .5) * 70; p.y = cy + (Math.random() - .5) * 70;
      const pa = Math.random() * Math.PI * 2;
      const pv = 2 + Math.random() * 7;
      p.vx = Math.cos(pa) * pv; p.vy = Math.sin(pa) * pv;
      p.vida = 30 + Math.random() * 60; p.r = 1.5 + Math.random() * 4.5;
    }
    const pa2 = Math.min(1, p.vida / 20) * alpha;
    const col = ['#e879f9','#d946ef','#a855f7','#f0abfc','#c026d3'][Math.floor(Math.random()*5)];
    ctx.save(); ctx.globalAlpha = pa2; ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  });

  // ── IMAGEM DO CID ──
  // 1. Cria o objeto de imagem e define a URL
const imgCid = new Image();
imgCid.src = "https://images8.alphacoders.com/130/1305233.png";

// 2. Descomente o bloco abaixo:
if (imgCid) {
    const iW = 200, iH = 300;
    const iX = W / 2 - iW / 2, iY = H / 2 - iH / 2 - 20;
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    // Aura ao redor da imagem
    ctx.shadowColor = '#d946ef'; 
    ctx.shadowBlur = 40;
    ctx.drawImage(imgCid, iX, iY, iW, iH);
    ctx.shadowBlur = 0;
    ctx.restore();
}

  // ── Texto "I... Am... Atomic" ──
  const textProg = Math.min(1, timer / 90) * fadeOut;
  ctx.save(); ctx.globalAlpha = textProg;
  ctx.textAlign = 'center';

  ctx.font = 'bold 54px serif';
  ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 44 + Math.sin(tick * .12) * 18;
  ctx.fillStyle = '#faf5ff';
  ctx.fillText('I... Am... Atomic', W / 2, H * .84);
  ctx.shadowBlur = 0;

  if (timer > 60) {
    const s2Alpha = Math.min(1, (timer - 60) / 30) * fadeOut;
    ctx.globalAlpha = s2Alpha;
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#e879f9';
    ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 10;
    ctx.fillText('"Se não posso sobreviver a uma explosão nuclear,', W / 2, H * .84 + 36);
    ctx.fillText('então eu mesmo me torno uma."', W / 2, H * .84 + 56);
    ctx.shadowBlur = 0;
  }

  // 🛡 INVULNERÁVEL
  ctx.globalAlpha = alpha * (.7 + .3 * Math.sin(tick * .2));
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#f0abfc';
  ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 12;
  ctx.fillText('🛡 INVULNERÁVEL', W / 2, 28); ctx.shadowBlur = 0;

  ctx.restore();

  // Barra de progresso
  ctx.globalAlpha = alpha * .5;
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(W * .1, H - 10, W * .8, 4);
  ctx.fillStyle = '#d946ef'; ctx.fillRect(W * .1, H - 10, W * .8 * prog, 4);

  ctx.globalAlpha = 1; ctx.restore();
}

// ══════════════════════════════════════════════════════════════
//  AIZEN — habilidades
// ══════════════════════════════════════════════════════════════

export const ILUSAO_DUR    = 16;
export const KYOKA_DUR     = 280;
export const KYOKA_CD_MAX  = 1200;
export const HOGYOKU_DUR   = 480;
export const HOGYOKU_CD_MAX = 18000;

export type IlusaoEfeito = { x: number; y: number; timer: number; maxTimer: number };

/** Ilusão (clique) — projétil de hipnose */
export function desenharProjetilIlusao(ctx: CanvasRenderingContext2D, p: { x: number; y: number; vx: number; vy: number; angulo: number; vida: number }) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angulo);
  const al = Math.min(1, p.vida / 10);
  ctx.globalAlpha = al * .5;
  ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(22, 0); ctx.stroke();
  ctx.globalAlpha = al;
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(22, 0); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(14, -5); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore();
}

/** Efeito no alvo quando a ilusão conecta */
export function desenharIlusaoImpacto(ctx: CanvasRenderingContext2D, ef: IlusaoEfeito) {
  const prog = ef.timer / ef.maxTimer;
  const r = 40 * prog, al = 1 - prog;
  ctx.save(); ctx.globalAlpha = al * .7;
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const fa = (i / 6) * Math.PI * 2 + prog * Math.PI;
    const fd = r * 1.2;
    ctx.save(); ctx.translate(ef.x + Math.cos(fa) * fd, ef.y + Math.sin(fa) * fd);
    ctx.rotate(fa + Math.PI / 4);
    ctx.globalAlpha = al * .6; ctx.fillStyle = '#fef9c3';
    ctx.fillRect(-4, -2, 8, 4); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.restore(); ef.timer++;
}

/**
 * Kyōka Suigetsu — Hadō #90: Kurohitsugi (Z do Aizen)
 * SEM cutscene de tela cheia. Desenha o caixão negro diretamente no mundo (em coordenadas de câmera).
 * Chame ANTES de ctx.restore() do bloco de câmera — ou passe offsets de câmera.
 * pos: posição MUNDIAL do alvo (cx, cy do grupo de inimigos ou do player como referência)
 */
export function desenharKyokaSuigetsu(
  ctx: CanvasRenderingContext2D,
  timer: number, tick: number,
  canvasW: number, canvasH: number,
  playerX: number, playerY: number
) {
  // Kurohitsugi: caixão preto com lanças roxas — aparece no centro do canvas (sobre tudo)
  const W = canvasW, H = canvasH;
  const prog = timer / KYOKA_DUR;

  // Aparece gradualmente nos primeiros 30 frames, some nos últimos 40
  const fadeIn  = Math.min(1, timer / 30);
  const fadeOut = timer > KYOKA_DUR - 40 ? Math.max(0, 1 - (timer - (KYOKA_DUR - 40)) / 40) : 1;
  const alpha   = fadeIn * fadeOut;

  if (alpha <= 0) return;

  // Pulso de energia ao redor do caixão
  const pulse = 1 + .06 * Math.sin(tick * .18);

  // Dimensões do caixão (em tela, não em mundo)
  const bW = 160 * pulse, bH = 240 * pulse;
  const bX = W / 2 - bW / 2, bY = H * .35 - bH / 2;
  const cx2 = W / 2, cy2 = H * .35;

  ctx.save();

  // ── Escurecimento atmosférico ──
  ctx.globalAlpha = alpha * .55;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // Gradiente roxo-escuro ao redor
  const bgG = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(W, H) * .8);
  bgG.addColorStop(0, 'rgba(76,29,149,.35)');
  bgG.addColorStop(.5, 'rgba(30,0,60,.25)');
  bgG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha * .7; ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

  // Partículas de energia gravitacional (flutuando em espiral)
  ctx.globalAlpha = alpha;
  for (let p = 0; p < 24; p++) {
    const pa = tick * .05 + p * (Math.PI * 2 / 24);
    const pd = (80 + p * 6) * pulse + Math.sin(tick * .08 + p) * 20;
    const pxP = cx2 + Math.cos(pa) * pd;
    const pyP = cy2 + Math.sin(pa) * pd * .6;
    ctx.globalAlpha = alpha * (.3 + .4 * Math.sin(tick * .1 + p));
    ctx.fillStyle = p % 3 === 0 ? '#7c3aed' : p % 3 === 1 ? '#4c1d95' : '#6d28d9';
    ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(pxP, pyP, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // ── Caixão negro — Kurohitsugi ──
  ctx.globalAlpha = alpha;

  // Sombra / brilho do caixão
  ctx.shadowColor = '#4c1d95'; ctx.shadowBlur = 40 + Math.sin(tick * .1) * 10;

  // Corpo principal preto
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(bX, bY, bW, bH); ctx.fill(); ctx.stroke();

  // Grade de energia roxa nas faces do caixão
  ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 1; ctx.globalAlpha = alpha * .4;
  // Linhas horizontais
  for (let row = 1; row < 5; row++) {
    const ly2 = bY + (bH / 5) * row;
    ctx.beginPath(); ctx.moveTo(bX, ly2); ctx.lineTo(bX + bW, ly2); ctx.stroke();
  }
  // Linhas verticais
  for (let col = 1; col < 4; col++) {
    const lx2 = bX + (bW / 4) * col;
    ctx.beginPath(); ctx.moveTo(lx2, bY); ctx.lineTo(lx2, bY + bH); ctx.stroke();
  }

  // Borda luminosa
  ctx.globalAlpha = alpha * (.5 + .3 * Math.sin(tick * .15));
  ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(bX + 3, bY + 3, bW - 6, bH - 6); ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha;

  // ── Lanças (hastes) perfurando o caixão — característico do Kurohitsugi ──
  const hastes = [
    // [xFrac, yFrac, anguloRad, comprimento, lado: 0=horizontal, 1=vertical]
    { xf: .5,  yf: 0,    ang: -Math.PI/2,   len: 90,  larg: 8  }, // topo centro
    { xf: .5,  yf: 1,    ang:  Math.PI/2,   len: 80,  larg: 7  }, // base centro
    { xf: 0,   yf: .5,   ang:  Math.PI,     len: 75,  larg: 7  }, // esquerda centro
    { xf: 1,   yf: .5,   ang:  0,           len: 75,  larg: 7  }, // direita centro
    { xf: .18, yf: .12,  ang: -Math.PI*.75, len: 65,  larg: 5  }, // canto superior esq
    { xf: .82, yf: .12,  ang: -Math.PI*.25, len: 65,  larg: 5  }, // canto superior dir
    { xf: .18, yf: .88,  ang:  Math.PI*.75, len: 60,  larg: 5  }, // canto inferior esq
    { xf: .82, yf: .88,  ang:  Math.PI*.25, len: 60,  larg: 5  }, // canto inferior dir
    { xf: .5,  yf: .22,  ang: -Math.PI/2,   len: 50,  larg: 4  }, // interno superior
    { xf: .5,  yf: .78,  ang:  Math.PI/2,   len: 50,  larg: 4  }, // interno inferior
    { xf: .22, yf: .5,   ang:  Math.PI,     len: 45,  larg: 4  }, // interno esq
    { xf: .78, yf: .5,   ang:  0,           len: 45,  larg: 4  }, // interno dir
  ];

  hastes.forEach(h => {
    const hx = bX + bW * h.xf, hy = bY + bH * h.yf;
    // Animação: as lanças avançam gradualmente
    const hProg = Math.min(1, Math.max(0, (prog * KYOKA_DUR - 15) / 60));
    const hLen = h.len * hProg;
    if (hLen <= 0) return;

    ctx.save(); ctx.translate(hx, hy); ctx.rotate(h.ang);

    // Corpo da lança
    ctx.fillStyle = '#1c0540'; ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 1.5;
    ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.rect(-h.larg / 2, 0, h.larg, hLen);
    ctx.fill(); ctx.stroke();

    // Ponta da lança (triângulo afiado)
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(-h.larg * .8, hLen);
    ctx.lineTo(h.larg * .8, hLen);
    ctx.lineTo(0, hLen + h.larg * 1.5);
    ctx.closePath(); ctx.fill();

    // Brilho na aresta
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-h.larg / 2, 0); ctx.lineTo(-h.larg / 2, hLen); ctx.stroke();

    ctx.shadowBlur = 0; ctx.restore();
  });

  // ── Cruzs no topo do caixão ──
  ctx.globalAlpha = alpha * (.8 + .2 * Math.sin(tick * .2));
  ctx.fillStyle = '#2e1065'; ctx.strokeStyle = '#6d28d9'; ctx.lineWidth = 2;
  ctx.shadowColor = '#4c1d95'; ctx.shadowBlur = 14;
  // Cruz central no topo
  const cSize = 18;
  ctx.beginPath();
  ctx.rect(cx2 - cSize * .15, bY - cSize * .7, cSize * .3, cSize * 1.4); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx2 - cSize * .7, bY - cSize * .15, cSize * 1.4, cSize * .3); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Texto do Kidō ──
  const tAlpha = Math.min(1, timer / 25) * fadeOut;
  ctx.save(); ctx.globalAlpha = tAlpha * .9; ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#7c3aed';
  ctx.shadowColor = '#4c1d95'; ctx.shadowBlur = 10;
  ctx.fillText('黒棺', cx2, bY - 28);
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#a78bfa';
  ctx.fillText('Hadō #90  ·  Kurohitsugi', cx2, bY - 12);
  ctx.shadowBlur = 0; ctx.restore();

  // ── Barra de duração ──
  ctx.globalAlpha = alpha * .4;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(W * .35, H - 8, W * .3, 3);
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(W * .35, H - 8, W * .3 * prog, 3);

  ctx.globalAlpha = 1; ctx.restore();
}

/**
 * Hōgyoku Fusion — Ultimate X do Aizen
 * ESPAÇO PARA IMAGEM DO AIZEN: substitua a seção "// ── IMAGEM AIZEN ──" abaixo.
 * Para usar: passe imgAizen (HTMLImageElement) como parâmetro extra e descomente o drawImage.
 */
export function desenharHogyokuFusion(
  ctx: CanvasRenderingContext2D,
  timer: number, tick: number,
  canvasW: number, canvasH: number,
  hogyokuParticulas: { x: number; y: number; vx: number; vy: number; vida: number; r: number; cor: string }[],
  hogyokuKilled: boolean
) {
  const W = canvasW, H = canvasH, prog = timer / HOGYOKU_DUR;
  const fadeIn  = Math.min(1, timer / 35);
  const fadeOut = timer > HOGYOKU_DUR - 55 ? Math.max(0, 1 - (timer - (HOGYOKU_DUR - 55)) / 55) : 1;
  const alpha   = fadeIn * fadeOut;

  ctx.save();

  // ── Fundo escuro com gradiente dourado-roxo ──
  ctx.globalAlpha = alpha * .96;
  ctx.fillStyle = '#08000f'; ctx.fillRect(0, 0, W, H);
  const bgG2 = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * .9);
  bgG2.addColorStop(0, 'rgba(168,85,247,.22)');
  bgG2.addColorStop(.4, 'rgba(120,50,0,.12)');
  bgG2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgG2; ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = alpha;

  // ── Partículas ──
  const pcors = ['#fbbf24', '#a855f7', '#f59e0b', '#c084fc', '#fff'];
  hogyokuParticulas.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vida--;
    if (p.vida <= 0) {
      p.x = W / 2 + (Math.random() - .5) * 80; p.y = H / 2 + (Math.random() - .5) * 80;
      const pa = Math.random() * Math.PI * 2; const pv = 1.5 + Math.random() * 5;
      p.vx = Math.cos(pa) * pv; p.vy = Math.sin(pa) * pv;
      p.vida = 40 + Math.random() * 80; p.r = 1.5 + Math.random() * 4;
      p.cor = pcors[Math.floor(Math.random() * pcors.length)];
    }
    const pA = Math.min(1, p.vida / 25) * alpha;
    ctx.save(); ctx.globalAlpha = pA; ctx.fillStyle = p.cor;
    ctx.shadowColor = p.cor; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  });

  // ── Hōgyoku (orbe no centro) ──
  const ax2 = W / 2, ay2 = H / 2;
  const orbR = 24 + Math.sin(tick * .1) * 5;

  ctx.globalAlpha = alpha * .45;
  for (let r = 0; r < 28; r++) {
    const ra = (r / 28) * Math.PI * 2 + tick * .028;
    const rl = 90 + Math.sin(tick * .07 + r * 1.3) * 45;
    ctx.strokeStyle = r % 3 === 0 ? '#fbbf24' : r % 3 === 1 ? '#a855f7' : '#fde68a';
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(ax2, ay2); ctx.lineTo(ax2 + Math.cos(ra) * rl, ay2 + Math.sin(ra) * rl * .7); ctx.stroke();
  }

  ctx.globalAlpha = alpha * (.85 + .15 * Math.sin(tick * .15));
  const og = ctx.createRadialGradient(ax2, ay2, 0, ax2, ay2, orbR * 2.8);
  og.addColorStop(0, '#fff'); og.addColorStop(.2, '#fef9c3');
  og.addColorStop(.5, '#fbbf24'); og.addColorStop(.8, '#a855f7'); og.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = og; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 55;
  ctx.beginPath(); ctx.arc(ax2, ay2, orbR * 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(ax2, ay2, orbR, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Olho no interior
  ctx.globalAlpha = alpha * .9;
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath(); ctx.ellipse(ax2, ay2, orbR * .6, orbR * .35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.ellipse(ax2, ay2, orbR * .2, orbR * .35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(ax2, ay2, orbR * .07, orbR * .25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(ax2 + orbR * .09, ay2 - orbR * .1, orbR * .06, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = alpha * .5;
  for (let ring = 0; ring < 3; ring++) {
    const rr = orbR * (1.9 + ring * .95), ra2 = tick * (.032 + ring * .012) + ring * Math.PI / 3;
    ctx.strokeStyle = ring % 2 === 0 ? '#fbbf24' : '#a855f7';
    ctx.lineWidth = 2 - ring * .4;
    ctx.beginPath(); ctx.ellipse(ax2, ay2, rr, rr * .55, ra2, 0, Math.PI * 2); ctx.stroke();
  }

  // ── IMAGEM DO AIZEN ──
// 1. Cria o objeto de imagem e define a URL
const imgAizen = new Image();
imgAizen.src = "https://i.redd.it/bia059noqgq41.jpg";

// 2. Bloco de desenho da imagem
if (imgAizen) {
    const iW = 200, iH = 300;
    const iX = W * 0.28 - iW / 2;  // Lado esquerdo
    const iY = H / 2 - iH / 2;
    
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    // Aura amarela/dourada ao redor da imagem
    ctx.shadowColor = '#fbbf24'; 
    ctx.shadowBlur = 35;
    ctx.drawImage(imgAizen, iX, iY, iW, iH);
    ctx.shadowBlur = 0;
    ctx.restore();
}

  // ── Texto "Yokoso Watashi no Soul Society" ──
  const tp2 = Math.min(1, timer / 50) * fadeOut;
  ctx.save(); ctx.globalAlpha = tp2; ctx.textAlign = 'center';

  ctx.font = 'bold 20px serif'; ctx.fillStyle = '#fde68a';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 24;
  ctx.fillText('ようこそ私のSoul Society', W / 2, H * .11);

  ctx.font = 'bold 30px serif'; ctx.fillStyle = '#fff'; ctx.shadowBlur = 18;
  ctx.fillText('Yokoso Watashi no Soul Society', W / 2, H * .11 + 40);

  if (timer > 60) {
    const s2A = Math.min(1, (timer - 60) / 25) * fadeOut;
    ctx.globalAlpha = s2A;
    ctx.font = 'italic 13px monospace'; ctx.fillStyle = '#fbbf24'; ctx.shadowBlur = 10;
    ctx.fillText('"Desde o início, nenhum de vocês teve chance de me derrotar."', W / 2, H * .11 + 68);
  }

  ctx.shadowBlur = 0; ctx.restore();

  if (hogyokuKilled && timer > HOGYOKU_DUR / 2) {
    const kf = Math.min(1, (timer - HOGYOKU_DUR / 2) / 30) * fadeOut;
    ctx.save(); ctx.globalAlpha = kf; ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fef9c3';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14;
    ctx.fillText('— Todos os inimigos: ilusão desfeita. —', W / 2, H * .88);
    ctx.shadowBlur = 0; ctx.restore();
  }

  // 🛡 INVULNERÁVEL
  ctx.globalAlpha = alpha * (.7 + .3 * Math.sin(tick * .2));
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fde68a'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
  ctx.fillText('🛡 INVULNERÁVEL', W / 2, 28); ctx.shadowBlur = 0;

  ctx.globalAlpha = alpha * .5;
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(W * .1, H - 10, W * .8, 4);
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(W * .1, H - 10, W * .8 * prog, 4);

  ctx.globalAlpha = 1; ctx.restore();
}
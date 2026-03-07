'use client';

import { useEffect, useRef, useState } from 'react';

type Projetil = { x: number; y: number; vx: number; vy: number; tipo: string; angulo: number; };
type AtaqueMelee = { ativo: boolean; anguloAtual: number; duracao: number; };

export default function Jogo2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [carregado, setCarregado] = useState(false);
  
  // Estados para as imagens
  const [imgPlayer, setImgPlayer] = useState<HTMLImageElement | null>(null);
  const [imgArma, setImgArma] = useState<HTMLImageElement | null>(null);
  const [imgCenarioJogo, setImgCenarioJogo] = useState<HTMLImageElement | null>(null);

  const [status, setStatus] = useState({
    nome: 'Herói', classe: 'guerreiro',
    str: 10, agi: 10, int: 10, vit: 10
  });

  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 2000;

  useEffect(() => {
    const nome = localStorage.getItem('glory_dark_char_nome') || 'Guilherme'; 
    const classe = (localStorage.getItem('glory_dark_char_classe') || 'guerreiro').toLowerCase();
    
    setStatus(prev => ({ ...prev, nome, classe }));

    const linksPersonagens: { [key: string]: string } = {
      guerreiro: 'LINK_AQUI_PERSONAGEM_GUERREIRO',
      mago:      'https://pngimg.com/uploads/wizard/wizard_PNG18.png', 
      sombrio:   'LINK_AQUI_PERSONAGEM_ASSASSINO',
    };

    const linksArmas: { [key: string]: string } = {
      guerreiro: 'LINK_AQUI_MACHADO',
      mago:      'https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png',
      sombrio:   'LINK_AQUI_FACAS',
    };

    const carregarImagem = (src: string, setter: (img: HTMLImageElement) => void) => {
      if (!src || src.includes('LINK_AQUI')) return;
      const img = new Image();
      img.src = src;
      img.onload = () => setter(img);
    };
    
    // 1. Carrega a imagem de fundo do JOGO
    carregarImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg', setImgCenarioJogo);
    
    // 2. Carrega assets do personagem
    carregarImagem(linksPersonagens[classe], setImgPlayer);
    carregarImagem(linksArmas[classe], setImgArma);

    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const projectiles: Projetil[] = [];
    let melee: AtaqueMelee = { ativo: false, anguloAtual: 0, duracao: 0 };

    const player = {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      speed: 3 + (status.agi * 0.2),
      size: 80,
      direcaoRad: 0,
      color: status.classe === 'mago' ? '#a855f7' : status.classe === 'guerreiro' ? '#ef4444' : '#10b981',
    };

    const camera = { x: 0, y: 0 };
    const teclas: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      teclas[e.key.toLowerCase()] = true;
      if (e.code === 'Space') {
        if (status.classe === 'guerreiro') {
          if (!melee.ativo) { melee.ativo = true; melee.duracao = 12; melee.anguloAtual = player.direcaoRad - 1.2; }
        } else {
          projectiles.push({
            x: player.x + player.size/2, y: player.y + player.size/2,
            vx: Math.cos(player.direcaoRad) * 12, vy: Math.sin(player.direcaoRad) * 12,
            tipo: status.classe, angulo: player.direcaoRad
          });
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => teclas[e.key.toLowerCase()] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationId: number;
    const render = () => {
      // Movimentação
      let dx = 0, dy = 0;
      if (teclas['w']) dy = -1; if (teclas['s']) dy = 1;
      if (teclas['a']) dx = -1; if (teclas['d']) dx = 1;
      if (dx !== 0 || dy !== 0) {
        const newX = player.x + dx * player.speed;
        const newY = player.y + dy * player.speed;
        if (newX > 0 && newX < WORLD_WIDTH - player.size) player.x = newX;
        if (newY > 0 && newY < WORLD_HEIGHT - player.size) player.y = newY;
        player.direcaoRad = Math.atan2(dy, dx);
      }

      // Câmera
      camera.x = Math.max(0, Math.min(player.x + player.size / 2 - canvas.width / 2, WORLD_WIDTH - canvas.width));
      camera.y = Math.max(0, Math.min(player.y + player.size / 2 - canvas.height / 2, WORLD_HEIGHT - canvas.height));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- INÍCIO CÂMERA ---
      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      // 3. DESENHAR O CENÁRIO (A imagem do Dribbble)
      if (imgCenarioJogo) {
        const ptrn = ctx.createPattern(imgCenarioJogo, 'repeat');
        if (ptrn) {
          ctx.fillStyle = ptrn;
          ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        }
      } else {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      }
      
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // 4. Projéteis
      projectiles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angulo);
        if (imgArma) ctx.drawImage(imgArma, -25, -25, 50, 50);
        else { ctx.fillStyle = '#f59e0b'; ctx.fillRect(-15, -4, 30, 8); }
        ctx.restore();
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) projectiles.splice(i, 1);
      });

      // 5. Ataque Melee
      if (melee.ativo) {
        melee.duracao--; melee.anguloAtual += 0.25;
        ctx.save();
        ctx.translate(player.x + player.size/2, player.y + player.size/2);
        ctx.rotate(melee.anguloAtual);
        if (imgArma) ctx.drawImage(imgArma, 40, -30, 60, 60);
        else { ctx.fillStyle = '#ef4444'; ctx.fillRect(45, -10, 25, 20); }
        ctx.restore();
        if (melee.duracao <= 0) melee.ativo = false;
      }

      // 6. Personagem
      ctx.shadowBlur = 15; ctx.shadowColor = player.color;
      if (imgPlayer) {
        ctx.drawImage(imgPlayer, player.x, player.y, player.size, player.size);
      } else {
        ctx.fillStyle = player.color; ctx.fillRect(player.x, player.y, player.size, player.size);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(status.nome.toUpperCase(), player.x + player.size/2, player.y - 15);

      ctx.restore();
      // --- FIM CÂMERA ---

      // Mini-mapa
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, 10, 150, 100);
      ctx.fillStyle = player.color;
      ctx.fillRect(10 + (player.x / WORLD_WIDTH) * 150, 10 + (player.y / WORLD_HEIGHT) * 100, 5, 5);

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [carregado, status, imgPlayer, imgArma, imgCenarioJogo]);

  return (
    <main className="relative min-h-screen bg-black flex flex-col items-center justify-center font-serif text-white overflow-hidden">
      
      {/* --- FUNDO DO SITE ILUMINADO (Opacity de 20 para 80) --- */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-80 pointer-events-none"
        style={{ backgroundImage: "url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} 
      />

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl">
           MAPA EXPLORÁVEL | {status.nome}
        </div>
        <canvas ref={canvasRef} width={900} height={600} className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">W A S D para mover • Espaço para atacar</p>
      </div>
    </main>
  );
}
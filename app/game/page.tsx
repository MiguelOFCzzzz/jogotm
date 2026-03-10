'use client';

import { useEffect, useRef, useState } from 'react';

type Projetil = { x: number; y: number; vx: number; vy: number; tipo: string; angulo: number; dano: number; };
type AtaqueMelee = { ativo: boolean; anguloAtual: number; duracao: number; dano: number; };
type Monstro = { id: number; x: number; y: number; hp: number; maxHp: number; size: number; cor: string; isBoss?: boolean; };

export default function Jogo2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [carregado, setCarregado] = useState(false);
  
  const [imgPlayer, setImgPlayer] = useState<HTMLImageElement | null>(null);
  const [imgArma, setImgArma] = useState<HTMLImageElement | null>(null);
  const [imgCenarioJogo, setImgCenarioJogo] = useState<HTMLImageElement | null>(null);

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
      sombrio:   'https://img.favpng.com/16/12/24/assassin-s-creed-syndicate-assassin-s-creed-unity-playstation-4-desktop-wallpaper-png-favpng-NP3W4z5WVNcCqS7GKst0iPSiq.jpg',
    };

    const linksArmas: { [key: string]: string } = {
      guerreiro: 'https://toppng.com/public/uploads/preview/pixel-axe-pixel-art-11562940250p3un3f5yyo.png',
      mago:      'https://toppng.com/uploads/preview/pixel-fireball-fireball-pixel-art-115631306101ozjjztwry.png',
      sombrio:   'https://w7.pngwing.com/pngs/45/626/png-transparent-pixel-art-dagger-sword-knife-sword-angle-electronics-pixel-art.png',
    };

    const carregarImagem = (src: string, setter: (img: HTMLImageElement) => void) => {
      if (!src || src.includes('LINK_AQUI')) return;
      const img = new Image();
      img.src = src;
      img.onload = () => setter(img);
    };
    
    carregarImagem('https://cdn.dribbble.com/userupload/6971290/file/original-bbdec9f6c18546a8715f5cd5493d925d.jpg', setImgCenarioJogo);
    carregarImagem(linksPersonagens[classe], setImgPlayer);
    carregarImagem(linksArmas[classe], setImgArma);

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
    let estadoJogo = 'jogando'; // 'jogando', 'gameover', 'vitoria'

    // Geração de Ondas Reduzida
    const gerarOnda = (onda: number): Monstro[] => {
      if (onda === 5) {
        return [{ id: 999, x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT, hp: 1000, maxHp: 1000, size: 200, cor: '#dc2626', isBoss: true }];
      }
      
      const quantidade = 3 + (onda * 2); // Onda 1 = 5, Onda 2 = 7...
      return Array.from({ length: quantidade }, (_, i) => ({
        id: i,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        hp: 30 + (onda * 20),
        maxHp: 30 + (onda * 20),
        size: 50 + (onda * 5),
        cor: '#10b981' // Verde esmeralda
      }));
    };

    let monstros = gerarOnda(ondaAtual);

    const player = {
      x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2,
      speed: 3 + (status.agi * 0.15), size: 80,
      direcaoRad: 0, color: status.classe === 'mago' ? '#a855f7' : status.classe === 'guerreiro' ? '#ef4444' : '#10b981',
      cooldownAtaque: 0
    };

    const camera = { x: 0, y: 0 };
    const teclas: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => teclas[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => teclas[e.key.toLowerCase()] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationId: number;
    const render = () => {
      if (estadoJogo !== 'jogando') {
        // TELA FINAL (Vitória ou Game Over)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = estadoJogo === 'vitoria' ? '#fbbf24' : '#ef4444';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(estadoJogo === 'vitoria' ? 'VITÓRIA!' : 'GAME OVER', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Recarregue a página (F5) para jogar novamente', canvas.width / 2, canvas.height / 2 + 40);
        return; // Para o loop
      }

      // Movimentação
      let dx = 0, dy = 0;
      if (teclas['w']) dy = -1; if (teclas['s']) dy = 1;
      if (teclas['a']) dx = -1; if (teclas['d']) dx = 1;
      
      if (dx !== 0 || dy !== 0) {
        const nx = player.x + dx * player.speed;
        const ny = player.y + dy * player.speed;
        if (nx > 0 && nx < WORLD_WIDTH - player.size) player.x = nx;
        if (ny > 0 && ny < WORLD_HEIGHT - player.size) player.y = ny;
        player.direcaoRad = Math.atan2(dy, dx);
      }

      // Lógica de Ataque (Mais Rápido)
      if (teclas[' '] && player.cooldownAtaque <= 0) {
        if (status.classe === 'guerreiro') {
          melee.ativo = true;
          melee.duracao = 12; // Animação mais curta/rápida
          melee.anguloAtual = player.direcaoRad - 1.2;
        } else {
          projectiles.push({
            x: player.x + player.size/2, y: player.y + player.size/2,
            vx: Math.cos(player.direcaoRad) * 15, // Velocidade do tiro aumentada
            vy: Math.sin(player.direcaoRad) * 15,
            tipo: status.classe, angulo: player.direcaoRad, dano: 15 + status.int
          });
        }
        player.cooldownAtaque = 15; // Cooldown reduzido (pode atirar/bater mais rápido)
      }
      if (player.cooldownAtaque > 0) player.cooldownAtaque--;

      // Progressão
      if (monstros.length === 0) {
        if (ondaAtual < 5) {
          ondaAtual++;
          monstros = gerarOnda(ondaAtual);
        } else {
          estadoJogo = 'vitoria';
        }
      }

      // Câmera
      camera.x = Math.max(0, Math.min(player.x + player.size / 2 - canvas.width / 2, WORLD_WIDTH - canvas.width));
      camera.y = Math.max(0, Math.min(player.y + player.size / 2 - canvas.height / 2, WORLD_HEIGHT - canvas.height));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      // Cenário
      if (imgCenarioJogo) {
        const ptrn = ctx.createPattern(imgCenarioJogo, 'repeat');
        if (ptrn) { ctx.fillStyle = ptrn; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); }
      }

      // Monstros
      monstros.forEach((m, idx) => {
        const dist = Math.hypot(player.x - m.x, player.y - m.y);
        if (dist < 800) {
            const velocidadeMonstro = m.isBoss ? 0.005 : 0.01;
            m.x += (player.x - m.x) * velocidadeMonstro;
            m.y += (player.y - m.y) * velocidadeMonstro;
            
            if (dist < (m.isBoss ? 100 : 40)) {
               playerHp -= (m.isBoss ? 2 : 0.5);
               if (playerHp <= 0) estadoJogo = 'gameover';
            }
        }

        // Monstros "Mais Bonitos" (Bordas arredondadas e Brilho)
        ctx.shadowBlur = m.isBoss ? 30 : 15;
        ctx.shadowColor = m.cor;
        ctx.fillStyle = m.cor;
        ctx.beginPath();
        ctx.roundRect(m.x, m.y, m.size, m.size, 12); // Arredonda os cantos
        ctx.fill();
        ctx.shadowBlur = 0; // Tira o brilho para não afetar o resto
        
        // HP do Monstro
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(m.x, m.y - 12, m.size, 6);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(m.x, m.y - 12, (m.hp / m.maxHp) * m.size, 6);

        if (melee.ativo) {
            const mDist = Math.hypot((player.x + player.size/2) - (m.x + m.size/2), (player.y + player.size/2) - (m.y + m.size/2));
            if (mDist < (m.isBoss ? 150 : 100)) {
                m.hp -= 2; 
                if (!m.isBoss) m.x += Math.cos(player.direcaoRad) * 10; 
            }
        }
        if (m.hp <= 0) monstros.splice(idx, 1);
      });

      // Projéteis
      projectiles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angulo);
        if (imgArma) ctx.drawImage(imgArma, -20, -20, 40, 40);
        ctx.restore();

        monstros.forEach(m => {
            if (p.x > m.x && p.x < m.x + m.size && p.y > m.y && p.y < m.y + m.size) {
                m.hp -= p.dano / 5;
                projectiles.splice(i, 1);
            }
        });
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) projectiles.splice(i, 1);
      });

      // Ataque Melee
      if (melee.ativo) {
        melee.duracao--; 
        melee.anguloAtual += 0.25; // Animação de giro mais rápida
        ctx.save();
        ctx.translate(player.x + player.size/2, player.y + player.size/2);
        ctx.rotate(melee.anguloAtual);
        if (imgArma) ctx.drawImage(imgArma, 40, -30, 60, 60);
        ctx.restore();
        if (melee.duracao <= 0) melee.ativo = false;
      }

      // Player
      if (imgPlayer) {
        ctx.drawImage(imgPlayer, player.x, player.y, player.size, player.size);
      } else {
        ctx.fillStyle = player.color; ctx.fillRect(player.x, player.y, player.size, player.size);
      }

      ctx.restore();

      // UI
      ctx.fillStyle = '#333'; ctx.fillRect(20, canvas.height - 40, 200, 20);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(20, canvas.height - 40, (Math.max(0, playerHp) / status.hpMax) * 200, 20);
      ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`HP: ${Math.floor(Math.max(0, playerHp))} / ${status.hpMax}`, 25, canvas.height - 26);

      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(ondaAtual === 5 ? '⚠️ ONDA FINAL: BOSS ⚠️' : `ONDA: ${ondaAtual} / 5`, 20, 40);

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
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-80 pointer-events-none"
        style={{ backgroundImage: "url('https://www.shutterstock.com/image-vector/pixel-art-8-bit-retro-600nw-2513324701.jpg')" }} />

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 bg-zinc-900/90 p-3 rounded-full border border-purple-900/30 text-[10px] font-bold uppercase tracking-widest shadow-xl">
           MODO COMBATE | {status.nome} | CLASSE: {status.classe.toUpperCase()}
        </div>
        <canvas ref={canvasRef} width={900} height={600} className="bg-zinc-950 rounded-lg border-2 border-white/5 shadow-2xl" />
        <p className="mt-4 text-zinc-500 text-[10px] text-center uppercase tracking-tighter">Use as magias para derrotar os monstros! Sobreviva até a onda 5.</p>
      </div>
    </main>
  );
}
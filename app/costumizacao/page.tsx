'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Classe = {
  id: string;
  nome: string;
  descricao: string;
  imagem: string;
  atributos: { str: number; agi: number; int: number; vit: number };
};

const CLASSES: Classe[] = [
  { 
    id: 'guerreiro', nome: 'SUKUNA', 
    descricao: 'FUKUMA MIZUSHI...',
    imagem: '⛩️', 
    atributos: { str: 10, agi: 4, int: 2, vit: 9 } 
  },
  { 
    id: 'mago', nome: 'GOJO', 
    descricao: 'MURYO KUSHO...',
    imagem: '🤞', 
    atributos: { str: 2, agi: 5, int: 10, vit: 4 } 
  },
  { 
    id: 'sombrio', nome: 'Sung Jin-Woo', 
    descricao: 'ARISE SHADOW LEGION...',
    imagem: '🆙', 
    atributos: { str: 5, agi: 10, int: 5, vit: 3 } 
  },
  {
    id: 'shadow',
    nome: 'CID KAGENOU',
    descricao: 'I AM ATOMIC...',
    imagem: '☢️',
    atributos: { str: 7, agi: 9, int: 6, vit: 5 },
  },
  {
    id: 'aizen',
    nome: 'AIZEN',
    descricao: 'KANZEN SAIMIN...',
    imagem: '🥋',
    atributos: { str: 4, agi: 6, int: 10, vit: 7 },
  },
];

// Badge de raridade por classe
const RARIDADE: Record<string, { label: string; cor: string }> = {
  guerreiro: { label: 'LENDÁRIO', cor: '#ef4444' },
  mago:      { label: 'LENDÁRIO', cor: '#55f7f4' },
  sombrio:   { label: 'LENDÁRIO', cor: '#6366f1' },
  shadow:    { label: 'MÍTICO',   cor: '#22d3ee' },
  aizen:     { label: 'MÍTICO',   cor: '#fbbf24' },
};

function ConteudoCostumizacao() {
  const [classeSel, setClasseSel] = useState<Classe>(CLASSES[0]);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sala_codigo = searchParams.get('sala');

  const aceitarDestino = () => {
    if (!nome.trim()) {
      alert("Escreva o nome do seu herói nas crônicas!");
      return;
    }
    if (!sala_codigo) {
      alert("Erro: Código da sala não encontrado.");
      return;
    }
  
    setLoading(true);
  
    try {
      // 1. Salva os dados localmente para o jogo ler na próxima tela
      localStorage.setItem('glory_dark_char_nome',   nome);
      localStorage.setItem('glory_dark_char_classe', classeSel.id);
      localStorage.setItem('glory_dark_char_str',    String(classeSel.atributos.str));
      localStorage.setItem('glory_dark_char_agi',    String(classeSel.atributos.agi));
      localStorage.setItem('glory_dark_char_int',    String(classeSel.atributos.int));
      localStorage.setItem('glory_dark_char_vit',    String(classeSel.atributos.vit));
      localStorage.setItem('glory_dark_last_sala',   sala_codigo);
  
      // 2. Pequeno delay para o feedback visual de "Selando..."
      setTimeout(() => {
        router.push(`/game?sala=${sala_codigo}`);
      }, 800);
  
    } catch (error) {
      console.error("Erro ao preparar jornada:", error);
      alert("Falha ao despertar seus poderes. Tente novamente.");
      setLoading(false);
    }
  };

  const rar = RARIDADE[classeSel.id];

  // Cor de destaque por classe (usada em vários lugares)
  const COR: Record<string, string> = {
    
    guerreiro: '#ef4444',
    mago:      '#24dddd',
    sombrio:   '#6366f1',
    shadow:    '#b700ff',
    aizen:     '#ffffff',
  };
  const corAtual = COR[classeSel.id] ?? '#ef4444';

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center bg-black font-serif p-4 md:p-10 overflow-hidden">
      {/* Fundo */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale-[50%]"
        style={{ backgroundImage: "url('https://img.freepik.com/fotos-premium/velocidade-da-luz-redemoinho-de-vortice-neon-linhas-torcidas-brilhantes-em-movimento-hiper-salto-para-outra-galaxia_35672-1767.jpg')" }} 
      />
      {/* Overlay de cor dinâmica */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at center, ${corAtual}11 0%, transparent 70%)` }}
      />

      <div className="relative z-20 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">

        {/* ── Coluna esquerda: lista de classes ── */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-center lg:text-left"
            style={{ color: corAtual }}>
            Escolha sua linhagem
          </h2>

          {CLASSES.map((c) => {
            const ativo = classeSel.id === c.id;
            const cor = COR[c.id];
            return (
              <button
                key={c.id}
                onClick={() => setClasseSel(c)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group ${
                  ativo ? 'bg-zinc-900/80' : 'bg-zinc-900/50 hover:bg-zinc-900/70'
                }`}
                style={{
                  borderColor: ativo ? cor : 'rgba(255,255,255,0.06)',
                  boxShadow: ativo ? `0 0 18px ${cor}44` : 'none',
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">
                    {c.imagem}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-bold uppercase tracking-wider text-sm">{c.nome}</h3>
                      {/* badge mítico */}
                      {(c.id === 'shadow' || c.id === 'aizen') && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest"
                          style={{ background: `${COR[c.id]}22`, color: COR[c.id], border: `1px solid ${COR[c.id]}55` }}>
                          MÍTICO
                        </span>
                      )}
                    </div>
                    <p className="text-xs line-clamp-1" style={{ color: `${cor}88` }}>{c.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Coluna central: preview ── */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-zinc-950/60 rounded-3xl p-6 relative min-h-[420px]"
          style={{ borderLeft: `1px solid ${corAtual}22`, borderRight: `1px solid ${corAtual}22` }}>

          {/* Input nome */}
          <div className="absolute top-8 w-full px-8">
            <input 
              type="text" 
              placeholder="NOME DO PERSONAGEM..."
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              className="w-full bg-transparent outline-none text-center text-xl font-bold text-white placeholder:text-white/20 transition-all border-b-2"
              style={{ borderColor: `${corAtual}66` }}
            />
          </div>

          {/* Emoji grande */}
          <div className="text-[120px] md:text-[180px] drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] animate-pulse select-none">
            {classeSel.imagem}
          </div>

          {/* Nome + badge + linha */}
          <div className="absolute bottom-10 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{classeSel.nome}</h2>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{ background: `${corAtual}22`, color: corAtual, border: `1px solid ${corAtual}55` }}>
                {rar.label}
              </span>
            </div>
            <div className="h-1 w-20 mx-auto rounded-full" style={{ background: corAtual, boxShadow: `0 0 10px ${corAtual}` }} />
          </div>
        </div>

        {/* ── Coluna direita: atributos + botão ── */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-8 bg-zinc-900/90 p-8 rounded-xl border-2 shadow-2xl"
          style={{ borderColor: `${corAtual}44` }}>

          <div className="space-y-6">
            <h3 className="font-bold uppercase tracking-widest text-center border-b pb-4 text-sm"
              style={{ color: corAtual, borderColor: `${corAtual}33` }}>
              Potencial Arcano
            </h3>

            {/* Descrição temática */}
            <p className="text-xs text-center italic leading-relaxed"
              style={{ color: `${corAtual}99` }}>
              {classeSel.id === 'shadow'
                ? '"É claro que eu sou o vilão. Era assim que deveria ser."'
                : classeSel.id === 'aizen'
                ? '"Desde o início, nenhum de vocês tinha chance de me derrotar."'
                : classeSel.id === 'sombrio'
                ? '"ARISE. Toda sombra responde ao Monarca."'
                : classeSel.id === 'mago'
                ? '"Você acha que eu me limito a um domínio?"'
                : '"Espere... eu ainda não terminei de rezar."'}
            </p>

            {/* Barras de atributo */}
            {Object.entries(classeSel.atributos).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-xs uppercase font-bold tracking-widest"
                  style={{ color: `${corAtual}99` }}>
                  <span>
                    {key === 'str' ? 'Força' : key === 'agi' ? 'Agilidade' : key === 'int' ? 'Inteligência' : 'Vitalidade'}
                  </span>
                  <span style={{ color: corAtual }}>{val} / 10</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(val / 10) * 100}%`,
                      background: `linear-gradient(90deg, ${corAtual}88, ${corAtual})`,
                      boxShadow: `0 0 8px ${corAtual}88`,
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Habilidades rápidas */}
            <div className="mt-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: `${corAtual}77` }}>Habilidades</p>
              <div className="text-[11px] text-white/50 space-y-0.5 leading-relaxed">
                {classeSel.id === 'guerreiro' && <>
                  <div>⠀🔥 <span className="text-white/70">Projétil de Fogo</span> — Espaço</div>
                  <div>⠀🌪 <span className="text-white/70">Furacão</span> — Z</div>
                  <div>⠀💢 <span className="text-white/70">Ryōiki Tenkai</span> — X</div>
                </>}
                {classeSel.id === 'mago' && <>
                  <div>⠀🔴 <span className="text-white/70">Red (repulsão)</span> — Clique</div>
                  <div>⠀🟣 <span className="text-white/70">Hollow Purple</span> — Z</div>
                  <div>⠀∞ <span className="text-white/70">Ryōiki Tenkai</span> — X</div>
                </>}
                {classeSel.id === 'sombrio' && <>
                  <div>⠀🗡 <span className="text-white/70">Corte Sombrio</span> — Espaço</div>
                  <div>⠀💀 <span className="text-white/70">ARISE</span> — Z (5 kills)</div>
                  <div>⠀⚔ <span className="text-white/70">Igris + Beru</span> — X</div>
                </>}
                {classeSel.id === 'shadow' && <>
                  <div>⠀🌑 <span className="text-white/70">Shadow Slash</span> — Espaço</div>
                  <div>⠀⚫ <span className="text-white/70">Ebony Swirl</span> — Z</div>
                  <div>⠀💫 <span className="text-white/70">I Am Atomic</span> — X</div>
                </>}
                {classeSel.id === 'aizen' && <>
                  <div>⠀🪞 <span className="text-white/70">Ilusão</span> — Clique</div>
                  <div>⠀✨ <span className="text-white/70">Hado 90</span> — Z</div>
                  <div>⠀🌑 <span className="text-white/70">Hōgyoku Fusion</span> — X</div>
                </>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-center italic"
              style={{ color: `${corAtual}55` }}>
              "Sua jornada na sala {sala_codigo || '...'} está prestes a começar."
            </p>
            <button 
              onClick={aceitarDestino}
              disabled={loading}
              className={`w-full text-white font-black py-4 rounded-lg uppercase tracking-[0.2em] text-lg border-t border-white/10 transition-all active:translate-y-1 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: corAtual,
                boxShadow: `0 4px 0 ${corAtual}88, 0 0 20px ${corAtual}44`,
              }}
            >
              {loading ? 'SELANDO...' : 'Aceitar Destino'}
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={() => window.history.back()}
        className="absolute bottom-4 left-4 text-[10px] hover:opacity-80 uppercase tracking-widest transition-opacity"
        style={{ color: `${corAtual}66` }}
      >
        ← Retornar à Taverna
      </button>
    </main>
  );
}

export default function CostumizacaoPersonagem() {
  return (
    <Suspense fallback={
      <div className="bg-black min-h-screen flex items-center justify-center text-red-500">
        Invocando Portal...
      </div>
    }>
      <ConteudoCostumizacao />
    </Suspense>
  );
}
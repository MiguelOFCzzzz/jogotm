'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

const COR_CLASSE: Record<string, string> = {
  guerreiro: '#ef4444',
  mago:      '#24dddd',
  sombrio:   '#6366f1',
  shadow:    '#b700ff',
  aizen:     '#ffffff',
};


const PREVIEW_CLASSES = [
  { id: 'guerreiro', emoji: '⛩️', nome: 'SUKUNA' },
  { id: 'mago',      emoji: '🤞', nome: 'GOJO'   },
  { id: 'sombrio',   emoji: '🆙', nome: 'SUNG JIN-WOO'},
  { id: 'shadow',    emoji: '☢️', nome: 'SHADOW', mitico: true },
  { id: 'aizen',     emoji: '🥋', nome: 'AIZEN',  mitico: true },
];

export default function RpgLobby() {
  const router = useRouter();

  const [tela, setTela] = useState<'inicial' | 'lobby'>('inicial');
  const [nome, setNome] = useState('');
  const [limiteJogadores, setLimiteJogadores] = useState(4);
  const [codigoSalaInput, setCodigoSalaInput] = useState('');

  const [codigoSala, setCodigoSala] = useState('');
  const [jogadores, setJogadores] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);

  const [heroiSalvo, setHeroiSalvo] = useState<{nome: string, sala: string} | null>(null);

  const socketRef    = useRef<Socket | null>(null);
  // ── FIX: ref para o código sempre atualizado dentro dos listeners ──
  const codigoSalaRef = useRef('');
  const nomeRef       = useRef('');

  // Mantém os refs sincronizados com o estado
  useEffect(() => { codigoSalaRef.current = codigoSala; }, [codigoSala]);
  useEffect(() => { nomeRef.current = nome; }, [nome]);

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('glory_dark_char_nome');
    const salaSalva = localStorage.getItem('glory_dark_last_sala');
    if (nomeSalvo && salaSalva) setHeroiSalvo({ nome: nomeSalvo, sala: salaSalva });

    const socketURL = typeof window !== 'undefined' && window.location.hostname.includes('railway.app')
      ? 'https://jogotm-production-9b1e.up.railway.app'
      : 'http://localhost:8080';

    socketRef.current = io(socketURL, { transports: ['websocket'] });

    socketRef.current.on('sala_criada', (codigo: string) => {
      // ── FIX: salva no ref E no localStorage imediatamente ──
      codigoSalaRef.current = codigo;
      localStorage.setItem('glory_dark_last_sala', codigo);
      setCodigoSala(codigo);
      setTela('lobby');
      setIsHost(true);
      setJogadores([nomeRef.current]);
    });

    socketRef.current.on('entrou_na_sala', (dados: { codigo: string; jogadores: string[] }) => {
      // ── FIX: salva no ref E no localStorage imediatamente ──
      codigoSalaRef.current = dados.codigo;
      localStorage.setItem('glory_dark_last_sala', dados.codigo);
      setCodigoSala(dados.codigo);
      setTela('lobby');
      setJogadores(dados.jogadores);
      setIsHost(false);
    });

    socketRef.current.on('atualizar_jogadores', (novaLista: string[]) => {
      setJogadores(novaLista);
    });

    socketRef.current.on('iniciar_costumizacao', (dados: { codigoSala?: string }) => {
      // ── FIX: usa o ref em vez do estado (sem closure stale) ──
      const codigoFinal = dados?.codigoSala || codigoSalaRef.current;
      if (!codigoFinal) {
        alert('Erro: código da sala não encontrado. Tente novamente.');
        return;
      }
      localStorage.setItem('glory_dark_last_sala', codigoFinal);
      router.push(`/costumizacao?sala=${codigoFinal}`);
    });

    socketRef.current.on('erro', (msg: string) => alert(msg));

    // ── FIX: removido 'nome' e 'codigoSala' das dependências ──
    // eles causavam recriação dos listeners e perda de eventos
    return () => { socketRef.current?.disconnect(); };
  }, [router]);

  const criarSala = () => {
    if (!nome) return alert('Diga seu nome, viajante!');
    setTela('lobby');
    setIsHost(true);
    setJogadores([nome]);
    setCodigoSala('GERANDO...');
    socketRef.current?.emit('criar_sala', { nome, limite: limiteJogadores });
  };

  const entrarSala = () => {
    if (!nome || !codigoSalaInput) return alert('Preencha os dados!');
    socketRef.current?.emit('entrar_sala', { nome, codigo: codigoSalaInput });
  };

  const iniciarPartida = () => {
    const codigo = codigoSalaRef.current;
    if (!codigo || codigo === 'GERANDO...') return alert('Aguarde o selo ser gerado...');
    socketRef.current?.emit('comecar_jogo', { codigo });
  };

  const retomarJornada = () => {
    if (heroiSalvo) router.push(`/game?sala=${heroiSalvo.sala}`);
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-serif">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: "url('https://img.freepik.com/fotos-premium/velocidade-da-luz-redemoinho-de-vortice-neon-linhas-torcidas-brilhantes-em-movimento-hiper-salto-para-outra-galaxia_35672-1767.jpg')" }}
      />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 to-black/90" />

      <div className="relative z-20 w-full max-w-xl px-4 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            GLORY <span className="text-red-500">DARK</span>
          </h1>
          <div className="flex justify-center gap-3 mt-4">
            {PREVIEW_CLASSES.map(c => (
              <div key={c.id} className="flex flex-col items-center gap-1 group cursor-default">
                <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{c.emoji}</span>
                <span
                  className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: COR_CLASSE[c.id] + (c.mitico ? 'ff' : '99') }}
                >
                  {c.mitico ? '★ ' : ''}{c.nome}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/90 border-2 border-red-900/50 rounded-xl shadow-[0_0_50px_rgba(127,29,29,0.3)] overflow-hidden">
          <div className="bg-red-950/40 border-b border-red-900/30 p-4 text-center">
            <h2 className="text-red-400 font-bold uppercase tracking-widest text-sm">
              {tela === 'inicial' ? 'Portal das Sombras' : 'Assembleia de Heróis'}
            </h2>
          </div>

          <div className="p-8 space-y-8">
            {tela === 'inicial' ? (
              <>
                {heroiSalvo && (
                  <button
                    onClick={retomarJornada}
                    className="w-full bg-gradient-to-r from-amber-900/40 to-amber-600/40 border border-amber-500/50 text-amber-200 py-3 rounded-lg text-xs font-black uppercase tracking-[0.2em] hover:from-amber-800/60 transition-all mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  >
                    ✨ Retomar Jornada com {heroiSalvo.nome}
                  </button>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-red-200/70 uppercase">Identidade</label>
                  <input
                    type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Itadori Yuji"
                    className="w-full bg-black/60 border border-red-900/30 p-4 rounded-lg text-white focus:border-red-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-red-200/70 uppercase">Membros</label>
                    <div className="flex items-center justify-between bg-black/60 border border-red-900/30 rounded-lg p-2 text-white">
                      <button onClick={() => setLimiteJogadores(Math.max(1, limiteJogadores - 1))} className="hover:text-red-500 transition-colors w-8">−</button>
                      <span className="font-bold">{limiteJogadores}</span>
                      <button onClick={() => setLimiteJogadores(Math.min(6, limiteJogadores + 1))} className="hover:text-red-500 transition-colors w-8">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-red-200/70 uppercase">Selo</label>
                    <input
                      type="text" value={codigoSalaInput} maxLength={6}
                      onChange={(e) => setCodigoSalaInput(e.target.value.toUpperCase())}
                      className="w-full bg-black/60 border border-red-900/30 p-2 text-center text-red-400 font-mono focus:border-red-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={criarSala} className="w-full bg-red-700 hover:bg-red-600 text-white font-black py-4 rounded-lg uppercase tracking-widest shadow-[0_4px_0_rgb(127,29,29)] active:translate-y-1 active:shadow-none transition-all">
                    Iniciar Ritual
                  </button>
                  <button onClick={entrarSala} className="w-full bg-zinc-800 hover:bg-zinc-700 text-red-200 py-3 rounded-lg text-xs uppercase transition-colors">
                    Atravessar Portal
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-6">
                <div>
                  <p className="text-red-400/70 text-xs uppercase mb-2">Selo Místico</p>
                  <div className="text-4xl font-mono font-black text-red-300 bg-black/60 py-4 border border-red-500/30 rounded-lg">
                    {codigoSala}
                  </div>
                  <p className="text-zinc-500 text-[10px] mt-2 uppercase tracking-widest">
                    Compartilhe este código com seus aliados
                  </p>
                </div>

                {/* Botão solo de emergência */}
                <button
                  onClick={() => {
                    const codigo = codigoSalaRef.current;
                    if (!codigo || codigo === 'GERANDO...') return alert('Aguarde o código ser gerado');
                    router.push(`/costumizacao?sala=${codigo}`);
                  }}
                  className="text-[10px] text-zinc-600 hover:text-red-500 transition-colors uppercase tracking-widest cursor-pointer"
                >
                  [ Forçar Entrada Solo ]
                </button>

                <div className="space-y-3 text-left">
                  <p className="text-[10px] font-bold text-red-500 uppercase border-b border-red-900/40 pb-1">
                    Viajantes ({jogadores.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {jogadores.map((jog, i) => (
                      <div key={i} className="bg-red-950/20 border border-red-900/30 p-2 rounded text-sm text-red-100 flex items-center gap-2">
                        <span className="text-red-500">{i === 0 ? '✦' : '✧'}</span> {jog}
                      </div>
                    ))}
                  </div>
                </div>

                {isHost && (
                  <button
                    onClick={iniciarPartida}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-lg uppercase tracking-[0.2em] shadow-[0_4px_0_rgb(153,27,27)] active:translate-y-1 active:shadow-none transition-all"
                  >
                    Despertar o Mundo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
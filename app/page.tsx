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

export default function RpgLobby() {
  const router = useRouter();

  const [tela, setTela]                   = useState<'inicial' | 'lobby'>('inicial');
  const [nome, setNome]                   = useState('');
  const [limiteJogadores, setLimiteJogadores] = useState(4);
  const [codigoSalaInput, setCodigoSalaInput] = useState('');
  const [codigoSala, setCodigoSala]       = useState('');
  const [jogadores, setJogadores]         = useState<string[]>([]);
  const [isHost, setIsHost]               = useState(false);
  const [conectado, setConectado]         = useState(false);
  const [entrando, setEntrando]           = useState(false); // ← novo: feedback de carregamento
  const [erroEntrada, setErroEntrada]     = useState('');   // ← novo: mensagem de erro

  const socketRef  = useRef<Socket | null>(null);
  const nomeRef    = useRef(nome);
  const codigoRef  = useRef(codigoSala);
  nomeRef.current  = nome;
  codigoRef.current = codigoSala;

  useEffect(() => {
    // Pega a URL do socket — mesmo origin no Railway
    const socketUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`)
      : 'http://localhost:3000';

    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 8000,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConectado(true);
      console.log('[Lobby] Conectado:', s.id);
    });

    s.on('connect_error', (err) => {
      console.warn('[Lobby] Erro de conexão:', err.message);
      setConectado(false);
    });

    s.on('disconnect', () => setConectado(false));

    s.on('sala_criada', (codigo: string) => {
      setCodigoSala(codigo);
      setTela('lobby');
      setIsHost(true);
      setJogadores([nomeRef.current]);
    });

    s.on('entrou_na_sala', (dados: { codigo: string; jogadores: string[] }) => {
      setEntrando(false);
      setErroEntrada('');
      setCodigoSala(dados.codigo);
      setTela('lobby');
      setJogadores(dados.jogadores);
      setIsHost(false);
    });

    s.on('atualizar_jogadores', (novaLista: string[]) => {
      setJogadores(novaLista);
    });

    s.on('iniciar_costumizacao', (dados: { codigoSala?: string }) => {
      const codigoFinal = dados?.codigoSala || codigoRef.current;
      router.push(`/costumizacao?sala=${codigoFinal}`);
    });

    s.on('erro', (msg: string) => {
      setEntrando(false);
      setErroEntrada(msg);
    });

    return () => { s.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criarSala = () => {
    if (!nome.trim()) return alert('Diga seu nome, viajante!');
    if (!conectado)   return alert('Aguarde a conexão com o servidor...');
    socketRef.current?.emit('criar_sala', { nome, limite: limiteJogadores });
  };

  const entrarSala = () => {
    if (!nome.trim())             return alert('Coloque seu nome primeiro!');
    if (!codigoSalaInput.trim())  return alert('Cole o código da sala!');
    if (!conectado)               return alert('Aguarde a conexão com o servidor...');

    setEntrando(true);
    setErroEntrada('');
    socketRef.current?.emit('entrar_sala', { nome, codigo: codigoSalaInput.trim() });

    // Timeout de segurança — se o servidor não responder em 5s, mostra erro
    setTimeout(() => {
      setEntrando(prev => {
        if (prev) setErroEntrada('Sala não encontrada ou código inválido.');
        return false;
      });
    }, 5000);
  };

  const iniciarPartida = () => {
    if (!codigoSala) return;
    socketRef.current?.emit('comecar_jogo', { codigo: codigoSala });
  };

  const PREVIEW_CLASSES = [
    { id: 'guerreiro', emoji: '👑', nome: 'SUKUNA' },
    { id: 'mago',      emoji: '🤞', nome: 'GOJO'   },
    { id: 'sombrio',   emoji: '💀', nome: 'JIN-WOO'},
    { id: 'shadow',    emoji: '☢️', nome: 'SHADOW', mitico: true },
    { id: 'aizen',     emoji: '🪞', nome: 'AIZEN',  mitico: true },
  ];

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-serif">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: "url('https://img.freepik.com/fotos-premium/velocidade-da-luz-redemoinho-de-vortice-neon-linhas-torcidas-brilhantes-em-movimento-hiper-salto-para-outra-galaxia_35672-1767.jpg')" }}
      />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 to-black/90" />

      {/* Indicador de conexão */}
      <div className="absolute top-3 right-4 z-30">
        <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-widest ${
          conectado ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400 animate-pulse'
        }`}>
          {conectado ? '🟢 Conectado' : '🔴 Conectando...'}
        </span>
      </div>

      <div className="relative z-20 w-full max-w-xl px-4 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            GLORY <span className="text-red-500">DARK</span>
          </h1>
          <div className="flex justify-center gap-3 mt-4">
            {PREVIEW_CLASSES.map(c => (
              <div key={c.id} className="flex flex-col items-center gap-1 group cursor-default">
                <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{c.emoji}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: COR_CLASSE[c.id] + (c.mitico ? 'ff' : '99') }}>
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

          <div className="p-8 space-y-6">
            {tela === 'inicial' ? (
              <>
                {/* Nome */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-red-200/70 uppercase">Seu Nome</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Itadori Yuji"
                    className="w-full bg-black/60 border border-red-900/30 p-4 rounded-lg text-white focus:border-red-500 outline-none transition-all"
                  />
                </div>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-red-900/30" />
                  <span className="text-zinc-600 text-xs uppercase tracking-widest">criar ou entrar</span>
                  <div className="flex-1 h-px bg-red-900/30" />
                </div>

                {/* CRIAR SALA */}
                <div className="bg-black/30 border border-red-900/20 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest">⚔ Criar nova sala</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-200/70">Limite de jogadores</span>
                    <div className="flex items-center gap-2 bg-black/60 border border-red-900/30 rounded-lg px-3 py-1">
                      <button onClick={() => setLimiteJogadores(Math.max(1, limiteJogadores - 1))} className="text-red-400 hover:text-red-300 w-6 text-lg">−</button>
                      <span className="font-bold text-white w-4 text-center">{limiteJogadores}</span>
                      <button onClick={() => setLimiteJogadores(Math.min(6, limiteJogadores + 1))} className="text-red-400 hover:text-red-300 w-6 text-lg">+</button>
                    </div>
                  </div>
                  <button
                    onClick={criarSala}
                    disabled={!conectado}
                    className="w-full bg-red-700 hover:bg-red-600 disabled:bg-red-900/40 disabled:cursor-not-allowed text-white font-black py-3 rounded-lg uppercase tracking-widest shadow-[0_4px_0_rgb(127,29,29)] active:translate-y-1 active:shadow-none transition-all"
                  >
                    Iniciar Ritual
                  </button>
                </div>

                {/* ENTRAR NA SALA */}
                <div className="bg-black/30 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">🚪 Entrar em sala existente</p>
                  <input
                    type="text"
                    value={codigoSalaInput}
                    maxLength={6}
                    onChange={(e) => {
                      setCodigoSalaInput(e.target.value.toUpperCase());
                      setErroEntrada('');
                    }}
                    placeholder="CÓDIGO DA SALA (ex: AB12CD)"
                    className="w-full bg-black/60 border border-zinc-700 p-3 rounded-lg text-center text-red-400 font-mono text-lg tracking-[0.3em] focus:border-red-500 outline-none transition-all placeholder:text-zinc-700 placeholder:text-sm placeholder:tracking-normal"
                  />
                  {erroEntrada && (
                    <p className="text-red-400 text-xs text-center animate-pulse">⚠ {erroEntrada}</p>
                  )}
                  <button
                    onClick={entrarSala}
                    disabled={!conectado || entrando}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:cursor-not-allowed text-red-200 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    {entrando ? '⏳ Entrando...' : 'Atravessar Portal'}
                  </button>
                </div>

                {/* Solo direto */}
                <button
                  onClick={() => router.push('/costumizacao?sala=SOLO1')}
                  className="w-full text-zinc-600 hover:text-red-400 py-2 text-[10px] uppercase tracking-widest transition-colors"
                >
                  [ Modo Solo — sem servidor ]
                </button>
              </>
            ) : (
              /* TELA DE LOBBY */
              <div className="text-center space-y-6">
                <div>
                  <p className="text-red-400/70 text-xs uppercase mb-2">Código da Sala — compartilhe com seus aliados</p>
                  <div
                    className="text-4xl font-mono font-black text-red-300 bg-black/60 py-4 border border-red-500/30 rounded-lg tracking-[0.3em] cursor-pointer hover:border-red-400/60 transition-all"
                    onClick={() => { navigator.clipboard?.writeText(codigoSala); }}
                    title="Clique para copiar"
                  >
                    {codigoSala}
                  </div>
                  <p className="text-zinc-500 text-[10px] mt-2">Clique no código para copiar</p>
                </div>

                <div className="space-y-2 text-left">
                  <p className="text-[10px] font-bold text-red-500 uppercase border-b border-red-900/40 pb-1">
                    Viajantes ({jogadores.length} / {limiteJogadores})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {jogadores.map((jog, i) => (
                      <div key={i} className="bg-red-950/20 border border-red-900/30 p-2 rounded text-sm text-red-100 flex items-center gap-2">
                        <span className="text-red-500">{i === 0 ? '✦ HOST' : '✧'}</span> {jog}
                      </div>
                    ))}
                  </div>
                  {jogadores.length < limiteJogadores && (
                    <p className="text-zinc-600 text-[10px] text-center pt-1 animate-pulse">
                      Aguardando jogadores... ({limiteJogadores - jogadores.length} vaga{limiteJogadores - jogadores.length > 1 ? 's' : ''} restante{limiteJogadores - jogadores.length > 1 ? 's' : ''})
                    </p>
                  )}
                </div>

                {isHost && (
                  <button
                    onClick={iniciarPartida}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-lg uppercase tracking-[0.2em] shadow-[0_4px_0_rgb(153,27,27)] active:translate-y-1 active:shadow-none transition-all"
                  >
                    Despertar o Mundo ({jogadores.length} jogador{jogadores.length > 1 ? 'es' : ''})
                  </button>
                )}

                {!isHost && (
                  <p className="text-zinc-500 text-xs animate-pulse">
                    ⏳ Aguardando o host iniciar a partida...
                  </p>
                )}

                <button
                  onClick={() => { setTela('inicial'); setCodigoSala(''); setJogadores([]); }}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest"
                >
                  ← Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
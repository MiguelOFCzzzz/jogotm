'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { getSocketUrl } from '@/app/lib/socket-url';

const COR_CLASSE: Record<string, string> = {
  guerreiro: '#ef4444',
  mago:      '#24dddd',
  sombrio:   '#6366f1',
  shadow:    '#b700ff',
  aizen:     '#ffffff',
};

export default function RpgLobby() {
  const router = useRouter();

  const [tela, setTela] = useState<'inicial' | 'lobby'>('inicial');
  const [nome, setNome] = useState('');
  const [limiteJogadores, setLimiteJogadores] = useState(4);
  const [codigoSalaInput, setCodigoSalaInput] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [jogadores, setJogadores] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [heroiSalvo, setHeroiSalvo] = useState<{ nome: string; sala: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  // Guarda o nome atual para usar nos listeners sem stale closure
  const nomeRef = useRef(nome);
  nomeRef.current = nome;

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('glory_dark_char_nome');
    const salaSalva = localStorage.getItem('glory_dark_last_sala');
    if (nomeSalvo && salaSalva) setHeroiSalvo({ nome: nomeSalvo, sala: salaSalva });

    const socketUrl = getSocketUrl();
    console.log('[Lobby] Conectando ao Socket.io em:', socketUrl);

    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConectado(true);
      console.log('[Lobby] Socket conectado:', s.id);
    });

    s.on('connect_error', (err) => {
      console.warn('[Lobby] Erro de conexão Socket.io:', err.message);
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
      setCodigoSala(dados.codigo);
      setTela('lobby');
      setJogadores(dados.jogadores);
      setIsHost(false);
    });

    s.on('atualizar_jogadores', (novaLista: string[]) => setJogadores(novaLista));

    s.on('iniciar_costumizacao', (dados: { codigoSala?: string }) => {
      const codigoFinal = dados?.codigoSala || codigoSala;
      router.push(`/costumizacao?sala=${codigoFinal || 'TESTE1'}`);
    });

    s.on('erro', (msg: string) => alert(msg));

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criarSala = () => {
    if (!nome.trim()) return alert('Diga seu nome, viajante!');
    setTela('lobby');
    setIsHost(true);
    setJogadores([nome]);
    setCodigoSala('GERANDO...');
    socketRef.current?.emit('criar_sala', { nome, limite: limiteJogadores });
  };

  const entrarSala = () => {
    if (!nome.trim() || !codigoSalaInput.trim()) return alert('Preencha os dados!');
    socketRef.current?.emit('entrar_sala', { nome, codigo: codigoSalaInput });
  };

  const iniciarPartida = () => {
    if (!codigoSala || codigoSala === 'GERANDO...') return alert('Aguarde o selo...');
    socketRef.current?.emit('comecar_jogo', { codigo: codigoSala });
  };

  const retomarJornada = () => {
    if (heroiSalvo) router.push(`/game?sala=${heroiSalvo.sala}`);
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
          conectado ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'
        }`}>
          {conectado ? '🟢 Conectado' : '🔴 Sem conexão'}
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
                    <label className="text-sm text-red-200/70 uppercase">Código da Sala</label>
                    <input
                      type="text" value={codigoSalaInput} maxLength={6}
                      onChange={(e) => setCodigoSalaInput(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
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
                  {/* Acesso solo direto sem Socket.io */}
                  <button
                    onClick={() => router.push('/costumizacao?sala=SOLO1')}
                    className="w-full text-zinc-600 hover:text-red-400 py-2 text-[10px] uppercase tracking-widest transition-colors"
                  >
                    [ Modo Solo — sem servidor ]
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-6">
                <div>
                  <p className="text-red-400/70 text-xs uppercase mb-2">Código da Sala</p>
                  <div className="text-4xl font-mono font-black text-red-300 bg-black/60 py-4 border border-red-500/30 rounded-lg tracking-[0.3em]">
                    {codigoSala}
                  </div>
                  <p className="text-zinc-500 text-[10px] mt-2">Compartilhe este código com seus aliados</p>
                </div>

                <button
                  onClick={() => {
                    const codigoFinal = (codigoSala === 'GERANDO...' || !codigoSala) ? 'TESTE1' : codigoSala;
                    router.push(`/costumizacao?sala=${codigoFinal}`);
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

                <button
                  onClick={() => setTela('inicial')}
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
'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

export default function RpgLobby() {
  const router = useRouter();

  const [tela, setTela] = useState<'inicial' | 'lobby'>('inicial');
  const [nome, setNome] = useState('');
  const [limiteJogadores, setLimiteJogadores] = useState(4);
  const [codigoSalaInput, setCodigoSalaInput] = useState('');
  
  const [codigoSala, setCodigoSala] = useState('');
  const [jogadores, setJogadores] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);

  // ESTADO PARA MEMÓRIA DO HERÓI
  const [heroiSalvo, setHeroiSalvo] = useState<{nome: string, sala: string} | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // --- LÓGICA DE MEMÓRIA (Sincronizada com o novo padrão) ---
    const nomeSalvo = localStorage.getItem('glory_dark_char_nome');
    const salaSalva = localStorage.getItem('glory_dark_last_sala');
    if (nomeSalvo && salaSalva) {
      setHeroiSalvo({ nome: nomeSalvo, sala: salaSalva });
    }

    socketRef.current = io('http://localhost:3001'); 

    socketRef.current.on('sala_criada', (codigo) => {
      setCodigoSala(codigo);
      setTela('lobby');
      setIsHost(true);
      setJogadores([nome]);
    });

    socketRef.current.on('entrou_na_sala', (dados) => {
      setCodigoSala(dados.codigo);
      setTela('lobby');
      setJogadores(dados.jogadores);
      setIsHost(false);
    });

    socketRef.current.on('atualizar_jogadores', (novaLista) => {
      setJogadores(novaLista);
    });

    // MUDANÇA PARA "COSTUMIZACAO"
    socketRef.current.on('iniciar_costumizacao', (dados) => {
      const codigoFinal = dados?.codigoSala || codigoSala;
      router.push(`/costumizacao?sala=${codigoFinal || "TESTE1"}`);
    });

    socketRef.current.on('erro', (msg) => {
      alert(msg);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [nome, router, codigoSala]);

  const criarSala = () => {
    if (!nome) return alert('Diga seu nome, viajante!');
    setTela('lobby'); 
    setIsHost(true);
    setJogadores([nome]);
    setCodigoSala("GERANDO..."); 
    socketRef.current?.emit('criar_sala', { nome, limite: limiteJogadores });
  };

  const entrarSala = () => {
    if (!nome || !codigoSalaInput) return alert('Preencha os dados!');
    socketRef.current?.emit('entrar_sala', { nome, codigo: codigoSalaInput });
  };

  const iniciarPartida = () => {
    if (!codigoSala || codigoSala === "GERANDO...") return alert("Aguarde o selo...");
    socketRef.current?.emit('comecar_jogo', { codigo: codigoSala });
  };

  // FUNÇÃO PARA RETOMAR
  const retomarJornada = () => {
    if (heroiSalvo) {
      router.push(`/game?sala=${heroiSalvo.sala}`);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black font-serif">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: "url('https://img.freepik.com/vetores-gratis/castelo-medieval-magico-a-noite-com-paisagem-de-montanha-de-fantasia-halloween-torre-de-construcao-de-conto-de-fadas-com-luz-de-aurora-verde-no-ceu-casa-de-castelo-encantada-polar-acima-de-misterio-borealis-ilustracao_107791-23889.jpg?semt=ais_hybrid&w=740&q=80')" }} 
      />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 to-black/90"></div>

      <div className="relative z-20 w-full max-w-xl px-4 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            GLORY <span className="text-purple-500">DARK</span>
          </h1>
        </div>

        <div className="bg-zinc-900/90 border-2 border-purple-900/50 rounded-xl shadow-[0_0_50px_rgba(88,28,135,0.3)] overflow-hidden">
          <div className="bg-purple-950/40 border-b border-purple-900/30 p-4 text-center">
            <h2 className="text-purple-400 font-bold uppercase tracking-widest text-sm">
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
                  <label className="text-sm font-semibold text-purple-200/70 uppercase">Identidade</label>
                  <input 
                    type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Malachai"
                    className="w-full bg-black/60 border border-purple-900/30 p-4 rounded-lg text-white focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-purple-200/70 uppercase">Membros</label>
                    <div className="flex items-center justify-between bg-black/60 border border-purple-900/30 rounded-lg p-2 text-white">
                      <button onClick={() => setLimiteJogadores(Math.max(1, limiteJogadores - 1))} className="hover:text-purple-500 transition-colors w-8">−</button>
                      <span className="font-bold">{limiteJogadores}</span>
                      <button onClick={() => setLimiteJogadores(Math.min(6, limiteJogadores + 1))} className="hover:text-purple-500 transition-colors w-8">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-purple-200/70 uppercase">Selo</label>
                    <input 
                      type="text" value={codigoSalaInput} maxLength={6}
                      onChange={(e) => setCodigoSalaInput(e.target.value.toUpperCase())}
                      className="w-full bg-black/60 border border-purple-900/30 p-2 text-center text-purple-400 font-mono focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={criarSala} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-black py-4 rounded-lg uppercase tracking-widest shadow-[0_4px_0_rgb(88,28,135)] active:translate-y-1 active:shadow-none transition-all">
                    Iniciar Ritual
                  </button>
                  <button onClick={entrarSala} className="w-full bg-zinc-800 hover:bg-zinc-700 text-purple-200 py-3 rounded-lg text-xs uppercase transition-colors">
                    Atravessar Portal
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-6">
                <div>
                  <p className="text-purple-400/70 text-xs uppercase mb-2">Selo Místico</p>
                  <div className="text-4xl font-mono font-black text-purple-300 bg-black/60 py-4 border border-purple-500/30 rounded-lg">
                    {codigoSala}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const codigoFinal = (codigoSala === "GERANDO..." || !codigoSala) ? "TESTE1" : codigoSala;
                    // MUDANÇA PARA "COSTUMIZACAO"
                    router.push(`/costumizacao?sala=${codigoFinal}`);
                  }} 
                  className="text-[10px] text-zinc-600 hover:text-purple-500 transition-colors uppercase tracking-widest cursor-pointer"
                >
                  [ Forçar Entrada Solo ]
                </button>

                <div className="space-y-3 text-left">
                  <p className="text-[10px] font-bold text-purple-500 uppercase border-b border-purple-900/40 pb-1">Viajantes ({jogadores.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {jogadores.map((jog, i) => (
                      <div key={i} className="bg-purple-950/20 border border-purple-900/30 p-2 rounded text-sm text-purple-100 flex items-center gap-2">
                        <span className="text-purple-500">{i === 0 ? '✦' : '✧'}</span> {jog}
                      </div>
                    ))}
                  </div>
                </div>

                {isHost && (
                  <button 
                    onClick={iniciarPartida}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-lg uppercase tracking-[0.2em] shadow-[0_4px_0_rgb(76,29,149)] active:translate-y-1 active:shadow-none transition-all"
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
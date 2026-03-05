'use client'; // Necessário no Next.js App Router para usar estados e hooks

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Deixe o socket preparado (ele só vai conectar de verdade quando configurarmos o backend)
let socket: Socket;

export default function RpgLobby() {
  const [tela, setTela] = useState<'inicial' | 'lobby'>('inicial');
  const [nome, setNome] = useState('');
  const [limiteJogadores, setLimiteJogadores] = useState(4);
  const [codigoSalaInput, setCodigoSalaInput] = useState('');
  
  // Estados do Lobby
  const [codigoSala, setCodigoSala] = useState('');
  const [jogadores, setJogadores] = useState<string[]>([]);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Inicializa a conexão com o backend
    socket = io('http://localhost:3001', { autoConnect: false }); 
    socket.connect();

    // Ouvintes de eventos do servidor
    socket.on('sala_criada', (codigo) => {
      setCodigoSala(codigo);
      setTela('lobby');
      setIsHost(true);
      setJogadores([nome]); // Adiciona você mesmo na lista
    });

    socket.on('entrou_na_sala', (dados) => {
      setCodigoSala(dados.codigo);
      setTela('lobby');
      setJogadores(dados.jogadores);
    });

    socket.on('atualizar_jogadores', (novaLista) => {
      setJogadores(novaLista);
    });

    return () => {
      socket.disconnect();
    };
  }, [nome]);

  const criarSala = () => {
    if (!nome) return alert('Digite seu nome primeiro!');
    socket.emit('criar_sala', { nome, limite: limiteJogadores });
  };

  const entrarSala = () => {
    if (!nome) return alert('Digite seu nome primeiro!');
    if (!codigoSalaInput) return alert('Digite o código da sala!');
    socket.emit('entrar_sala', { nome, codigo: codigoSalaInput });
  };

  return (
    // Fundo Épico (Céu, Castelo, Montanhas)
    <div className="min-h-screen bg-slate-900 text-amber-100 font-mono flex flex-col justify-center items-center bg-cover bg-center" style={{ backgroundImage: "url('/images/fundo-rpg.png')" }}>
      
      {/* Título com a Espada - Centralizado no Topo */}
      <img src="/images/logo-espada.png" alt="Glory Hold" className="h-40 mb-10 drop-shadow-2xl" />

      {/* Painel Central de Pedra (Estruturado como na Imagem) */}
      <div className="bg-slate-800 p-6 border-4 border-amber-900 rounded-lg shadow-3xl shadow-black/80 w-full max-w-lg text-center bg-cover" style={{ backgroundImage: "url('/images/painel-pedra.png')" }}>
        
        {tela === 'inicial' && (
          <div className="grid grid-cols-2 gap-6">
            
            {/* Título do Painel */}
            <h2 className="col-span-2 text-2xl font-bold text-amber-500 uppercase tracking-widest border-b-2 border-amber-800 pb-2 mb-4">Comando da Taverna</h2>

            {/* Lado Esquerdo: Nome do Aventureiro */}
            <div className="space-y-4">
              <label className="block text-sm text-amber-200 uppercase">Nome do Aventureiro:</label>
              <div className="relative">
                <img src="/images/slot-pergaminho.png" alt="Fundo Pergaminho" className="absolute inset-0 w-full h-full object-cover rounded" />
                <input 
                  type="text" 
                  placeholder="ex: Mago Negro" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="relative w-full p-3 bg-transparent text-amber-950 font-bold rounded text-center focus:outline-none focus:ring-0 placeholder:text-amber-800"
                />
              </div>
            </div>

            {/* Lado Direito: Seleção de Jogadores */}
            <div className="space-y-4">
              <label className="block text-sm text-amber-200 uppercase">Jogadores:</label>
              <div className="flex justify-center items-center space-x-2">
                <button onClick={() => setLimiteJogadores(prev => Math.max(2, prev - 1))} className="p-2 text-2xl text-amber-500 hover:text-amber-400">◀</button>
                <div className="w-16 h-12 bg-amber-950/50 border border-amber-800 rounded flex justify-center items-center">
                  <span className="text-3xl font-bold text-amber-300">{limiteJogadores}</span>
                </div>
                <button onClick={() => setLimiteJogadores(prev => Math.min(6, prev + 1))} className="p-2 text-2xl text-amber-500 hover:text-amber-400">▶</button>
              </div>
            </div>

            {/* Botão Principal: Criar Nova Aventura (Destaque) */}
            <div className="col-span-2 mt-4">
              <button onClick={criarSala} className="w-full p-4 bg-amber-700 hover:bg-amber-600 text-slate-950 font-bold rounded-md shadow-lg border-2 border-amber-900 transition-colors text-xl uppercase tracking-wider relative overflow-hidden">
                <span className="absolute -top-1 left-2 text-xl">👑</span>
                Criar Nova Aventura
              </button>
            </div>

            <hr className="col-span-2 border-amber-900 border-2 mt-4 mb-2" />

            {/* Seção: Entrar na Sala */}
            <div className="col-span-2 space-y-4">
              <label className="block text-sm text-amber-200 uppercase">Código da Sala:</label>
              <input 
                type="text" 
                placeholder="AAAA11" 
                value={codigoSalaInput}
                onChange={(e) => setCodigoSalaInput(e.target.value.toUpperCase())}
                className="w-full p-3 bg-amber-950/50 border border-amber-800 rounded text-center uppercase text-amber-100 placeholder:text-amber-600 focus:outline-none"
                maxLength={6}
              />
              <button onClick={entrarSala} className="w-full p-3 bg-slate-700 hover:bg-slate-600 text-amber-100 font-bold border border-amber-700 rounded transition-colors uppercase">
                Entrar na Aventura
              </button>
            </div>
          </div>
        )}

        {tela === 'lobby' && (
          // O Lobby pode manter uma estrutura similar, adaptada conforme a necessidade
          <div className="space-y-6">
            {/* ... (conteúdo do lobby mantido, adaptado para o novo estilo) ... */}
          </div>
        )}

      </div>
    </div>
  );
}
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
    imagem: '👑', 
    atributos: { str: 10, agi: 4, int: 2, vit: 9 } 
  },
  { 
    id: 'mago', nome: 'GOJO', 
    descricao: 'HOLLOW PURPLE...',
    imagem: '🤞', 
    atributos: { str: 2, agi: 5, int: 10, vit: 4 } 
  },
  { 
    id: 'sombrio', nome: 'Sung Jin-Woo', 
    descricao: 'ARISE SHADOW LEGION...',
    imagem: '💀', 
    atributos: { str: 5, agi: 10, int: 5, vit: 3 } 
  },
];

function ConteudoCostumizacao() {
  const [classeSel, setClasseSel] = useState<Classe>(CLASSES[0]);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sala_codigo = searchParams.get('sala');

  const aceitarDestino = async () => {
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
      const response = await fetch('/api/personagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome,
          classe: classeSel.id,
          str: classeSel.atributos.str,
          agi: classeSel.atributos.agi,
          int: classeSel.atributos.int,
          vit: classeSel.atributos.vit,
          sala_codigo: sala_codigo 
        }),
      });

      if (response.ok) {
        // Salvando com as chaves que o jogo e o lobby reconhecem
        localStorage.setItem('glory_dark_char_nome', nome);
        localStorage.setItem('glory_dark_char_classe', classeSel.id);
        localStorage.setItem('glory_dark_char_str', String(classeSel.atributos.str));
        localStorage.setItem('glory_dark_char_agi', String(classeSel.atributos.agi));
        localStorage.setItem('glory_dark_char_int', String(classeSel.atributos.int));
        localStorage.setItem('glory_dark_char_vit', String(classeSel.atributos.vit));
        localStorage.setItem('glory_dark_last_sala', sala_codigo);

        setTimeout(() => {
          router.push(`/game?sala=${sala_codigo}`);
        }, 100);
      } else {
        const data = await response.json();
        alert(`Erro: ${data.error || 'Falha ao salvar'}`);
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
      alert("Erro de conexão com a API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center bg-black font-serif p-4 md:p-10 overflow-hidden">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40 grayscale-[50%]"
        style={{ backgroundImage: "url('https://i.pinimg.com/736x/09/9d/89/099d897998e65891b09e81c3d82dd835.jpg')" }} 
      />

      <div className="relative z-20 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-red-500 text-xl font-black uppercase tracking-[0.2em] mb-6 text-center lg:text-left">Escolha sua linhagem</h2>
          {CLASSES.map((c) => (
            <button
              key={c.id}
              onClick={() => setClasseSel(c)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group ${
                classeSel.id === c.id 
                ? 'bg-red-900/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                : 'bg-zinc-900/80 border-red-900/20 hover:border-red-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{c.imagem}</span>
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wider">{c.nome}</h3>
                  <p className="text-red-300/50 text-xs line-clamp-1">{c.descricao}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-zinc-950/60 border-x border-red-900/30 rounded-3xl p-6 relative min-h-[400px]">
            <div className="absolute top-8 w-full px-8">
              <input 
                type="text" 
                placeholder="NOME DO PERSONAGEM..."
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                className="w-full bg-transparent border-b-2 border-red-900 focus:border-red-500 outline-none text-center text-xl font-bold text-white placeholder:text-red-900/50 transition-all"
              />
            </div>

            <div className="text-[120px] md:text-[180px] drop-shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse">
                {classeSel.imagem}
            </div>
            
            <div className="absolute bottom-10 text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{classeSel.nome}</h2>
                <div className="h-1 w-20 bg-red-600 mx-auto mt-2 rounded-full shadow-[0_0_10px_red]"></div>
            </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between space-y-8 bg-zinc-900/90 p-8 rounded-xl border-2 border-red-900/50 shadow-2xl">
          <div className="space-y-6">
            <h3 className="text-red-400 font-bold uppercase tracking-widest text-center border-b border-red-900/30 pb-4">Potencial Arcano</h3>
            
            {Object.entries(classeSel.atributos).map(([key, val]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs uppercase font-bold text-red-200/70 tracking-widest">
                  <span>{key === 'str' ? 'Força' : key === 'agi' ? 'Agilidade' : key === 'int' ? 'Inteligência' : 'Vitalidade'}</span>
                  <span className="text-red-400">{val} / 10</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-red-900/30">
                  <div 
                    className="h-full bg-gradient-to-r from-red-900 via-red-500 to-red-400 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-700" 
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-center text-red-300/40 italic">"Sua jornada na sala {sala_codigo || '...'} está prestes a começar."</p>
            <button 
              onClick={aceitarDestino}
              disabled={loading}
              className={`w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-lg shadow-[0_4px_0_rgb(153,27,27)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-[0.2em] text-lg border-t border-red-300/20 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'SELANDO...' : 'Aceitar Destino'}
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={() => window.history.back()}
        className="absolute bottom-4 left-4 text-[10px] text-red-900 hover:text-red-500 uppercase tracking-widest transition-colors"
      >
        ← Retornar à Taverna
      </button>
    </main>
  );
}

export default function CostumizacaoPersonagem() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen flex items-center justify-center text-red-500">Invocando Portal...</div>}>
      <ConteudoCostumizacao />
    </Suspense>
  );
}
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 1. DEFINIÇÃO DOS TIPOS (Resolvendo "Cannot find name 'Classe'")
type Classe = {
  id: string;
  nome: string;
  descricao: string;
  imagem: string;
  atributos: { str: number; agi: number; int: number; vit: number };
};

const CLASSES: Classe[] = [
  { 
    id: 'guerreiro', nome: 'Guerreiro Abissal', 
    descricao: 'Mestre das lâminas pesadas, forjado no sangue das batalhas.',
    imagem: '⚔️', 
    atributos: { str: 10, agi: 4, int: 2, vit: 9 } 
  },
  { 
    id: 'mago', nome: 'Mago Arcano', 
    descricao: 'Manipulador das energias violetas e segredos do vazio.',
    imagem: '🔮', 
    atributos: { str: 2, agi: 5, int: 10, vit: 4 } 
  },
  { 
    id: 'sombrio', nome: 'Assassino Sombrio', 
    descricao: 'Uma sombra que corta a garganta dos reis antes do amanhecer.',
    imagem: '🗡️', 
    atributos: { str: 5, agi: 10, int: 5, vit: 3 } 
  },
];

// Componente Interno para usar useSearchParams (exigência do Next.js 13+)
function ConteudoCustomizacao() {
  const [classeSel, setClasseSel] = useState<Classe>(CLASSES[0]);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Captura o código da sala da URL (?sala=TESTE1)
  const sala_codigo = searchParams.get('sala');

  const aceitarDestino = async () => {
    if (!nome.trim()) {
      alert("Escreva o nome do seu herói nas crônicas!");
      return;
    }

    if (!sala_codigo) {
      alert("Erro: Código da sala não encontrado na URL.");
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
          sala_codigo: sala_codigo // Agora enviando corretamente!
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Destino Selado!");
        // router.push('/game');
      } else {
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
        style={{ backgroundImage: "url('https://img.freepik.com/vetores-gratis/castelo-medieval-magico-a-noite-com-paisagem-de-montanha-de-fantasia-halloween-torre-de-construcao-de-conto-de-fadas-com-luz-de-aurora-verde-no-ceu-casa-de-castelo-encantada-polar-acima-de-misterio-borealis-ilustracao_107791-23889.jpg?semt=ais_hybrid&w=740&q=80')" }} 
      />

      <div className="relative z-20 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-purple-500 text-xl font-black uppercase tracking-[0.2em] mb-6 text-center lg:text-left">Escolha sua linhagem</h2>
          {CLASSES.map((c) => (
            <button
              key={c.id}
              onClick={() => setClasseSel(c)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group ${
                classeSel.id === c.id 
                ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                : 'bg-zinc-900/80 border-purple-900/20 hover:border-purple-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{c.imagem}</span>
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wider">{c.nome}</h3>
                  <p className="text-purple-300/50 text-xs line-clamp-1">{c.descricao}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-zinc-950/60 border-x border-purple-900/30 rounded-3xl p-6 relative min-h-[400px]">
            <div className="absolute top-8 w-full px-8">
              <input 
                type="text" 
                placeholder="NOME DO HERÓI..."
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                className="w-full bg-transparent border-b-2 border-purple-900 focus:border-purple-500 outline-none text-center text-xl font-bold text-white placeholder:text-purple-900/50 transition-all"
              />
            </div>

            <div className="text-[120px] md:text-[180px] drop-shadow-[0_0_40px_rgba(168,85,247,0.6)] animate-pulse">
                {classeSel.imagem}
            </div>
            
            <div className="absolute bottom-10 text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{classeSel.nome}</h2>
                <div className="h-1 w-20 bg-purple-600 mx-auto mt-2 rounded-full shadow-[0_0_10px_purple]"></div>
            </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between space-y-8 bg-zinc-900/90 p-8 rounded-xl border-2 border-purple-900/50 shadow-2xl">
          <div className="space-y-6">
            <h3 className="text-purple-400 font-bold uppercase tracking-widest text-center border-b border-purple-900/30 pb-4">Potencial Arcano</h3>
            
            {Object.entries(classeSel.atributos).map(([key, val]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs uppercase font-bold text-purple-200/70 tracking-widest">
                  <span>{key === 'str' ? 'Força' : key === 'agi' ? 'Agilidade' : key === 'int' ? 'Inteligência' : 'Vitalidade'}</span>
                  <span className="text-purple-400">{val} / 10</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-purple-900/30">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-900 via-purple-500 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-700" 
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-center text-purple-300/40 italic">"Sua jornada na sala {sala_codigo || '...'} está prestes a começar."</p>
            <button 
              onClick={aceitarDestino}
              disabled={loading}
              className={`w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-lg shadow-[0_4px_0_rgb(88,28,135)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-[0.2em] text-lg border-t border-purple-300/20 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'SELANDO...' : 'Aceitar Destino'}
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={() => window.history.back()}
        className="absolute bottom-4 left-4 text-[10px] text-purple-900 hover:text-purple-500 uppercase tracking-widest transition-colors"
      >
        ← Retornar à Taverna
      </button>
    </main>
  );
}

// Exportação padrão com Suspense (necessário para useSearchParams no Next.js)
export default function CustomizacaoPersonagem() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen flex items-center justify-center text-purple-500">Invocando Portal...</div>}>
      <ConteudoCustomizacao />
    </Suspense>
  );
}
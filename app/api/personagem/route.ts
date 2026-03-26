// app/api/personagem/route.ts
// Rota de API para salvar personagem — compatível com Railway (sem banco externo obrigatório)

import { NextRequest, NextResponse } from 'next/server';

// ── Armazenamento em memória (substitua por banco real se quiser persistência) ──
// No Railway, cada deploy reseta a memória. Para persistência real, use
// Postgres (Railway tem addon gratuito) ou um KV store.
const personagens: Map<string, unknown> = new Map();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, classe, str, agi, int: intStat, vit, sala_codigo } = body;

    // Validação básica
    if (!nome || !classe || !sala_codigo) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes: nome, classe, sala_codigo' },
        { status: 400 }
      );
    }

    const classesValidas = ['guerreiro', 'mago', 'sombrio', 'shadow', 'aizen'];
    if (!classesValidas.includes(classe)) {
      return NextResponse.json(
        { error: `Classe inválida: ${classe}` },
        { status: 400 }
      );
    }

    // Monta o personagem
    const personagem = {
      id: `${sala_codigo}_${nome}_${Date.now()}`,
      nome: String(nome).slice(0, 32),
      classe,
      str:  Number(str)  || 10,
      agi:  Number(agi)  || 10,
      int:  Number(intStat) || 10,
      vit:  Number(vit)  || 10,
      sala_codigo,
      criadoEm: new Date().toISOString(),
    };

    // Salva em memória (chave = sala + nome)
    const chave = `${sala_codigo}:${nome}`;
    personagens.set(chave, personagem);

    console.log(`[API] Personagem criado: ${nome} (${classe}) na sala ${sala_codigo}`);

    return NextResponse.json({ ok: true, personagem }, { status: 201 });
  } catch (err) {
    console.error('[API] Erro ao criar personagem:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sala = searchParams.get('sala');

  if (!sala) {
    return NextResponse.json({ personagens: [] });
  }

  const resultado: unknown[] = [];
  for (const [chave, p] of personagens.entries()) {
    if (chave.startsWith(`${sala}:`)) {
      resultado.push(p);
    }
  }

  return NextResponse.json({ personagens: resultado });
}
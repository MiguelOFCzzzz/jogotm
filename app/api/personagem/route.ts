import { db } from '../../lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Recebemos os nomes do Frontend (Customização)
    const { nome, classe, str, agi, int, vit, sala_codigo } = body;

    // 2. BUSCA O ID DA SALA
    // Precisamos do ID numérico para a chave estrangeira (FK)
    const [salas]: any = await db.execute(
      'SELECT id FROM salas WHERE codigo = ?', 
      [sala_codigo]
    );

    if (!salas || salas.length === 0) {
      return NextResponse.json(
        { error: "O selo desta sala (código) não foi encontrado nos registros do reino." }, 
        { status: 404 }
      );
    }

    const salaId = salas[0].id;

    // 3. INSERÇÃO NO BANCO (Mapeando os nomes corretamente)
    // Frontend (str) -> Banco (forca)
    // Frontend (agi) -> Banco (agilidade)
    // Frontend (int) -> Banco (inteligencia)
    // Frontend (vit) -> Banco (vitalidade)
    // Frontend (nome) -> Banco (nome_personagem)
    
    const sql = `INSERT INTO personagens 
      (nome_personagem, classe, forca, agilidade, inteligencia, vitalidade, sala_id, nivel, exp) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`;

    const values = [
      nome,        // nome_personagem
      classe,      // classe
      str,         // forca
      agi,         // agilidade
      int,         // inteligencia
      vit,         // vitalidade
      salaId       // sala_id
    ];

    const [result] = await db.execute(sql, values);

    console.log(`✅ Herói ${nome} criado com sucesso na sala ${sala_codigo}`);

    return NextResponse.json({ 
      success: true, 
      id: (result as any).insertId,
      message: "Herói gravado nas crônicas do MySQL com sucesso!" 
    });

  } catch (error: any) {
    // Esse log no terminal vai te salvar se o MySQL rejeitar algo
    console.error("❌ ERRO CRÍTICO NO MYSQL:", error.message); 
    
    return NextResponse.json(
      { error: `Falha na gravação: ${error.message}` }, 
      { status: 500 }
    );
  }
}
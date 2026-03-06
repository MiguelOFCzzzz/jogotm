import { db } from '../../lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Desestruturação dos dados vindos do formulário de customização
    const { nome, classe, str, agi, int, vit, sala_codigo } = body;

    // 1. BUSCA O ID DA SALA: Como o front-end só conhece o código 'ABC123', 
    // precisamos achar o ID (1, 2, 3...) correspondente no banco.
    const [salas]: any = await db.execute(
      'SELECT id FROM salas WHERE codigo = ?', 
      [sala_codigo]
    );

    // Validação: Se a sala não existir, não podemos órfãos no banco
    if (!salas || salas.length === 0) {
      return NextResponse.json(
        { error: "Portal (Sala) não encontrado no banco. Verifique o código." }, 
        { status: 404 }
      );
    }

    

    const salaId = salas[0].id;

    // 2. INSERÇÃO: Salvando o herói com todas as colunas que você definiu
    // Note que usamos 'nome_personagem' e 'sala_id' conforme sua tabela
    const sql = `INSERT INTO personagens 
      (nome_personagem, classe, forca, agilidade, inteligencia, vitalidade, sala_id, nivel, exp) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`;

    const values = [
      nome, 
      classe, 
      str, 
      agi, 
      int, 
      vit, 
      salaId
    ];

    const [result] = await db.execute(sql, values);

    return NextResponse.json({ 
      success: true, 
      id: (result as any).insertId,
      message: "Herói gravado nas crônicas do MySQL com sucesso!" 
    });

} catch (error: any) {
    // ISSO AQUI VAI TE DIZER O NOME DA COLUNA QUE ESTÁ ERRADA
    console.error("ERRO DETALHADO DO MYSQL:", error.message); 
    
    return NextResponse.json(
      { error: `Erro no Banco: ${error.message}` }, 
      { status: 500 }
    );
  }

}
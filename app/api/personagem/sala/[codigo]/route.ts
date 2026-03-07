import { db } from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request, 
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    // 1. Resolvemos a Promise do parâmetro dinâmico [codigo]
    const resolvedParams = await params;
    const codigo = resolvedParams.codigo;

    console.log(`--- Buscando Heróis para a Sala: ${codigo} ---`);

    // 2. Query com JOIN para garantir que pegamos os heróis da sala certa
    const [herois]: any = await db.execute(`
      SELECT 
        p.id, p.nome, p.classe, p.nivel, 
        p.str, p.agi, p.int, p.vit, p.sala_id 
      FROM personagens p
      JOIN salas s ON p.sala_id = s.id
      WHERE s.codigo = ?
    `, [codigo]);

    console.log(`Sucesso! Encontrados ${herois.length} heróis.`);

    // 3. Forçamos o retorno como JSON com cabeçalhos limpos
    return new NextResponse(JSON.stringify(herois), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("ERRO NO BANCO (API/HEROIS):", error.message);
    
    return new NextResponse(
      JSON.stringify({ error: "Falha na invocação", details: error.message }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
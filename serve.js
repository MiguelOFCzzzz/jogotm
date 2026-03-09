

const mysql = require('mysql2/promise');
const io = require('socket.io')(3001, {
  cors: { origin: "http://localhost:3000" }
});

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root', // Verifique se é 'root' mesmo no seu MySQL
  database: 'glory_dark_db'
};

// Pool de conexões para estabilidade
const pool = mysql.createPool(dbConfig);

// --- TESTE DE CONEXÃO COM O BANCO ---
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com o Banco de Dados estabelecida!');
    connection.release();
  } catch (err) {
    console.error('❌ ERRO NO BANCO:', err.message);
    console.log('Certifique-se que o MySQL está ligado e a senha está correta.');
  }
})();

console.log('🚀 Servidor de Glory Dark despertado na porta 3001');

const salasEmMemoria = {}; 

io.on('connection', (socket) => {
  console.log('✨ Viajante conectado ao abismo:', socket.id);

  // --- 1. CRIAR SALA ---
  socket.on('criar_sala', async ({ nome, limite }) => {
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      await pool.execute(
        'INSERT INTO salas (codigo, host_id, limite_jogadores, status) VALUES (?, ?, ?, "lobby")',
        [codigo, socket.id, limite]
      );
      
      socket.join(codigo);
      salasEmMemoria[codigo] = [nome];
      
      socket.emit('sala_criada', codigo);
      io.to(codigo).emit('atualizar_jogadores', salasEmMemoria[codigo]);
      
      console.log(`🏰 Ritual iniciado: Sala ${codigo} por ${nome}`);
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      socket.emit('erro', 'O portal falhou ao registrar a sala no banco.');
    }
  });

  // --- 2. ENTRAR NA SALA ---
  socket.on('entrar_sala', async ({ nome, codigo }) => {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM salas WHERE codigo = ? AND status = "lobby"', 
        [codigo]
      );
      
      if (rows.length > 0) {
        const limiteMax = rows[0].limite_jogadores;
        const listaAtual = salasEmMemoria[codigo] || [];

        if (listaAtual.length >= limiteMax) {
          return socket.emit('erro', 'Esta guilda já está cheia!');
        }

        socket.join(codigo);
        if (!salasEmMemoria[codigo]) salasEmMemoria[codigo] = [];
        salasEmMemoria[codigo].push(nome);

        io.to(codigo).emit('entrou_na_sala', { codigo, jogadores: salasEmMemoria[codigo] });
        io.to(codigo).emit('atualizar_jogadores', salasEmMemoria[codigo]);
        
        console.log(`👥 ${nome} atravessou o portal para a sala ${codigo}.`);
      } else {
        socket.emit('erro', 'Este selo é inválido ou a jornada já começou.');
      }
    } catch (err) {
      console.error("Erro ao entrar:", err);
      socket.emit('erro', 'Falha na conexão com os registros do reino.');
    }
  });

  // --- 3. INICIAR RITUAL (CUSTOMIZAÇÃO) ---
  socket.on('comecar_jogo', async ({ codigo }) => {
    try {
      await pool.execute(
        'UPDATE salas SET status = "customizacao" WHERE codigo = ?', 
        [codigo]
      );
      
      io.to(codigo).emit('iniciar_customizacao', { codigoSala: codigo }); 
      console.log(`⚔️ Sala ${codigo}: Os heróis estão escolhendo seus destinos.`);
    } catch (err) {
      console.error("Erro ao iniciar jogo:", err);
      socket.emit('erro', 'Não foi possível selar o destino da sala.');
    }
  });
  

  socket.on('disconnect', () => {
    console.log('👣 Um viajante se perdeu na escuridão.');
  });
});
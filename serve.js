const mysql = require('mysql2/promise');
const io = require('socket.io')(3001, {
  cors: { origin: "http://localhost:3000" }
});

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'glory_dark_db'
};

const pool = mysql.createPool(dbConfig);

// ─── ESTADO EM MEMÓRIA ────────────────────────────────────────────────────────
const salasEmMemoria = {};
const estadoJogadores = {};

// Estado de jogo por sala: monstros, onda, host autorizado a sincronizar
// Apenas o HOST de cada sala é "autoritativo" — ele envia o estado dos monstros
// Os outros jogadores recebem e renderizam.
const estadoJogo = {};
// { [sala]: { ondaAtual, hostId, monstros: [], raioBossArr: [] } }
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com o Banco de Dados estabelecida!');
    connection.release();
  } catch (err) {
    console.error('❌ ERRO NO BANCO:', err.message);
  }
})();

console.log('🚀 Servidor de Glory Dark despertado na porta 3001');

io.on('connection', (socket) => {
  console.log('✨ Viajante conectado:', socket.id);

  // ── 1. CRIAR SALA ──────────────────────────────────────────────────────────
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
      console.log(`🏰 Sala ${codigo} criada por ${nome}`);
    } catch (err) {
      socket.emit('erro', 'Falha ao registrar sala.');
    }
  });

  // ── 2. ENTRAR NA SALA ──────────────────────────────────────────────────────
  socket.on('entrar_sala', async ({ nome, codigo }) => {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM salas WHERE codigo = ? AND status = "lobby"',
        [codigo]
      );
      if (rows.length > 0) {
        const listaAtual = salasEmMemoria[codigo] || [];
        if (listaAtual.length >= rows[0].limite_jogadores)
          return socket.emit('erro', 'Guilda cheia!');

        socket.join(codigo);
        if (!salasEmMemoria[codigo]) salasEmMemoria[codigo] = [];
        salasEmMemoria[codigo].push(nome);

        io.to(codigo).emit('entrou_na_sala', { codigo, jogadores: salasEmMemoria[codigo] });
        io.to(codigo).emit('atualizar_jogadores', salasEmMemoria[codigo]);
      } else {
        socket.emit('erro', 'Selo inválido ou jogo em andamento.');
      }
    } catch (err) {
      socket.emit('erro', 'Erro ao acessar o reino.');
    }
  });

  // ── 3. INICIAR TRANSIÇÃO ───────────────────────────────────────────────────
  socket.on('comecar_jogo', async ({ codigo }) => {
    try {
      await pool.execute('UPDATE salas SET status = "jogando" WHERE codigo = ?', [codigo]);
      io.to(codigo).emit('iniciar_customizacao', { codigoSala: codigo });
    } catch (err) {
      socket.emit('erro', 'Erro ao iniciar ritual.');
    }
  });

  // ── 4. ENTRAR NO MAPA ──────────────────────────────────────────────────────
  socket.on('entrar_no_jogo', ({ codigo, nome, classe, x, y }) => {
    socket.join(codigo);

    estadoJogadores[socket.id] = {
      id: socket.id,
      nome,
      classe,
      x,
      y,
      hp: 200, // HP aumentado para coop
      hpMax: 200,
      sala: codigo,
      direcaoRad: 0
    };

    // Inicializa estado de jogo da sala se for o primeiro a entrar
    if (!estadoJogo[codigo]) {
      estadoJogo[codigo] = {
        ondaAtual: 1,
        hostId: socket.id, // primeiro a entrar é o host autoritativo
        estadoPartida: 'jogando'
      };
      console.log(`🎮 Host da sala ${codigo}: ${socket.id} (${nome})`);
    }

    const jogadoresNaSala = Object.values(estadoJogadores).filter(p => p.sala === codigo);
    socket.emit('lista_jogadores', jogadoresNaSala);
    socket.emit('voce_e_host', socket.id === estadoJogo[codigo].hostId);
    socket.to(codigo).emit('novo_jogador_conectado', estadoJogadores[socket.id]);

    console.log(`⚔️  ${nome} (${classe}) entrou na sala ${codigo}`);
  });

  // ── 5. SINCRONIZAR MOVIMENTO (60 FPS) ──────────────────────────────────────
  socket.on('mover', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    player.x = data.x;
    player.y = data.y;
    player.direcaoRad = data.direcaoRad;

    socket.to(player.sala).emit('jogador_moveu', {
      id: socket.id,
      x: data.x,
      y: data.y,
      direcaoRad: data.direcaoRad
    });
  });

  // ── 6. SINCRONIZAR ATAQUES ─────────────────────────────────────────────────
  socket.on('atacar', (dadosAtaque) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    socket.to(player.sala).emit('jogador_atacou', {
      id: socket.id,
      tipo: dadosAtaque.tipo,
      angulo: dadosAtaque.angulo,
      classe: player.classe,
      // Para projéteis do sombrio (área)
      x: dadosAtaque.x,
      y: dadosAtaque.y,
    });
  });

  // ── 7. HOST ENVIA ESTADO DOS MONSTROS (a cada ~100ms) ─────────────────────
  // Apenas o host envia — os clientes recebem e interpolam
  socket.on('sync_monstros', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    const sala = estadoJogo[player.sala];
    if (!sala || sala.hostId !== socket.id) return; // só host pode sincronizar

    // Repassa para todos os outros na sala
    socket.to(player.sala).emit('monstros_atualizados', {
      monstros: data.monstros,
      ondaAtual: data.ondaAtual,
      raioBossArr: data.raioBossArr || []
    });
  });

  // ── 8. NOTIFICAR DANO EM MONSTRO (qualquer cliente pode reportar) ──────────
  // O host aplica o dano e confirma via sync_monstros
  socket.on('dano_monstro', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    // Repassa para o host da sala aplicar
    const sala = estadoJogo[player.sala];
    if (!sala) return;
    io.to(sala.hostId).emit('aplicar_dano', {
      monstroId: data.monstroId,
      dano: data.dano,
      atacanteId: socket.id
    });
  });

  // ── 9. HOST NOTIFICA MUDANÇA DE ONDA ──────────────────────────────────────
  socket.on('nova_onda', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    const sala = estadoJogo[player.sala];
    if (!sala || sala.hostId !== socket.id) return;

    sala.ondaAtual = data.ondaAtual;
    socket.to(player.sala).emit('onda_mudou', { ondaAtual: data.ondaAtual });
    console.log(`🌊 Sala ${player.sala}: Onda ${data.ondaAtual}`);
  });

  // ── 10. SINCRONIZAR HP DO PLAYER (raio do boss etc.) ──────────────────────
  socket.on('sync_hp', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    player.hp = data.hp;
    socket.to(player.sala).emit('hp_jogador', {
      id: socket.id,
      hp: data.hp,
      hpMax: data.hpMax
    });
  });

  // ── 11. GAME OVER / VITÓRIA (host anuncia) ─────────────────────────────────
  socket.on('fim_de_jogo', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    const sala = estadoJogo[player.sala];
    if (!sala || sala.hostId !== socket.id) return;
    sala.estadoPartida = data.estado;
    io.to(player.sala).emit('jogo_encerrado', { estado: data.estado });
  });

  // ── 12. HABILIDADES ESPECIAIS (Z) ─────────────────────────────────────────
  socket.on('habilidade_z', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;
    socket.to(player.sala).emit('jogador_usou_z', {
      id: socket.id,
      classe: player.classe,
      ...data
    });
  });

  // ── 13. DESCONEXÃO ─────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const player = estadoJogadores[socket.id];
    if (player) {
      const salaCodigo = player.sala;

      // Se o host saiu, migra para outro jogador
      const sala = estadoJogo[salaCodigo];
      if (sala && sala.hostId === socket.id) {
        const proximoHost = Object.values(estadoJogadores).find(
          p => p.sala === salaCodigo && p.id !== socket.id
        );
        if (proximoHost) {
          sala.hostId = proximoHost.id;
          io.to(proximoHost.id).emit('voce_e_host', true);
          io.to(salaCodigo).emit('novo_host', proximoHost.id);
          console.log(`👑 Novo host na sala ${salaCodigo}: ${proximoHost.nome}`);
        } else {
          // Sala vazia — limpa
          delete estadoJogo[salaCodigo];
        }
      }

      delete estadoJogadores[socket.id];

      if (salasEmMemoria[salaCodigo]) {
        salasEmMemoria[salaCodigo] = salasEmMemoria[salaCodigo].filter(
          n => n !== player.nome
        );
      }

      io.to(salaCodigo).emit('jogador_saiu', socket.id);
      console.log(`👣 ${player.nome} saiu da sala ${salaCodigo}.`);
    }
  });
});
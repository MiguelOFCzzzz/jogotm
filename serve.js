const { createServer } = require('http');
const { Server } = require('socket.io');

const port = process.env.PORT || 8080;

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end('Glory Dark Server Online');
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ─── ESTADO EM MEMÓRIA ────────────────────────────────────────────────────────
const salasEmMemoria = {};
const salasMeta = {};
const estadoJogadores = {};
const estadoJogo = {};
// ─────────────────────────────────────────────────────────────────────────────

httpServer.listen(port, () => {
  console.log(`🚀 Servidor de Glory Dark despertado na porta ${port}`);
});

io.on('connection', (socket) => {
  console.log('✨ Viajante conectado:', socket.id);

  // ── 1. CRIAR SALA ──────────────────────────────────────────────────────────
  socket.on('criar_sala', ({ nome, limite }) => {
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    socket.join(codigo);
    salasEmMemoria[codigo] = [nome];
    salasMeta[codigo] = { limite, status: 'lobby' };

    socket.emit('sala_criada', codigo);
    io.to(codigo).emit('atualizar_jogadores', salasEmMemoria[codigo]);
    console.log(`🏰 Sala ${codigo} criada por ${nome}`);
  });

  // ── 2. ENTRAR NA SALA ──────────────────────────────────────────────────────
  socket.on('entrar_sala', ({ nome, codigo }) => {
    const meta = salasMeta[codigo];

    if (!meta || meta.status !== 'lobby')
      return socket.emit('erro', 'Selo inválido ou jogo em andamento.');

    const listaAtual = salasEmMemoria[codigo] || [];
    if (listaAtual.length >= meta.limite)
      return socket.emit('erro', 'Guilda cheia!');

    socket.join(codigo);
    salasEmMemoria[codigo].push(nome);

    io.to(codigo).emit('entrou_na_sala', { codigo, jogadores: salasEmMemoria[codigo] });
    io.to(codigo).emit('atualizar_jogadores', salasEmMemoria[codigo]);
  });

  // ── 3. INICIAR TRANSIÇÃO ───────────────────────────────────────────────────
  socket.on('comecar_jogo', ({ codigo }) => {
    if (salasMeta[codigo]) salasMeta[codigo].status = 'jogando';
    io.to(codigo).emit('iniciar_costumizacao', { codigoSala: codigo });
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
      hp: 200,
      hpMax: 200,
      sala: codigo,
      direcaoRad: 0
    };

    if (!estadoJogo[codigo]) {
      estadoJogo[codigo] = {
        ondaAtual: 1,
        hostId: socket.id,
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

  // ── 5. SINCRONIZAR MOVIMENTO ───────────────────────────────────────────────
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
      x: dadosAtaque.x,
      y: dadosAtaque.y,
    });
  });

  // ── 7. HOST ENVIA ESTADO DOS MONSTROS ─────────────────────────────────────
  socket.on('sync_monstros', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;

    const sala = estadoJogo[player.sala];
    if (!sala || sala.hostId !== socket.id) return;

    socket.to(player.sala).emit('monstros_atualizados', {
      monstros: data.monstros,
      ondaAtual: data.ondaAtual,
      raioBossArr: data.raioBossArr || []
    });
  });

  // ── 8. NOTIFICAR DANO EM MONSTRO ──────────────────────────────────────────
  socket.on('dano_monstro', (data) => {
    const player = estadoJogadores[socket.id];
    if (!player) return;

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

  // ── 10. SINCRONIZAR HP DO PLAYER ──────────────────────────────────────────
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

  // ── 11. GAME OVER / VITÓRIA ────────────────────────────────────────────────
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
    if (!player) return;

    const salaCodigo = player.sala;
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
        delete estadoJogo[salaCodigo];
        delete salasEmMemoria[salaCodigo];
        delete salasMeta[salaCodigo];
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
  });
});
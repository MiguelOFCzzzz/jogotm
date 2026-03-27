// server-combined.js
// Next.js + Socket.io na MESMA porta — Railway Opção A
// Correções: isHost no jogador, dano_monstro, HOSTNAME fixo, solo sem lobby

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const { Server }       = require('socket.io');

const dev      = process.env.NODE_ENV !== 'production';
const PORT     = parseInt(process.env.PORT || '3000', 10);
const HOSTNAME = '0.0.0.0'; // FIXO — não usar process.env.HOSTNAME no Railway

const app    = next({ dev, hostname: HOSTNAME, port: PORT });
const handle = app.getRequestHandler();

// ── Estado em memória ─────────────────────────────────────────────────────────
const salas     = new Map(); // codigo → { limite, jogadores[], hostId }
const jogadores = new Map(); // socket.id → { ...dados, isHost, salaId }

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Garante que a sala existe (cria automaticamente para modo solo/direto)
function garantirSala(codigo) {
  if (!salas.has(codigo)) {
    salas.set(codigo, { codigo, limite: 6, jogadores: [], hostId: null });
  }
  return salas.get(codigo);
}

function getHostSocket(io, salaId) {
  for (const [id, j] of jogadores.entries()) {
    if (j.salaId === salaId && j.isHost) {
      return io.sockets.sockets.get(id) || null;
    }
  }
  return null;
}

function promoverNovoHost(io, salaId, saidaId) {
  for (const [id, j] of jogadores.entries()) {
    if (j.salaId === salaId && id !== saidaId) {
      j.isHost = true;
      const sala = salas.get(salaId);
      if (sala) sala.hostId = id;
      const s = io.sockets.sockets.get(id);
      if (s) {
        s.data.isHost = true;
        s.emit('voce_e_host', true);
      }
      io.to(salaId).emit('novo_host', id);
      console.log(`[HOST] Novo host na sala ${salaId}: ${j.nome} (${id})`);
      return id;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        port: PORT,
        jogadores: jogadores.size,
        salas: salas.size,
      }));
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[+] Conectado: ${socket.id}`);

    // ── LOBBY ─────────────────────────────────────────────────────────────────

    socket.on('criar_sala', ({ nome, limite }) => {
      const codigo = gerarCodigo();
      salas.set(codigo, {
        codigo,
        limite: Number(limite) || 4,
        jogadores: [nome],
        hostId: socket.id,
      });
      socket.join(codigo);
      socket.data.sala   = codigo;
      socket.data.nome   = nome;
      socket.data.isHost = true;
      socket.emit('sala_criada', codigo);
      console.log(`[SALA] ${codigo} criada por ${nome}`);
    });

    socket.on('entrar_sala', ({ nome, codigo }) => {
      const sala = salas.get(codigo);
      if (!sala) return socket.emit('erro', 'Sala não encontrada!');
      if (sala.jogadores.length >= sala.limite) return socket.emit('erro', 'Sala cheia!');

      sala.jogadores.push(nome);
      socket.join(codigo);
      socket.data.sala   = codigo;
      socket.data.nome   = nome;
      socket.data.isHost = false;

      socket.emit('entrou_na_sala', { codigo, jogadores: sala.jogadores });
      io.to(codigo).emit('atualizar_jogadores', sala.jogadores);
    });

    socket.on('comecar_jogo', ({ codigo }) => {
      // Aceita qualquer socket que peça (funciona para solo direto também)
      io.to(codigo).emit('iniciar_costumizacao', { codigoSala: codigo });
    });

    // ── JOGO ──────────────────────────────────────────────────────────────────

    socket.on('entrar_no_jogo', ({ codigo, nome, classe, x, y }) => {
      socket.join(codigo);
      socket.data.sala   = codigo;
      socket.data.nome   = nome;
      socket.data.classe = classe;

      // Garante que a sala existe mesmo para modo solo (sem lobby)
      const sala = garantirSala(codigo);

      const outrosDaSala = [...jogadores.values()].filter(
        j => j.salaId === codigo && j.id !== socket.id
      );

      // Primeiro a entrar na sala de jogo vira host
      const isHost = outrosDaSala.length === 0;
      socket.data.isHost = isHost;

      if (isHost) sala.hostId = socket.id;

      // ── CORREÇÃO PRINCIPAL: isHost salvo dentro do objeto do jogador ──
      const jogador = {
        id:         socket.id,
        nome:       nome   || 'Herói',
        classe:     classe || 'guerreiro',
        x:          x      || 1500,
        y:          y      || 1000,
        hp:         200,
        hpMax:      200,
        direcaoRad: 0,
        salaId:     codigo,
        isHost,
      };
      jogadores.set(socket.id, jogador);

      socket.emit('lista_jogadores', outrosDaSala);
      socket.emit('voce_e_host', isHost);
      socket.to(codigo).emit('novo_jogador_conectado', jogador);

      console.log(`[JOGO] ${nome} (${classe}) sala=${codigo} host=${isHost}`);
    });

    // ── MOVIMENTO ─────────────────────────────────────────────────────────────

    socket.on('mover', ({ x, y, direcaoRad }) => {
      const j = jogadores.get(socket.id);
      if (!j) return;
      j.x = x; j.y = y; j.direcaoRad = direcaoRad;
      socket.to(j.salaId).emit('jogador_moveu', { id: socket.id, x, y, direcaoRad });
    });

    socket.on('sync_hp', ({ hp, hpMax }) => {
      const j = jogadores.get(socket.id);
      if (!j) return;
      j.hp = hp; j.hpMax = hpMax;
      socket.to(j.salaId).emit('hp_jogador', { id: socket.id, hp, hpMax });
    });

    socket.on('atacar', (dados) => {
      const j = jogadores.get(socket.id);
      if (!j) return;
      socket.to(j.salaId).emit('jogador_atacou', { id: socket.id, ...dados });
    });

    // ── MONSTROS (só o host envia) ────────────────────────────────────────────

    socket.on('sync_monstros', ({ monstros, ondaAtual, raioBossArr }) => {
      const j = jogadores.get(socket.id);
      if (!j || !j.isHost) return;
      socket.to(j.salaId).emit('monstros_atualizados', {
        monstros,
        ondaAtual,
        raioBossArr: raioBossArr || [],
      });
    });

    // ── DANO (não-host → host aplica) ─────────────────────────────────────────

    socket.on('dano_monstro', ({ monstroId, dano }) => {
      const j = jogadores.get(socket.id);
      if (!j) return;

      // ── CORREÇÃO: busca host pelo objeto jogador, não só socket.data ──
      const hostSocket = getHostSocket(io, j.salaId);
      if (hostSocket) {
        hostSocket.emit('aplicar_dano', { monstroId, dano, atacanteId: socket.id });
      } else {
        console.warn(`[DANO] Host não encontrado na sala ${j.salaId}`);
      }
    });

    // ── ONDAS ─────────────────────────────────────────────────────────────────

    socket.on('nova_onda', ({ ondaAtual }) => {
      const j = jogadores.get(socket.id);
      if (!j || !j.isHost) return;
      socket.to(j.salaId).emit('onda_mudou', { ondaAtual });
      console.log(`[ONDA] Sala ${j.salaId}: onda ${ondaAtual}`);
    });

    // ── DESCONEXÃO ────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      const j = jogadores.get(socket.id);
      if (!j) return;

      const { salaId, nome, isHost } = j;
      jogadores.delete(socket.id);
      socket.to(salaId).emit('jogador_saiu', socket.id);
      console.log(`[-] ${nome} saiu da sala ${salaId}`);

      if (isHost) {
        const novoId = promoverNovoHost(io, salaId, socket.id);
        if (!novoId) {
          salas.delete(salaId);
          console.log(`[SALA] ${salaId} removida (vazia)`);
        }
      }

      const sala = salas.get(salaId);
      if (sala) {
        sala.jogadores = sala.jogadores.filter(n => n !== nome);
        if (sala.jogadores.length === 0) salas.delete(salaId);
        else io.to(salaId).emit('atualizar_jogadores', sala.jogadores);
      }
    });
  });

  httpServer.listen(PORT, HOSTNAME, () => {
    console.log(`✅ Glory Dark rodando em http://${HOSTNAME}:${PORT}`);
    console.log(`   Ambiente: ${dev ? 'desenvolvimento' : 'produção'}`);
  });
});
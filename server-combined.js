// server-combined.js
// Servidor unificado: Next.js + Socket.io na MESMA porta
// Ideal para Railway com 1 único serviço
// 
// Use este arquivo se quiser rodar tudo junto:
// package.json → "start": "node server-combined.js"

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev, hostname: HOSTNAME, port: PORT });
const handle = app.getRequestHandler();

// ── Estado do servidor ────────────────────────────────────────────────────────
const salas = new Map();
const jogadoresConectados = new Map();

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Health check Railway
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    handle(req, res, parsedUrl);
  });

  // Socket.io na mesma porta, path diferente
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Conectado: ${socket.id}`);

    // ─── LOBBY ───────────────────────────────────────────────────────────────
    socket.on('criar_sala', ({ nome, limite }) => {
      const codigo = gerarCodigo();
      salas.set(codigo, { codigo, limite: Number(limite) || 4, jogadores: [nome], hostId: socket.id });
      socket.join(codigo);
      socket.data.sala = codigo;
      socket.data.nome = nome;
      socket.emit('sala_criada', codigo);
    });

    socket.on('entrar_sala', ({ nome, codigo }) => {
      const sala = salas.get(codigo);
      if (!sala) { socket.emit('erro', 'Sala não encontrada!'); return; }
      if (sala.jogadores.length >= sala.limite) { socket.emit('erro', 'Sala cheia!'); return; }
      sala.jogadores.push(nome);
      socket.join(codigo);
      socket.data.sala = codigo;
      socket.data.nome = nome;
      socket.emit('entrou_na_sala', { codigo, jogadores: sala.jogadores });
      io.to(codigo).emit('atualizar_jogadores', sala.jogadores);
    });

    socket.on('comecar_jogo', ({ codigo }) => {
      const sala = salas.get(codigo);
      if (!sala || sala.hostId !== socket.id) return;
      io.to(codigo).emit('iniciar_costumizacao', { codigoSala: codigo });
    });

    // ─── JOGO ─────────────────────────────────────────────────────────────────
    socket.on('entrar_no_jogo', ({ codigo, nome, classe, x, y }) => {
      socket.join(codigo);
      socket.data.sala = codigo;
      socket.data.nome = nome;
      socket.data.classe = classe;

      const jogador = { id: socket.id, nome: nome || 'Herói', classe: classe || 'guerreiro', x: x || 1500, y: y || 1000, hp: 200, hpMax: 200, direcaoRad: 0, salaId: codigo };
      jogadoresConectados.set(socket.id, jogador);

      const outrosDaSala = [...jogadoresConectados.values()].filter(j => j.id !== socket.id && j.salaId === codigo);
      socket.emit('lista_jogadores', outrosDaSala);
      socket.to(codigo).emit('novo_jogador_conectado', jogador);

      const isHost = outrosDaSala.length === 0;
      socket.data.isHost = isHost;
      socket.emit('voce_e_host', isHost);
    });

    socket.on('mover', ({ x, y, direcaoRad }) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j) return;
      j.x = x; j.y = y; j.direcaoRad = direcaoRad;
      socket.to(j.salaId).emit('jogador_moveu', { id: socket.id, x, y, direcaoRad });
    });

    socket.on('sync_hp', ({ hp, hpMax }) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j) return;
      j.hp = hp; j.hpMax = hpMax;
      socket.to(j.salaId).emit('hp_jogador', { id: socket.id, hp, hpMax });
    });

    socket.on('atacar', (dados) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j) return;
      socket.to(j.salaId).emit('jogador_atacou', { id: socket.id, ...dados });
    });

    socket.on('sync_monstros', ({ monstros, ondaAtual, raioBossArr }) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j || !socket.data.isHost) return;
      socket.to(j.salaId).emit('monstros_atualizados', { monstros, ondaAtual, raioBossArr });
    });

    socket.on('dano_monstro', ({ monstroId, dano }) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j) return;
      for (const [id, outro] of jogadoresConectados.entries()) {
        const s2 = io.sockets.sockets.get(id);
        if (outro.salaId === j.salaId && s2?.data.isHost) {
          s2.emit('aplicar_dano', { monstroId, dano });
          break;
        }
      }
    });

    socket.on('nova_onda', ({ ondaAtual }) => {
      const j = jogadoresConectados.get(socket.id);
      if (!j || !socket.data.isHost) return;
      socket.to(j.salaId).emit('onda_mudou', { ondaAtual });
    });

    // ─── DESCONEXÃO ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const j = jogadoresConectados.get(socket.id);
      if (j) {
        socket.to(j.salaId).emit('jogador_saiu', socket.id);
        if (socket.data.isHost) {
          for (const [id, outro] of jogadoresConectados.entries()) {
            if (outro.salaId === j.salaId && id !== socket.id) {
              const s2 = io.sockets.sockets.get(id);
              if (s2) { s2.data.isHost = true; s2.emit('voce_e_host', true); io.to(j.salaId).emit('novo_host', id); }
              break;
            }
          }
        }
        jogadoresConectados.delete(socket.id);
        const sala = salas.get(socket.data.sala);
        if (sala) {
          sala.jogadores = sala.jogadores.filter(n => n !== socket.data.nome);
          if (sala.jogadores.length === 0) salas.delete(socket.data.sala);
          else io.to(socket.data.sala).emit('atualizar_jogadores', sala.jogadores);
        }
      }
    });
  });

  httpServer.listen(PORT, HOSTNAME, () => {
    console.log(`✅ Glory Dark rodando em http://${HOSTNAME}:${PORT}`);
    console.log(`   Next.js + Socket.io na mesma porta`);
  });
});
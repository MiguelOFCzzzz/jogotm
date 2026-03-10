-- 1. Cria o Banco de Dados
CREATE DATABASE IF NOT EXISTS glory_dark_db;
USE glory_dark_db;

-- 2. Tabela de Usuários (para login futuro)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_usuario VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Personagens (Onde o "Aceitar Destino" vai salvar)
CREATE TABLE IF NOT EXISTS personagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    nome_personagem VARCHAR(50) NOT NULL,
    classe VARCHAR(30) NOT NULL,
    nivel INT DEFAULT 1,
    exp INT DEFAULT 0,
    forca INT NOT NULL,
    agilidade INT NOT NULL,
    inteligencia INT NOT NULL,
    vitalidade INT NOT NULL,
    vida_atual INT,
    mana_atual INT,
    socket_id VARCHAR(100), -- Para identificar a sessão atual do Socket.io
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 4. Tabela de Inventário (Já deixando pronta para o futuro)
CREATE TABLE IF NOT EXISTS inventarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personagem_id INT,
    item_nome VARCHAR(100),
    quantidade INT DEFAULT 1,
    tipo VARCHAR(50), -- 'arma', 'pocao', 'armadura'
    CONSTRAINT fk_personagem FOREIGN KEY (personagem_id) REFERENCES personagens(id) ON DELETE CASCADE
);

USE glory_dark_db;

CREATE TABLE IF NOT EXISTS salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(6) UNIQUE NOT NULL,
    host_id VARCHAR(100),
    limite INT DEFAULT 4,
    status ENUM('lobby', 'jogando') DEFAULT 'lobby',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

USE glory_dark_db;

-- Armazena as salas ativas
CREATE TABLE IF NOT EXISTS salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(6) UNIQUE NOT NULL,
    host_id VARCHAR(100), -- ID do Socket do criador
    status ENUM('lobby', 'customizacao', 'em_jogo') DEFAULT 'lobby',
    limite_jogadores INT DEFAULT 4
);

-- Armazena quem está em qual sala (mesmo antes de criar o personagem)
CREATE TABLE IF NOT EXISTS jogadores_sessao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    socket_id VARCHAR(100),
    nome_usuario VARCHAR(50),
    codigo_sala VARCHAR(6),
    FOREIGN KEY (codigo_sala) REFERENCES salas(codigo) ON DELETE CASCADE
    

);


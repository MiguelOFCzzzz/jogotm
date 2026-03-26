// app/lib/socket-url.ts
// Retorna a URL correta do servidor Socket.io dependendo do ambiente

export function getSocketUrl(): string {
  // 1. Variável de ambiente definida explicitamente (mais seguro)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // 2. No browser, tenta inferir a partir da URL atual
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Desenvolvimento local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }

    // Railway / produção: usa mesma origem com porta do socket
    // Se o socket está no mesmo serviço (porta diferente), ajuste aqui
    // Se está em serviço separado no Railway, defina NEXT_PUBLIC_SOCKET_URL
    const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT || '3001';
    return `${protocol}//${hostname}:${socketPort}`;
  }

  // Fallback SSR
  return 'http://localhost:3001';
}
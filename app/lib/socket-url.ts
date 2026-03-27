// app/lib/socket-url.ts
// Retorna a URL correta do servidor Socket.io dependendo do ambiente

export function getSocketUrl(): string {
  // 1. Variável de ambiente definida explicitamente (Railway → Settings → Variables)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Desenvolvimento local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    // Railway / produção com server-combined:
    // Socket.io está na MESMA origem — sem porta extra
    return `${protocol}//${hostname}`;
  }

  return 'http://localhost:3000';
}
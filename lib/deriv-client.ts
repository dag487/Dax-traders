/**
 * Minimal Deriv WebSocket helper for server-side Next.js API routes.
 * - Opens a short-lived WebSocket connection to Deriv, sends a single request,
 *   waits for the first response, then closes.
 * - Intentionally small and robust: timeouts, JSON parsing guards, and no
 *   credential persistence. Use environment variables (DERIV_API_TOKEN) or
 *   provide a token in the request body when necessary.
 */

import WebSocket from 'ws';

type Options = {
  appId?: string;
  token?: string;
  timeoutMs?: number;
};

export async function requestDeriv(payload: any, options: Options = {}) {
  const { appId, timeoutMs = 10000 } = options;
  const baseUrl = 'wss://ws.binaryws.com/websockets/v3';
  const url = appId ? `${baseUrl}?app_id=${encodeURIComponent(appId)}` : baseUrl;

  return new Promise<any>((resolve, reject) => {
    const ws = new WebSocket(url, {
      handshakeTimeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {}
      reject(new Error('Deriv request timed out'));
    }, timeoutMs);

    ws.on('open', () => {
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    });

    ws.on('message', (data) => {
      clearTimeout(timer);
      try {
        const text = typeof data === 'string' ? data : data.toString();
        const parsed = JSON.parse(text);
        ws.close();
        resolve(parsed);
      } catch (err) {
        ws.close();
        reject(new Error('Failed to parse Deriv response'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    ws.on('close', () => {
      // no-op — if we already resolved, fine; otherwise let the timeout handle it
    });
  });
}

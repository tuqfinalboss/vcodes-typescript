
import fetch, { RequestInit, Response } from 'node-fetch';

export async function httpGet(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 10000; // default 10s
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpPost(url: string, body: any, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
}

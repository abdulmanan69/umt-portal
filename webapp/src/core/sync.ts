import type { Snapshot } from './types';

/**
 * Three ways in, none of which need a server:
 *  - the browser extension pushes a snapshot into this page
 *  - a sync link carries one in the URL fragment, which is never sent to a host
 *  - a file the student exported earlier
 */

const FRAGMENT_KEY = 's';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deflate(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const encoded = new TextEncoder().encode(text);
  const input = new Uint8Array(new ArrayBuffer(encoded.length));
  input.set(encoded);
  if (typeof CompressionStream === 'undefined') return input;
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return new TextDecoder().decode(bytes);
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/** A snapshot trimmed to what a phone needs, so the link stays scannable. */
export function forSyncLink(snapshot: Snapshot, includeRecords: boolean): Snapshot {
  return {
    version: 1,
    student: snapshot.student,
    schedule: snapshot.schedule,
    transcript: includeRecords ? snapshot.transcript : null,
    payments: includeRecords ? snapshot.payments : null,
    readAt: snapshot.readAt,
    exportedAt: snapshot.exportedAt || Date.now()
  };
}

export async function buildSyncLink(snapshot: Snapshot, baseUrl = location.href): Promise<string> {
  const packed = toBase64Url(await deflate(JSON.stringify(snapshot)));
  const url = new URL(baseUrl);
  url.hash = `${FRAGMENT_KEY}=${packed}`;
  return url.toString();
}

export async function readSyncLink(hash = location.hash): Promise<Snapshot | null> {
  const match = new RegExp(`${FRAGMENT_KEY}=([A-Za-z0-9\-_]+)`).exec(hash);
  if (!match) return null;
  try {
    const json = await inflate(fromBase64Url(match[1]));
    const parsed = JSON.parse(json) as Snapshot;
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/** The extension announces itself, then posts a snapshot on request. */
export function listenForExtension(onSnapshot: (snapshot: Snapshot) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { source?: string; type?: string; snapshot?: Snapshot };
    if (data?.source !== 'umt-portal-extension') return;
    if (data.type === 'snapshot' && data.snapshot?.version === 1) onSnapshot(data.snapshot);
  };
  window.addEventListener('message', handler);
  window.postMessage({ source: 'umt-companion', type: 'request-snapshot' }, location.origin);
  return () => window.removeEventListener('message', handler);
}

export function extensionPresent(timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', handler);
      resolve(value);
    };
    const handler = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string };
      if (event.source === window && data?.source === 'umt-portal-extension' && data.type === 'hello') finish(true);
    };
    window.addEventListener('message', handler);
    window.postMessage({ source: 'umt-companion', type: 'ping' }, location.origin);
    setTimeout(() => finish(false), timeoutMs);
  });
}

export function downloadSnapshot(snapshot: Snapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `umt-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readSnapshotFile(file: File): Promise<Snapshot | null> {
  try {
    const parsed = JSON.parse(await file.text()) as Snapshot;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

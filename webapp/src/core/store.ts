import { DEFAULT_SETTINGS, type Settings, type Snapshot } from './types';

const KEY_SNAPSHOT = 'umt.snapshot';
const KEY_SETTINGS = 'umt.settings';
const KEY_PASSCODE = 'umt.passcode';
const KEY_UNLOCKED = 'umt.unlocked';

type Listener = () => void;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, or the quota is gone: the app still works for this session */
  }
}

class Store {
  private listeners = new Set<Listener>();

  get snapshot(): Snapshot | null {
    return readJson<Snapshot | null>(KEY_SNAPSHOT, null);
  }

  get settings(): Settings {
    return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(KEY_SETTINGS, {}) };
  }

  get hasData(): boolean {
    const snap = this.snapshot;
    return Boolean(snap && (snap.schedule || snap.transcript || snap.payments));
  }

  /** A passcode is optional; it locks this device, it does not encrypt anything. */
  get hasPasscode(): boolean {
    return Boolean(localStorage.getItem(KEY_PASSCODE));
  }

  get isUnlocked(): boolean {
    if (!this.hasPasscode) return true;
    try {
      return sessionStorage.getItem(KEY_UNLOCKED) === '1';
    } catch {
      return false;
    }
  }

  saveSnapshot(snapshot: Snapshot): void {
    writeJson(KEY_SNAPSHOT, snapshot);
    this.emit();
  }

  mergeSnapshot(incoming: Snapshot): Snapshot {
    const current = this.snapshot;
    const merged: Snapshot = {
      version: 1,
      student: incoming.student ?? current?.student ?? null,
      schedule: incoming.schedule ?? current?.schedule ?? null,
      transcript: incoming.transcript ?? current?.transcript ?? null,
      payments: incoming.payments ?? current?.payments ?? null,
      readAt: { ...current?.readAt, ...incoming.readAt },
      exportedAt: incoming.exportedAt || Date.now()
    };
    this.saveSnapshot(merged);
    return merged;
  }

  saveSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.settings, ...patch };
    writeJson(KEY_SETTINGS, next);
    this.emit();
    return next;
  }

  async setPasscode(code: string | null): Promise<void> {
    if (!code) {
      localStorage.removeItem(KEY_PASSCODE);
    } else {
      localStorage.setItem(KEY_PASSCODE, await hash(code));
    }
    this.emit();
  }

  async unlock(code: string): Promise<boolean> {
    const stored = localStorage.getItem(KEY_PASSCODE);
    if (!stored) return true;
    const ok = stored === (await hash(code));
    if (ok) {
      try {
        sessionStorage.setItem(KEY_UNLOCKED, '1');
      } catch {
        /* nothing to remember, the session just stays unlocked in memory */
      }
    }
    return ok;
  }

  lock(): void {
    try {
      sessionStorage.removeItem(KEY_UNLOCKED);
    } catch {
      /* already gone */
    }
    this.emit();
  }

  clearEverything(): void {
    [KEY_SNAPSHOT, KEY_SETTINGS, KEY_PASSCODE].forEach((k) => localStorage.removeItem(k));
    try {
      sessionStorage.removeItem(KEY_UNLOCKED);
    } catch {
      /* fine */
    }
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`umt:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const store = new Store();

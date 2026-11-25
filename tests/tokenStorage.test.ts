import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredToken,
  loadStoredToken,
  saveStoredToken,
  tokenStorageKey,
} from '../src/lib/drive/tokenStorage';

class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tokenStorage', () => {
  it('guarda y recupera un token vigente', () => {
    const value = {
      clientId: 'cliente.apps.googleusercontent.com',
      token: 'ya29.token',
      expiresAt: Date.now() + 30 * 60_000,
    };
    saveStoredToken(value);
    expect(loadStoredToken()).toEqual(value);
  });

  it('descarta y borra tokens caducados o a punto de caducar', () => {
    saveStoredToken({
      clientId: 'cliente',
      token: 'viejo',
      expiresAt: Date.now() + 30_000,
    });
    expect(loadStoredToken()).toBeNull();
    expect(storage.getItem(tokenStorageKey)).toBeNull();
  });

  it('descarta datos con forma inválida', () => {
    storage.setItem(tokenStorageKey, '{"token": 123}');
    expect(loadStoredToken()).toBeNull();
    expect(storage.getItem(tokenStorageKey)).toBeNull();
  });

  it('devuelve null si el JSON está roto', () => {
    storage.setItem(tokenStorageKey, '{roto');
    expect(loadStoredToken()).toBeNull();
  });

  it('elimina el token al limpiar la sesión', () => {
    saveStoredToken({
      clientId: 'cliente',
      token: 'token',
      expiresAt: Date.now() + 60 * 60_000,
    });
    clearStoredToken();
    expect(loadStoredToken()).toBeNull();
  });
});

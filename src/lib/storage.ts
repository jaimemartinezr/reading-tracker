import type { AppData, PersistedState, Settings } from '../types';
import { SCHEMA_VERSION } from '../types';
import { sanitizeData } from './validate';

const STORAGE_KEY = 'paginas:state:v1';

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    books: [],
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

export function defaultSettings(): Settings {
  const envClientId =
    (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
  return { clientId: envClientId, connected: false };
}

function sanitizeSettings(raw: unknown, fallback: Settings): Settings {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const value = raw as Record<string, unknown>;
  return {
    clientId: typeof value.clientId === 'string' ? value.clientId.trim() : fallback.clientId,
    connected: value.connected === true,
    folderId: typeof value.folderId === 'string' ? value.folderId : undefined,
    fileId: typeof value.fileId === 'string' ? value.fileId : undefined,
    lastSyncedAt:
      typeof value.lastSyncedAt === 'string' && !Number.isNaN(Date.parse(value.lastSyncedAt))
        ? value.lastSyncedAt
        : undefined,
  };
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaults = defaultSettings();
    return {
      schemaVersion: SCHEMA_VERSION,
      data: sanitizeData(parsed.data),
      settings: sanitizeSettings(parsed.settings, defaults),
      dirty: parsed.dirty === true,
    };
  } catch (error) {
    console.warn('No se pudieron leer los datos guardados:', error);
    return null;
  }
}

export function savePersisted(state: PersistedState): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('No se pudieron guardar los datos en el dispositivo:', error);
    return false;
  }
}

export const storageKey = STORAGE_KEY;

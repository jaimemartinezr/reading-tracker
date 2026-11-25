const STORAGE_KEY = 'paginas:google-token';

export interface StoredToken {
  clientId: string;
  token: string;
  /** Marca de tiempo (ms) en la que caduca el token. */
  expiresAt: number;
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Lee el token guardado. Descarta tokens caducados o con forma inválida
 * para no usar credenciales viejas tras volver a abrir la app.
 */
export function loadStoredToken(): StoredToken | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (
      typeof parsed.clientId !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    // Margen de un minuto para no usar un token que está a punto de caducar.
    if (parsed.expiresAt <= Date.now() + 60_000) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      clientId: parsed.clientId,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function saveStoredToken(value: StoredToken): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Modo privado o cuota llena: seguimos usando el token solo en memoria.
  }
}

export function clearStoredToken(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Sin acceso al almacenamiento: no hay nada que limpiar.
  }
}

export const tokenStorageKey = STORAGE_KEY;

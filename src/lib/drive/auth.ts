import { DriveAuthError } from './errors';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const GIS_URL = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; login_hint?: string }) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
}

interface OAuth2Api {
  initTokenClient: (config: TokenClientConfig) => TokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: OAuth2Api } };
  }
}

let scriptPromise: Promise<void> | null = null;
let cachedToken: { clientId: string; token: string; expiresAt: number } | null = null;
let pendingRequest: Promise<string> | null = null;

export function clearTokenCache(): void {
  cachedToken = null;
}

export function isGisAvailable(): boolean {
  return Boolean(window.google?.accounts?.oauth2);
}

export function loadGoogleIdentity(): Promise<void> {
  if (isGisAvailable()) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_URL}"]`);
    const script = existing ?? document.createElement('script');

    const onLoad = () => {
      if (isGisAvailable()) resolve();
      else reject(new DriveAuthError('Google Identity no se inicializó correctamente.'));
    };
    const onError = () => {
      scriptPromise = null;
      reject(
        new DriveAuthError('No se pudo cargar Google. Comprueba tu conexión e inténtalo de nuevo.'),
      );
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = GIS_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptPromise;
}

function friendlyAuthError(raw: string | undefined): DriveAuthError {
  const text = (raw ?? '').toLowerCase();
  if (text.includes('popup')) {
    return new DriveAuthError(
      'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.',
    );
  }
  if (text.includes('access_denied')) {
    return new DriveAuthError('Has cancelado el acceso a Google Drive.');
  }
  if (text.includes('invalid_client') || text.includes('client')) {
    return new DriveAuthError(
      'El Client ID de Google no es válido. Revisa la configuración en Ajustes.',
    );
  }
  return new DriveAuthError(raw || 'No se pudo autorizar el acceso a Google Drive.');
}

function requestAccessToken(clientId: string, interactive: boolean): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new DriveAuthError('Google Identity no está disponible.'));
      return;
    }

    let settled = false;
    let timer: number | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      fn();
    };

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          if (interactive) finish(() => reject(friendlyAuthError(response.error_description ?? response.error)));
          else finish(() => reject(new DriveAuthError('Necesitas volver a conectar Google Drive.')));
          return;
        }
        const expiresIn = Number(response.expires_in ?? 3600);
        cachedToken = {
          clientId,
          token: response.access_token,
          expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000,
        };
        finish(() => resolve(response.access_token as string));
      },
      error_callback: (error) => {
        finish(() => reject(friendlyAuthError(error.message ?? error.type)));
      },
    });

    // Si el intento silencioso no responde, no dejamos la app colgada.
    timer = window.setTimeout(
      () => finish(() => reject(new DriveAuthError('Google no respondió. Inténtalo de nuevo.'))),
      interactive ? 180_000 : 12_000,
    );

    try {
      client.requestAccessToken({ prompt: '' });
    } catch (error) {
      finish(() => reject(friendlyAuthError(error instanceof Error ? error.message : undefined)));
    }
  });
}

/**
 * Obtiene un token de acceso a Drive. Si ya hay uno en memoria y sigue vigente, lo reutiliza.
 * En modo no interactivo intenta renovarlo en silencio (sin ventanas).
 */
export async function getAccessToken(clientId: string, interactive = false): Promise<string> {
  const trimmed = clientId.trim();
  if (!trimmed) throw new DriveAuthError('Falta el Client ID de Google.');

  if (cachedToken && cachedToken.clientId === trimmed && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  if (pendingRequest) return pendingRequest;

  await loadGoogleIdentity();

  pendingRequest = requestAccessToken(trimmed, interactive).finally(() => {
    pendingRequest = null;
  });
  return pendingRequest;
}

export function revokeAccessToken(): void {
  const token = cachedToken?.token;
  clearTokenCache();
  const oauth2 = window.google?.accounts?.oauth2;
  if (token && oauth2) oauth2.revoke(token);
}

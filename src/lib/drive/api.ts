import type { AppData } from '../../types';
import { SCHEMA_VERSION } from '../../types';
import {
  DriveAuthError,
  DriveConflictError,
  DriveError,
  DriveNotFoundError,
  GoogleApiError,
} from './errors';

const API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_NAME = 'Proyecto Lectura';
export const FILE_NAME = 'lecturas.json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFileMeta {
  id: string;
  name?: string;
  modifiedTime?: string;
  etag?: string;
  trashed?: boolean;
  parents?: string[];
}

export interface SyncFileIds {
  fileId: string;
  folderId: string;
}

interface GoogleErrorBody {
  error?: { message?: string; status?: string };
}

async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new DriveError('offline', 'No hay conexión con Google Drive. Se reintentará más tarde.');
  }

  if (response.ok) return response;

  let detail = '';
  try {
    const body = (await response.json()) as GoogleErrorBody;
    detail = body.error?.message ?? '';
  } catch {
    // La respuesta de error no era JSON; usamos el código HTTP.
  }

  if (response.status === 401) {
    throw new DriveAuthError('La sesión de Google ha caducado. Vuelve a conectar Drive.');
  }
  if (response.status === 403) {
    if (/quota|storage/i.test(detail)) {
      throw new GoogleApiError('Tu cuenta de Google Drive no tiene espacio disponible.', 403);
    }
    if (/insufficient|permission|scope/i.test(detail)) {
      throw new DriveAuthError(
        'La app no tiene permiso para acceder a Drive. Revisa el Client ID y vuelve a conectar.',
        403,
      );
    }
    throw new GoogleApiError(detail || 'Google Drive ha rechazado la operación.', 403);
  }
  if (response.status === 404) throw new DriveNotFoundError();
  if (response.status === 412) throw new DriveConflictError();
  throw new GoogleApiError(detail || `Error de Google Drive (${response.status}).`, response.status);
}

function filesUrl(params: Record<string, string>): string {
  const search = new URLSearchParams({ supportsAllDrives: 'true', ...params });
  return `${API_BASE}/files?${search.toString()}`;
}

export async function getFileMeta(token: string, fileId: string): Promise<DriveFileMeta> {
  const response = await driveFetch(
    `${API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,etag,trashed,parents&supportsAllDrives=true`,
    token,
  );
  return (await response.json()) as DriveFileMeta;
}

async function findFolder(token: string): Promise<DriveFileMeta | null> {
  const q = `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const response = await driveFetch(filesUrl({ q, fields: 'files(id,name)', spaces: 'drive' }), token);
  const body = (await response.json()) as { files?: DriveFileMeta[] };
  return body.files?.[0] ?? null;
}

async function createFolder(token: string): Promise<DriveFileMeta> {
  const response = await driveFetch(`${API_BASE}/files?fields=id,name&supportsAllDrives=true`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return (await response.json()) as DriveFileMeta;
}

async function findFileInFolder(token: string, folderId: string): Promise<DriveFileMeta | null> {
  const q = `'${folderId}' in parents and name = '${FILE_NAME}' and trashed = false`;
  const response = await driveFetch(filesUrl({ q, fields: 'files(id,name,modifiedTime)', spaces: 'drive' }), token);
  const body = (await response.json()) as { files?: DriveFileMeta[] };
  return body.files?.[0] ?? null;
}

function emptyPayload(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    books: [],
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

async function createFile(
  token: string,
  folderId: string,
  data: AppData,
): Promise<DriveFileMeta> {
  const boundary = `paginas-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({
    name: FILE_NAME,
    mimeType: 'application/json',
    parents: [folderId],
  });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(data),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const response = await driveFetch(
    `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime,etag&supportsAllDrives=true`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await response.json()) as DriveFileMeta;
}

/**
 * Localiza (o crea) la carpeta visible «Proyecto Lectura» y el archivo `lecturas.json`.
 * Reutiliza los ids guardados en el dispositivo para ahorrar peticiones.
 */
export async function ensureSyncFile(
  token: string,
  cached: { folderId?: string; fileId?: string },
): Promise<SyncFileIds> {
  if (cached.fileId) {
    try {
      const meta = await getFileMeta(token, cached.fileId);
      if (!meta.trashed) {
        return { fileId: meta.id, folderId: cached.folderId ?? meta.parents?.[0] ?? '' };
      }
    } catch (error) {
      if (!(error instanceof DriveNotFoundError)) throw error;
    }
  }

  let folderId = cached.folderId;
  try {
    if (!folderId) {
      const folder = (await findFolder(token)) ?? (await createFolder(token));
      folderId = folder.id;
    }
    const existing = await findFileInFolder(token, folderId);
    if (existing) return { fileId: existing.id, folderId };

    const created = await createFile(token, folderId, emptyPayload());
    return { fileId: created.id, folderId };
  } catch (error) {
    if (error instanceof DriveNotFoundError && cached.folderId) {
      const folder = (await findFolder(token)) ?? (await createFolder(token));
      const existing = await findFileInFolder(token, folder.id);
      if (existing) return { fileId: existing.id, folderId: folder.id };
      const created = await createFile(token, folder.id, emptyPayload());
      return { fileId: created.id, folderId: folder.id };
    }
    throw error;
  }
}

export async function downloadFileText(token: string, fileId: string): Promise<string> {
  const response = await driveFetch(
    `${API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    token,
  );
  return response.text();
}

/** Sube el JSON completo. Con `etag` usa If-Match para detectar ediciones concurrentes. */
export async function uploadFileText(
  token: string,
  fileId: string,
  content: string,
  etag?: string,
): Promise<DriveFileMeta> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=UTF-8' };
  if (etag) headers['If-Match'] = etag;

  const response = await driveFetch(
    `${UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,modifiedTime,etag&supportsAllDrives=true`,
    token,
    { method: 'PATCH', headers, body: content },
  );
  return (await response.json()) as DriveFileMeta;
}

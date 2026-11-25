import type { AppData } from '../../types';
import { mergeData, sameContent } from '../merge';
import { parsePayloadText } from '../validate';
import {
  downloadFileText,
  ensureSyncFile,
  getFileMeta,
  uploadFileText,
  type SyncFileIds,
} from './api';
import { DriveConflictError, DriveError, DriveNotFoundError } from './errors';

export interface SyncOutcome {
  data: AppData;
  fileId: string;
  folderId: string;
  /** true si el estado local debe actualizarse con lo descargado. */
  pulled: boolean;
  /** true si se ha subido contenido a Drive. */
  pushed: boolean;
}

export function serializeData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

async function readRemote(token: string, fileId: string): Promise<AppData | null> {
  const text = await downloadFileText(token, fileId);
  try {
    return parsePayloadText(text);
  } catch (error) {
    throw new DriveError(
      'invalid',
      error instanceof Error
        ? error.message
        : 'El archivo de Drive tiene un formato desconocido; no se ha modificado nada.',
    );
  }
}

async function runSync(
  token: string,
  ids: SyncFileIds,
  local: AppData,
): Promise<SyncOutcome> {
  const remote = await readRemote(token, ids.fileId);
  let merged = remote ? mergeData(local, remote) : local;
  let pushed = false;

  if (!remote || !sameContent(merged, remote)) {
    let attempt = 0;
    for (;;) {
      const meta = await getFileMeta(token, ids.fileId);
      try {
        await uploadFileText(token, ids.fileId, serializeData(merged), meta.etag);
        pushed = true;
        break;
      } catch (error) {
        // Alguien escribió entre nuestra descarga y nuestra subida: re-unimos y reintentamos.
        if (error instanceof DriveConflictError && attempt < 2) {
          attempt += 1;
          const latest = await readRemote(token, ids.fileId);
          if (latest) merged = mergeData(merged, latest);
          continue;
        }
        throw error;
      }
    }
  }

  return {
    data: merged,
    fileId: ids.fileId,
    folderId: ids.folderId,
    pulled: !sameContent(local, merged),
    pushed,
  };
}

/**
 * Sincronización completa en un solo paso:
 * localizar archivo → descargar → unir → subir si hace falta (con control de concurrencia).
 */
export async function synchronizeOnce(options: {
  token: string;
  local: AppData;
  folderId?: string;
  fileId?: string;
}): Promise<SyncOutcome> {
  const ids = await ensureSyncFile(options.token, {
    folderId: options.folderId,
    fileId: options.fileId,
  });

  try {
    return await runSync(options.token, ids, options.local);
  } catch (error) {
    // El archivo se borró desde Drive: lo recreamos una vez y repetimos.
    if (error instanceof DriveNotFoundError) {
      const recreated = await ensureSyncFile(options.token, { folderId: ids.folderId });
      return runSync(options.token, recreated, options.local);
    }
    throw error;
  }
}

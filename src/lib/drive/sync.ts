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
import {
  DriveConflictError,
  DriveError,
  DriveNotFoundError,
  GoogleApiError,
} from './errors';

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

/** Algunos entornos no aceptan If-Match en la subida; en ese caso se sube sin condición. */
function isConditionalHeaderRejected(error: unknown): boolean {
  return (
    error instanceof GoogleApiError &&
    error.status === 400 &&
    /etag|if-match|conditional|precondition/i.test(error.message)
  );
}

async function runSync(
  token: string,
  ids: SyncFileIds,
  local: AppData,
): Promise<SyncOutcome> {
  const baseMeta = await getFileMeta(token, ids.fileId);
  const remote = await readRemote(token, ids.fileId);
  let merged = remote ? mergeData(local, remote) : local;
  let pushed = false;
  let baseModifiedTime = baseMeta.modifiedTime ?? '';

  if (!remote || !sameContent(merged, remote)) {
    let attempt = 0;
    for (;;) {
      const freshMeta = await getFileMeta(token, ids.fileId);

      // Si alguien escribió después de nuestra descarga, re-unimos antes de subir.
      if (
        baseModifiedTime &&
        freshMeta.modifiedTime &&
        freshMeta.modifiedTime !== baseModifiedTime
      ) {
        if (attempt >= 2) {
          throw new DriveConflictError(
            'El archivo de Drive cambió mientras se sincronizaba. Inténtalo de nuevo.',
          );
        }
        attempt += 1;
        const latest = await readRemote(token, ids.fileId);
        if (latest) merged = mergeData(merged, latest);
        baseModifiedTime = freshMeta.modifiedTime;
        continue;
      }

      try {
        await uploadFileText(token, ids.fileId, serializeData(merged), freshMeta.etag);
        pushed = true;
        break;
      } catch (error) {
        if (error instanceof DriveConflictError && attempt < 2) {
          attempt += 1;
          const latest = await readRemote(token, ids.fileId);
          if (latest) merged = mergeData(merged, latest);
          const latestMeta = await getFileMeta(token, ids.fileId);
          baseModifiedTime = latestMeta.modifiedTime ?? '';
          continue;
        }
        if (isConditionalHeaderRejected(error)) {
          // Reintento sin If-Match: la comprobación por modifiedTime sigue evitando
          // la mayoría de conflictos.
          await uploadFileText(token, ids.fileId, serializeData(merged));
          pushed = true;
          break;
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

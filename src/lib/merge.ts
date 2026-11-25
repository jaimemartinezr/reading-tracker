import type { AppData, Book, Entry } from '../types';
import { SCHEMA_VERSION } from '../types';

type Timestamped = { id: string; updatedAt: string };

function isNewerOrEqual(a: Timestamped, b: Timestamped): boolean {
  if (a.updatedAt === b.updatedAt) {
    // En caso de empate gana la versión borrada, para no resucitar registros.
    const aDeleted = 'deletedAt' in a && Boolean((a as { deletedAt?: string }).deletedAt);
    const bDeleted = 'deletedAt' in b && Boolean((b as { deletedAt?: string }).deletedAt);
    return aDeleted && !bDeleted;
  }
  return a.updatedAt > b.updatedAt;
}

/**
 * Une dos listas por `id`. Gana siempre la versión con `updatedAt` más reciente.
 * Es conmutativa e idempotente, condición necesaria para sincronizar sin servidor.
 */
export function mergeCollection<T extends Timestamped>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of local) byId.set(item.id, item);
  for (const item of remote) {
    const current = byId.get(item.id);
    if (!current) {
      byId.set(item.id, item);
    } else if (isNewerOrEqual(item, current)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function bookOrder(a: Book, b: Book): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function entryOrder(a: Entry, b: Entry): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function mergeData(local: AppData, remote: AppData): AppData {
  const books = mergeCollection(local.books, remote.books).sort(bookOrder);
  const entries = mergeCollection(local.entries, remote.entries).sort(entryOrder);
  return {
    schemaVersion: SCHEMA_VERSION,
    books,
    entries,
    updatedAt: local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,
  };
}

/** Firma estable del contenido: permite comparar dos estados sin importar el orden. */
export function dataSignature(data: AppData): string {
  const books = [...data.books]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((book) => [
      book.id,
      book.title,
      book.author ?? '',
      book.totalPages,
      book.color,
      book.createdAt,
      book.updatedAt,
      book.deletedAt ?? '',
    ]);

  const entries = [...data.entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => [
      entry.id,
      entry.bookId,
      entry.date,
      entry.pages,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt ?? '',
    ]);

  return JSON.stringify({ books, entries });
}

export function sameContent(a: AppData, b: AppData): boolean {
  return dataSignature(a) === dataSignature(b);
}

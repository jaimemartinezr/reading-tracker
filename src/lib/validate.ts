import type { AppData, Book, Entry } from '../types';
import { BOOK_COLORS, DEFAULT_BOOK_COLOR, SCHEMA_VERSION } from '../types';
import { isISODate } from './date';

export class InvalidDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 300): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function cleanPages(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded <= 0 || rounded > 100_000) return null;
  return rounded;
}

function cleanColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  return DEFAULT_BOOK_COLOR;
}

function sanitizeBook(raw: unknown, fallbackTime: string): Book | null {
  if (!isRecord(raw)) return null;
  const id = cleanString(raw.id, 120);
  const title = cleanString(raw.title, 200);
  const totalPages = cleanPages(raw.totalPages);
  if (!id || !title || totalPages === null) return null;

  const createdAt = cleanTimestamp(raw.createdAt) ?? fallbackTime;
  const book: Book = {
    id,
    title,
    totalPages,
    color: cleanColor(raw.color),
    createdAt,
    updatedAt: cleanTimestamp(raw.updatedAt) ?? createdAt,
  };
  const author = cleanString(raw.author, 160);
  if (author) book.author = author;

  const rawStart = cleanPages(raw.startPage);
  const rawEnd = cleanPages(raw.endPage);
  if (rawStart !== null || rawEnd !== null) {
    const startPage = rawStart === null ? 1 : Math.min(rawStart, totalPages);
    const endPage = rawEnd === null ? totalPages : Math.min(rawEnd, totalPages);
    // Si el rango es incoherente se ignora y cuenta el libro completo.
    if (startPage <= endPage) {
      if (startPage > 1) book.startPage = startPage;
      if (endPage < totalPages) book.endPage = endPage;
    }
  }

  const deletedAt = cleanTimestamp(raw.deletedAt);
  if (deletedAt) book.deletedAt = deletedAt;
  return book;
}

function sanitizeEntry(raw: unknown, fallbackTime: string): Entry | null {
  if (!isRecord(raw)) return null;
  const id = cleanString(raw.id, 120);
  const bookId = cleanString(raw.bookId, 120);
  const pages = cleanPages(raw.pages);
  const date = typeof raw.date === 'string' && isISODate(raw.date) ? raw.date : null;
  if (!id || !bookId || pages === null || !date) return null;

  const createdAt = cleanTimestamp(raw.createdAt) ?? fallbackTime;
  const entry: Entry = {
    id,
    bookId,
    date,
    pages,
    createdAt,
    updatedAt: cleanTimestamp(raw.updatedAt) ?? createdAt,
  };
  const deletedAt = cleanTimestamp(raw.deletedAt);
  if (deletedAt) entry.deletedAt = deletedAt;
  return entry;
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Valida y normaliza datos desconocidos (de Drive, de un archivo importado...).
 * Descarta registros inválidos, pero lanza si el documento entero no tiene forma válida
 * para no sobrescribir datos buenos con basura.
 */
export function sanitizeData(raw: unknown): AppData {
  if (!isRecord(raw)) {
    throw new InvalidDataError('El archivo de datos no tiene el formato esperado.');
  }
  if (!Array.isArray(raw.books) || !Array.isArray(raw.entries)) {
    throw new InvalidDataError('El archivo de datos no contiene listas de libros y registros.');
  }

  const fallbackTime = new Date().toISOString();
  const books = dedupe(
    raw.books
      .map((book) => sanitizeBook(book, fallbackTime))
      .filter((book): book is Book => book !== null),
  );
  const entries = dedupe(
    raw.entries
      .map((entry) => sanitizeEntry(entry, fallbackTime))
      .filter((entry): entry is Entry => entry !== null),
  );

  if (raw.books.length > 0 && books.length === 0) {
    throw new InvalidDataError('Ningún libro del archivo es válido; no se han modificado tus datos.');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    books,
    entries,
    updatedAt: cleanTimestamp(raw.updatedAt) ?? fallbackTime,
  };
}

/** Devuelve `null` cuando el archivo está vacío o es un JSON vacío (aún sin datos). */
export function parsePayloadText(text: string): AppData | null {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed || trimmed === '{}' || trimmed === 'null') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new InvalidDataError('El archivo de Drive no es un JSON válido.');
  }
  return sanitizeData(raw);
}

export function isKnownColor(color: string): boolean {
  return (BOOK_COLORS as readonly string[]).includes(color);
}

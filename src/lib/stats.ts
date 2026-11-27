import type { Book, Entry } from '../types';
import { addDays, daysBetween, todayISO } from './date';

export function isVisibleBook(book: Book): boolean {
  return !book.deletedAt;
}

export function isVisibleEntry(entry: Entry): boolean {
  return !entry.deletedAt;
}

export function activeBooks(books: Book[]): Book[] {
  return books.filter(isVisibleBook);
}

export interface ReadingRange {
  startPage: number;
  endPage: number;
  readingPages: number;
}

/** Rango de páginas que cuentan como lectura, con los valores por defecto aplicados. */
export function readingRange(book: Book): ReadingRange {
  const total = Math.max(1, Math.round(book.totalPages));
  const start = Math.min(Math.max(1, Math.round(book.startPage ?? 1)), total);
  const end = Math.min(Math.max(start, Math.round(book.endPage ?? total)), total);
  return { startPage: start, endPage: end, readingPages: end - start + 1 };
}

export function activeEntries(entries: Entry[], books: Book[]): Entry[] {
  const ids = new Set(activeBooks(books).map((book) => book.id));
  return entries.filter((entry) => isVisibleEntry(entry) && ids.has(entry.bookId));
}

export function pagesOnDate(entries: Entry[], date: string): number {
  return entries
    .filter((entry) => isVisibleEntry(entry) && entry.date === date)
    .reduce((sum, entry) => sum + entry.pages, 0);
}

/** Páginas acumuladas de un libro hasta una fecha inclusive (sin contar borrados). */
export function bookPagesUpTo(entries: Entry[], bookId: string, date: string): number {
  return entries
    .filter(
      (entry) => isVisibleEntry(entry) && entry.bookId === bookId && entry.date <= date,
    )
    .reduce((sum, entry) => sum + entry.pages, 0);
}

export function bookPagesRead(entries: Entry[], bookId: string): number {
  return entries
    .filter((entry) => isVisibleEntry(entry) && entry.bookId === bookId)
    .reduce((sum, entry) => sum + entry.pages, 0);
}

export interface DayStat {
  date: string;
  /** Páginas leídas ese día, sumando todos los libros. */
  pages: number;
  /** Páginas por libro ese día. */
  perBook: Record<string, number>;
  /** Porcentaje de la biblioteca activa leído ese día. */
  libraryPercent: number;
}

export function buildDayStat(date: string, books: Book[], entries: Entry[]): DayStat {
  const visibleBooks = activeBooks(books);
  const totalPages = visibleBooks.reduce((sum, book) => sum + readingRange(book).readingPages, 0);
  const perBook: Record<string, number> = {};

  for (const book of visibleBooks) {
    const pages = entries
      .filter(
        (entry) => isVisibleEntry(entry) && entry.bookId === book.id && entry.date === date,
      )
      .reduce((sum, entry) => sum + entry.pages, 0);
    if (pages > 0) perBook[book.id] = pages;
  }

  const pages = Object.values(perBook).reduce((sum, value) => sum + value, 0);
  return {
    date,
    pages,
    perBook,
    libraryPercent: totalPages > 0 ? (pages / totalPages) * 100 : 0,
  };
}

/** Devuelve los últimos `count` días, del más antiguo al más reciente. */
export function lastNDays(
  count: number,
  books: Book[],
  entries: Entry[],
  today: string = todayISO(),
): DayStat[] {
  const days: DayStat[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    days.push(buildDayStat(addDays(today, -i), books, entries));
  }
  return days;
}

export interface BookStat {
  book: Book;
  pagesRead: number;
  remainingPages: number;
  /** Porcentaje del libro leído, entre 0 y 100. */
  percent: number;
  /** Página en la que se encuentra el lector (páginas acumuladas, sin superar el final). */
  currentPage: number;
  /** Primera página que cuenta como lectura. */
  startPage: number;
  /** Última página que cuenta como lectura. */
  endPage: number;
  /** Número de páginas que cuentan como lectura (endPage - startPage + 1). */
  readingPages: number;
  /** Porcentaje del libro leído hoy. */
  percentToday: number;
  pagesToday: number;
  /** Media de páginas por día desde el primer registro. */
  pace: number;
  estimatedFinish: string | null;
  firstReadDate: string | null;
  lastReadDate: string | null;
  daysReading: number;
}

export function bookStat(book: Book, entries: Entry[], today: string = todayISO()): BookStat {
  const range = readingRange(book);
  const mine = entries.filter(
    (entry) => isVisibleEntry(entry) && entry.bookId === book.id,
  );
  const pagesRead = mine.reduce((sum, entry) => sum + entry.pages, 0);
  const pagesToday = mine
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + entry.pages, 0);

  const dates = mine.map((entry) => entry.date).sort();
  const firstReadDate = dates[0] ?? null;
  const lastReadDate = dates[dates.length - 1] ?? null;
  const daysReading = new Set(dates).size;

  const percent =
    range.readingPages > 0 ? Math.min(100, (pagesRead / range.readingPages) * 100) : 0;
  const currentPage =
    pagesRead > 0 ? Math.min(range.startPage + pagesRead - 1, range.endPage) : 0;
  const remainingPages = Math.max(0, range.readingPages - pagesRead);

  const spanDays = firstReadDate ? Math.max(1, daysBetween(firstReadDate, today) + 1) : 0;
  const pace = spanDays > 0 ? pagesRead / spanDays : 0;
  const estimatedFinish =
    pace > 0 && remainingPages > 0
      ? addDays(today, Math.max(1, Math.ceil(remainingPages / pace)))
      : null;

  return {
    book,
    pagesRead,
    remainingPages,
    percent,
    currentPage,
    startPage: range.startPage,
    endPage: range.endPage,
    readingPages: range.readingPages,
    percentToday:
      range.readingPages > 0 ? Math.min(100, (pagesToday / range.readingPages) * 100) : 0,
    pagesToday,
    pace,
    estimatedFinish,
    firstReadDate,
    lastReadDate,
    daysReading,
  };
}

export interface LibraryTotals {
  activeBooks: number;
  totalPages: number;
  pagesRead: number;
  percent: number;
  remainingPages: number;
  pagesToday: number;
  percentToday: number;
  today: string;
}

export function libraryTotals(
  books: Book[],
  entries: Entry[],
  today: string = todayISO(),
): LibraryTotals {
  const visible = activeBooks(books);
  const totalPages = visible.reduce((sum, book) => sum + readingRange(book).readingPages, 0);
  const valid = activeEntries(entries, books);
  const pagesRead = valid.reduce((sum, entry) => sum + entry.pages, 0);
  const pagesToday = valid
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + entry.pages, 0);

  return {
    activeBooks: visible.length,
    totalPages,
    pagesRead,
    percent: totalPages > 0 ? Math.min(100, (pagesRead / totalPages) * 100) : 0,
    remainingPages: Math.max(0, totalPages - pagesRead),
    pagesToday,
    percentToday: totalPages > 0 ? (pagesToday / totalPages) * 100 : 0,
    today,
  };
}

/** Días consecutivos leyendo, contando desde hoy o desde ayer. */
export function readingStreak(entries: Entry[], today: string = todayISO()): number {
  const dates = new Set(entries.filter(isVisibleEntry).map((entry) => entry.date));
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestDay(days: DayStat[]): DayStat | null {
  let best: DayStat | null = null;
  for (const day of days) {
    if (day.pages > 0 && (!best || day.pages > best.pages)) best = day;
  }
  return best;
}

/**
 * Días del mes indicado (0 = enero) con sus estadísticas.
 * Para el mes actual solo incluye los días transcurridos; para meses futuros, ninguno.
 */
export function monthDayStats(
  year: number,
  monthIndex: number,
  books: Book[],
  entries: Entry[],
  today: string = todayISO(),
): DayStat[] {
  const pad = (value: number) => String(value).padStart(2, '0');
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  const firstDay = `${prefix}-01`;
  if (firstDay > today) return [];

  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const isCurrentMonth = today.startsWith(prefix);
  const lastDay = isCurrentMonth ? Number(today.slice(8)) : totalDays;

  const days: DayStat[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    days.push(buildDayStat(`${prefix}-${pad(day)}`, books, entries));
  }
  return days;
}

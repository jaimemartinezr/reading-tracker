import { describe, expect, it } from 'vitest';
import type { Book, Entry } from '../src/types';
import {
  bestDay,
  bookStat,
  buildDayStat,
  lastNDays,
  libraryTotals,
  pagesOnDate,
  readingStreak,
} from '../src/lib/stats';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Meditaciones',
    totalPages: 200,
    color: '#b4532b',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    bookId: 'book-1',
    date: '2026-01-10',
    pages: 20,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('pagesOnDate', () => {
  it('suma las páginas de todos los libros y excluye borrados', () => {
    const entries = [
      makeEntry({ id: 'a', pages: 10 }),
      makeEntry({ id: 'b', bookId: 'book-2', pages: 15 }),
      makeEntry({ id: 'c', pages: 40, deletedAt: '2026-01-11T10:00:00.000Z' }),
      makeEntry({ id: 'd', date: '2026-01-11', pages: 7 }),
    ];
    expect(pagesOnDate(entries, '2026-01-10')).toBe(25);
  });
});

describe('buildDayStat', () => {
  const books = [makeBook(), makeBook({ id: 'book-2', totalPages: 100 })];
  const entries = [
    makeEntry({ pages: 10 }),
    makeEntry({ id: 'e2', bookId: 'book-2', pages: 20, date: '2026-01-10' }),
    makeEntry({ id: 'e3', bookId: 'book-2', pages: 5, date: '2026-01-11' }),
  ];

  it('agrupa páginas por libro y calcula el porcentaje de biblioteca del día', () => {
    const stat = buildDayStat('2026-01-10', books, entries);
    expect(stat.pages).toBe(30);
    expect(stat.perBook).toEqual({ 'book-1': 10, 'book-2': 20 });
    expect(stat.libraryPercent).toBeCloseTo((30 / 300) * 100);
  });

  it('devuelve ceros cuando no hay registros', () => {
    const stat = buildDayStat('2026-01-12', books, entries);
    expect(stat.pages).toBe(0);
    expect(stat.libraryPercent).toBe(0);
    expect(stat.perBook).toEqual({});
  });

  it('no cuenta libros borrados', () => {
    const withDeleted = [makeBook({ deletedAt: '2026-01-05T00:00:00.000Z' })];
    const stat = buildDayStat('2026-01-10', withDeleted, entries);
    expect(stat.pages).toBe(0);
    expect(stat.libraryPercent).toBe(0);
  });
});

describe('lastNDays', () => {
  it('devuelve los días en orden cronológico acabando en hoy', () => {
    const days = lastNDays(3, [makeBook()], [makeEntry({ date: '2026-01-10', pages: 12 })], '2026-01-10');
    expect(days.map((day) => day.date)).toEqual([
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ]);
    expect(days[2].pages).toBe(12);
  });
});

describe('bookStat', () => {
  it('calcula porcentaje, restante y páginas de hoy', () => {
    const entries = [
      makeEntry({ date: '2026-01-01', pages: 50 }),
      makeEntry({ id: 'e2', date: '2026-01-10', pages: 25 }),
    ];
    const stat = bookStat(makeBook({ totalPages: 200 }), entries, '2026-01-10');
    expect(stat.pagesRead).toBe(75);
    expect(stat.percent).toBe(37.5);
    expect(stat.percentToday).toBe(12.5);
    expect(stat.pagesToday).toBe(25);
    expect(stat.remainingPages).toBe(125);
    expect(stat.daysReading).toBe(2);
    expect(stat.firstReadDate).toBe('2026-01-01');
    expect(stat.lastReadDate).toBe('2026-01-10');
  });

  it('calcula un ritmo y una fecha de fin coherentes', () => {
    const entries = [
      makeEntry({ date: '2026-01-01', pages: 20 }),
      makeEntry({ id: 'e2', date: '2026-01-02', pages: 20 }),
      makeEntry({ id: 'e3', date: '2026-01-03', pages: 20 }),
      makeEntry({ id: 'e4', date: '2026-01-04', pages: 20 }),
      makeEntry({ id: 'e5', date: '2026-01-05', pages: 20 }),
    ];
    const stat = bookStat(makeBook({ totalPages: 200 }), entries, '2026-01-10');
    // 100 páginas en 10 días => 10 páginas/día, quedan 100 => 10 días.
    expect(stat.pace).toBeCloseTo(10);
    expect(stat.estimatedFinish).toBe('2026-01-20');
  });

  it('no estima fin para libros terminados', () => {
    const stat = bookStat(
      makeBook({ totalPages: 40 }),
      [makeEntry({ pages: 40 })],
      '2026-01-10',
    );
    expect(stat.remainingPages).toBe(0);
    expect(stat.estimatedFinish).toBeNull();
  });
});

describe('libraryTotals', () => {
  it('suma solo libros y registros visibles', () => {
    const books = [
      makeBook({ totalPages: 100 }),
      makeBook({ id: 'book-2', totalPages: 300 }),
      makeBook({ id: 'book-3', totalPages: 500, deletedAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const entries = [
      makeEntry({ pages: 30 }),
      makeEntry({ id: 'e2', bookId: 'book-2', pages: 20, date: '2026-01-10' }),
      makeEntry({ id: 'e3', bookId: 'book-3', pages: 10, date: '2026-01-10' }),
    ];
    const totals = libraryTotals(books, entries, '2026-01-10');
    expect(totals.activeBooks).toBe(2);
    expect(totals.totalPages).toBe(400);
    expect(totals.pagesRead).toBe(50);
    expect(totals.pagesToday).toBe(50);
    expect(totals.remainingPages).toBe(350);
    expect(totals.percent).toBe(12.5);
    expect(totals.percentToday).toBe(12.5);
  });
});

describe('readingStreak', () => {
  const day = (date: string, id: string) => makeEntry({ id, date, pages: 1 });

  it('cuenta días consecutivos hasta hoy', () => {
    const entries = [day('2026-01-08', 'a'), day('2026-01-09', 'b'), day('2026-01-10', 'c')];
    expect(readingStreak(entries, '2026-01-10')).toBe(3);
  });

  it('permite que la racha acabe ayer', () => {
    const entries = [day('2026-01-08', 'a'), day('2026-01-09', 'b')];
    expect(readingStreak(entries, '2026-01-10')).toBe(2);
  });

  it('devuelve 0 si no hay lectura reciente', () => {
    const entries = [day('2026-01-01', 'a')];
    expect(readingStreak(entries, '2026-01-10')).toBe(0);
  });
});

describe('bestDay', () => {
  it('elige el día con más páginas', () => {
    const days = lastNDays(
      3,
      [makeBook()],
      [
        makeEntry({ id: 'a', date: '2026-01-08', pages: 5 }),
        makeEntry({ id: 'b', date: '2026-01-09', pages: 42 }),
        makeEntry({ id: 'c', date: '2026-01-10', pages: 7 }),
      ],
      '2026-01-10',
    );
    expect(bestDay(days)?.date).toBe('2026-01-09');
  });

  it('devuelve null si no hay páginas', () => {
    expect(bestDay(lastNDays(3, [makeBook()], [], '2026-01-10'))).toBeNull();
  });
});

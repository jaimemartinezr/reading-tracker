import { describe, expect, it } from 'vitest';
import type { Book, Entry } from '../src/types';
import { bookStat } from '../src/lib/stats';
import { positionHint, positionLabel } from '../src/lib/position';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    title: 'Meditaciones',
    totalPages: 200,
    color: '#b4532b',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function entry(pages: number, date = '2026-01-02'): Entry {
  return {
    id: `e-${pages}-${date}`,
    bookId: 'b1',
    date,
    pages,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
  };
}

describe('posición en el libro', () => {
  it('sin registros: sin empezar', () => {
    const stat = bookStat(book(), [], '2026-01-10');
    expect(stat.currentPage).toBe(0);
    expect(positionLabel(stat)).toBe('Sin empezar');
    expect(positionHint(stat)).toBe('Sin empezar · 200 páginas');
  });

  it('a mitad: página acumulada', () => {
    const stat = bookStat(book(), [entry(50), entry(25, '2026-01-03')], '2026-01-10');
    expect(stat.currentPage).toBe(75);
    expect(positionLabel(stat)).toBe('Página 75 de 200');
    expect(positionHint(stat)).toBe('Vas por la página 75 de 200');
  });

  it('con rango: empieza en la página indicada', () => {
    const stat = bookStat(
      book({ totalPages: 400, startPage: 21, endPage: 380 }),
      [entry(30)],
      '2026-01-10',
    );
    expect(stat.currentPage).toBe(50);
    expect(positionLabel(stat)).toBe('Página 50 de 380');
    expect(positionHint(stat)).toBe('Vas por la página 50 de 380');
  });

  it('con rango y sin empezar: indica la página de inicio', () => {
    const stat = bookStat(book({ totalPages: 400, startPage: 21 }), [], '2026-01-10');
    expect(positionLabel(stat)).toBe('Sin empezar');
    expect(positionHint(stat)).toBe('Sin empezar · empieza en la página 21');
  });

  it('terminado: no supera el total', () => {
    const stat = bookStat(book(), [entry(150), entry(90, '2026-01-03')], '2026-01-10');
    expect(stat.pagesRead).toBe(240);
    expect(stat.currentPage).toBe(200);
    expect(stat.remainingPages).toBe(0);
    expect(positionLabel(stat)).toBe('Terminado');
    expect(positionHint(stat)).toBe('Libro terminado');
  });
});

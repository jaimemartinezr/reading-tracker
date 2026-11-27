import { describe, expect, it } from 'vitest';
import type { AppData, Book, Entry } from '../src/types';
import { dataSignature, mergeCollection, mergeData, sameContent } from '../src/lib/merge';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    title: 'Libro',
    totalPages: 100,
    color: '#3d6b5a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    bookId: 'b1',
    date: '2026-01-02',
    pages: 10,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function data(overrides: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    books: [],
    entries: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeCollection', () => {
  it('gana la versión con updatedAt más reciente', () => {
    const local = [entry({ pages: 10, updatedAt: '2026-01-03T10:00:00.000Z' })];
    const remote = [entry({ pages: 25, updatedAt: '2026-01-03T12:00:00.000Z' })];
    expect(mergeCollection(local, remote)[0].pages).toBe(25);
    expect(mergeCollection(remote, local)[0].pages).toBe(25);
  });

  it('conserva los elementos que solo existen en un lado', () => {
    const local = [entry({ id: 'a' })];
    const remote = [entry({ id: 'b' })];
    expect(mergeCollection(local, remote).map((item) => item.id).sort()).toEqual(['a', 'b']);
  });

  it('en caso de empate conserva el tombstone', () => {
    const deleted = entry({
      updatedAt: '2026-01-03T10:00:00.000Z',
      deletedAt: '2026-01-03T10:00:00.000Z',
    });
    const alive = entry({ updatedAt: '2026-01-03T10:00:00.000Z' });
    expect(mergeCollection([alive], [deleted])[0].deletedAt).toBeDefined();
    expect(mergeCollection([deleted], [alive])[0].deletedAt).toBeDefined();
  });

  it('propaga un borrado posterior', () => {
    const alive = entry({ updatedAt: '2026-01-03T10:00:00.000Z' });
    const deleted = entry({
      updatedAt: '2026-01-04T10:00:00.000Z',
      deletedAt: '2026-01-04T10:00:00.000Z',
    });
    expect(mergeCollection([alive], [deleted])[0].deletedAt).toBe(
      '2026-01-04T10:00:00.000Z',
    );
  });
});

describe('mergeData', () => {
  const local = data({
    books: [book({ id: 'b1', updatedAt: '2026-01-02T00:00:00.000Z' })],
    entries: [entry({ id: 'e1', pages: 10 })],
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  const remote = data({
    books: [book({ id: 'b2', title: 'Otro', createdAt: '2026-01-03T00:00:00.000Z' })],
    entries: [entry({ id: 'e2', bookId: 'b2', pages: 20, date: '2026-01-03' })],
    updatedAt: '2026-01-03T00:00:00.000Z',
  });

  it('une libros y registros de ambos lados', () => {
    const merged = mergeData(local, remote);
    expect(merged.books.map((item) => item.id).sort()).toEqual(['b1', 'b2']);
    expect(merged.entries.map((item) => item.id).sort()).toEqual(['e1', 'e2']);
    expect(merged.updatedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('es idempotente', () => {
    const merged = mergeData(local, remote);
    expect(dataSignature(mergeData(merged, merged))).toBe(dataSignature(merged));
    expect(dataSignature(mergeData(merged, local))).toBe(dataSignature(merged));
    expect(dataSignature(mergeData(local, merged))).toBe(dataSignature(merged));
  });

  it('no pierde datos si se sincroniza en cualquier orden', () => {
    expect(dataSignature(mergeData(local, remote))).toBe(
      dataSignature(mergeData(remote, local)),
    );
  });

  it('ordena los registros por fecha', () => {
    const merged = mergeData(
      data({ entries: [entry({ id: 'a', date: '2026-01-05' })] }),
      data({ entries: [entry({ id: 'b', date: '2026-01-02', createdAt: '2026-01-02T01:00:00.000Z' })] }),
    );
    expect(merged.entries.map((item) => item.date)).toEqual(['2026-01-02', '2026-01-05']);
  });
});

describe('sameContent', () => {
  it('ignora el orden de los arrays', () => {
    const a = data({ entries: [entry({ id: 'a' }), entry({ id: 'b' })] });
    const b = data({ entries: [entry({ id: 'b' }), entry({ id: 'a' })] });
    expect(sameContent(a, b)).toBe(true);
  });

  it('detecta cambios en el rango de lectura', () => {
    const a = data({ books: [book({ totalPages: 400 })] });
    const b = data({ books: [book({ totalPages: 400, startPage: 21, endPage: 380 })] });
    expect(sameContent(a, b)).toBe(false);
  });

  it('detecta cambios de contenido', () => {
    const a = data({ entries: [entry({ pages: 10 })] });
    const b = data({ entries: [entry({ pages: 11 })] });
    expect(sameContent(a, b)).toBe(false);
  });

  it('ignora updatedAt global del documento', () => {
    const a = data({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const b = data({ updatedAt: '2026-02-01T00:00:00.000Z' });
    expect(sameContent(a, b)).toBe(true);
  });
});

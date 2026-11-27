import { describe, expect, it } from 'vitest';
import { InvalidDataError, parsePayloadText, sanitizeData } from '../src/lib/validate';

const validBook = {
  id: 'b1',
  title: 'Meditaciones',
  author: 'Marco Aurelio',
  totalPages: 200,
  color: '#3d6b5a',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const validEntry = {
  id: 'e1',
  bookId: 'b1',
  date: '2026-01-02',
  pages: 12,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('parsePayloadText', () => {
  it('devuelve null para un archivo vacío o un JSON vacío', () => {
    expect(parsePayloadText('')).toBeNull();
    expect(parsePayloadText('  \n ')).toBeNull();
    expect(parsePayloadText('{}')).toBeNull();
  });

  it('lanza un error claro si el JSON no es válido', () => {
    expect(() => parsePayloadText('{ roto')).toThrow(InvalidDataError);
  });

  it('lee datos válidos', () => {
    const parsed = parsePayloadText(
      JSON.stringify({ schemaVersion: 1, books: [validBook], entries: [validEntry] }),
    );
    expect(parsed?.books).toHaveLength(1);
    expect(parsed?.entries[0].pages).toBe(12);
  });
});

describe('sanitizeData', () => {
  it('descarta libros y registros inválidos sin romper el resto', () => {
    const data = sanitizeData({
      books: [
        validBook,
        { id: 'b2', title: 'Sin páginas', totalPages: 0 },
        { id: 'b3', title: '', totalPages: 100 },
      ],
      entries: [
        validEntry,
        { ...validEntry, id: 'e2', pages: -3 },
        { ...validEntry, id: 'e3', date: '2026-13-45' },
      ],
    });
    expect(data.books.map((book) => book.id)).toEqual(['b1']);
    expect(data.entries.map((entry) => entry.id)).toEqual(['e1']);
  });

  it('normaliza el color si no es válido', () => {
    const data = sanitizeData({
      books: [{ ...validBook, color: 'azul' }],
      entries: [],
    });
    expect(data.books[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('conserva las marcas de borrado', () => {
    const data = sanitizeData({
      books: [{ ...validBook, deletedAt: '2026-02-01T00:00:00.000Z' }],
      entries: [],
    });
    expect(data.books[0].deletedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('elimina ids duplicados', () => {
    const data = sanitizeData({
      books: [validBook, { ...validBook, title: 'Duplicado' }],
      entries: [],
    });
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe('Meditaciones');
  });

  it('lanza si el documento no tiene la forma esperada', () => {
    expect(() => sanitizeData({ foo: 'bar' })).toThrow(InvalidDataError);
    expect(() => sanitizeData([])).toThrow(InvalidDataError);
    expect(() => sanitizeData(null)).toThrow(InvalidDataError);
  });

  it('conserva un rango de lectura válido', () => {
    const data = sanitizeData({
      books: [{ ...validBook, totalPages: 300, startPage: 21, endPage: 280 }],
      entries: [],
    });
    expect(data.books[0].startPage).toBe(21);
    expect(data.books[0].endPage).toBe(280);
  });

  it('recorta el rango al total de páginas', () => {
    const data = sanitizeData({
      books: [{ ...validBook, totalPages: 300, startPage: 10, endPage: 500 }],
      entries: [],
    });
    expect(data.books[0].startPage).toBe(10);
    expect(data.books[0].endPage).toBeUndefined();
  });

  it('ignora un rango incoherente', () => {
    const data = sanitizeData({
      books: [{ ...validBook, totalPages: 300, startPage: 200, endPage: 100 }],
      entries: [],
    });
    expect(data.books[0].startPage).toBeUndefined();
    expect(data.books[0].endPage).toBeUndefined();
  });

  it('no guarda el rango cuando cubre todo el libro', () => {
    const data = sanitizeData({
      books: [{ ...validBook, totalPages: 300, startPage: 1, endPage: 300 }],
      entries: [],
    });
    expect(data.books[0].startPage).toBeUndefined();
    expect(data.books[0].endPage).toBeUndefined();
  });

  it('lanza si hay libros pero ninguno es válido', () => {
    expect(() => sanitizeData({ books: [{ title: 'x' }], entries: [] })).toThrow(
      InvalidDataError,
    );
  });
});

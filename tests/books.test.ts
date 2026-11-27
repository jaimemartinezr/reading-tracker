import { describe, expect, it } from 'vitest';
import { bookAuthor, bookLabel } from '../src/lib/books';

describe('bookLabel', () => {
  it('muestra «Título - Autor»', () => {
    expect(
      bookLabel({ title: 'Crimen y Castigo', author: 'Fiódor Dostoievski' }),
    ).toBe('Crimen y Castigo - Fiódor Dostoievski');
  });

  it('recorta los espacios del autor', () => {
    expect(bookLabel({ title: 'Meditaciones', author: '  Marco Aurelio ' })).toBe(
      'Meditaciones - Marco Aurelio',
    );
  });

  it('usa «Sin autor» en libros antiguos sin autor', () => {
    expect(bookLabel({ title: 'Anónimo', author: undefined })).toBe(
      'Anónimo - Sin autor',
    );
    expect(bookLabel({ title: 'Anónimo', author: '   ' })).toBe('Anónimo - Sin autor');
  });
});

describe('bookAuthor', () => {
  it('devuelve el autor limpio o el respaldo', () => {
    expect(bookAuthor({ author: ' Milan Kundera ' })).toBe('Milan Kundera');
    expect(bookAuthor({ author: undefined })).toBe('Sin autor');
  });
});

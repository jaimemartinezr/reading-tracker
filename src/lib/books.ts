import type { Book } from '../types';

/** Autor visible, con un valor de respaldo para libros antiguos sin autor. */
export function bookAuthor(book: Pick<Book, 'author'>): string {
  return book.author?.trim() || 'Sin autor';
}

/** Etiqueta única para mostrar un libro: «Título - Autor». */
export function bookLabel(book: Pick<Book, 'title' | 'author'>): string {
  return `${book.title} - ${bookAuthor(book)}`;
}

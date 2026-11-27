import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import type { Book, BookInput } from '../types';
import { activeBooks, bookStat, readingRange } from '../lib/stats';
import { formatNumber } from '../lib/format';
import { BookCard } from '../components/BookCard';
import { BookForm } from '../components/BookForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';

type FormMode = { type: 'create' } | { type: 'edit'; book: Book } | null;

interface BooksScreenProps {
  formOpen: boolean;
  onFormClose: () => void;
}

export function BooksScreen({ formOpen, onFormClose }: BooksScreenProps) {
  const { data, addBook, updateBook, deleteBook, notify } = useApp();
  const [mode, setMode] = useState<FormMode>(formOpen ? { type: 'create' } : null);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);

  useEffect(() => {
    if (formOpen) setMode({ type: 'create' });
  }, [formOpen]);

  const closeForm = () => {
    setMode(null);
    onFormClose();
  };

  const books = useMemo(
    () =>
      activeBooks(data.books).sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    [data.books],
  );

  const stats = useMemo(
    () => books.map((book) => bookStat(book, data.entries)),
    [books, data.entries],
  );

  const handleCreate = (input: BookInput) => {
    const book = addBook(input);
    notify(`«${book.title}» añadido a tu biblioteca.`);
  };

  const handleUpdate = (input: BookInput) => {
    if (!mode || mode.type !== 'edit') return;
    updateBook(mode.book.id, input);
    notify('Libro actualizado.');
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {books.length} {books.length === 1 ? 'libro' : 'libros'} ·{' '}
            {formatNumber(
              books.reduce((sum, book) => sum + readingRange(book).readingPages, 0),
            )}{' '}
            páginas de lectura
          </p>
          <h1 className="page-title">Biblioteca</h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setMode({ type: 'create' })}>
          <Icon name="plus" size={18} />
          Añadir libro
        </button>
      </header>

      {books.length === 0 ? (
        <section className="empty-card">
          <span className="empty-icon">
            <Icon name="book" size={26} />
          </span>
          <h2>Aún no hay libros</h2>
          <p>
            Añade el primer libro con su título y total de páginas. Después podrás anotar cada día
            cuántas páginas has leído.
          </p>
          <button type="button" className="btn primary" onClick={() => setMode({ type: 'create' })}>
            <Icon name="plus" size={18} />
            Añadir libro
          </button>
        </section>
      ) : (
        <div className="book-grid">
          {stats.map((stat) => (
            <BookCard
              key={stat.book.id}
              stat={stat}
              onEdit={() => setMode({ type: 'edit', book: stat.book })}
              onDelete={() => setPendingDelete(stat.book)}
            />
          ))}
          <button
            type="button"
            className="add-book-tile"
            onClick={() => setMode({ type: 'create' })}
          >
            <span className="add-tile-icon">
              <Icon name="plus" size={22} />
            </span>
            <span className="add-tile-title">Añadir otro libro</span>
            <span className="add-tile-sub">Título y páginas totales</span>
          </button>
        </div>
      )}

      {mode ? (
        <BookForm
          book={mode.type === 'edit' ? mode.book : undefined}
          onClose={closeForm}
          onSubmit={mode.type === 'edit' ? handleUpdate : handleCreate}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Eliminar libro"
          message={`«${pendingDelete.title}» y sus registros dejarán de contar en tus estadísticas. Esta acción se sincroniza con el resto de dispositivos.`}
          confirmLabel="Eliminar libro"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteBook(pendingDelete.id);
            notify(`«${pendingDelete.title}» eliminado.`, 'info');
          }}
        />
      ) : null}
    </div>
  );
}

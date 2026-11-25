import { useState, type FormEvent } from 'react';
import { BOOK_COLORS, DEFAULT_BOOK_COLOR, type Book, type BookInput } from '../types';
import { Modal } from './Modal';

interface BookFormProps {
  book?: Book;
  onClose: () => void;
  onSubmit: (input: BookInput) => void;
}

export function BookForm({ book, onClose, onSubmit }: BookFormProps) {
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [pages, setPages] = useState(book ? String(book.totalPages) : '');
  const [color, setColor] = useState(book?.color ?? DEFAULT_BOOK_COLOR);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Escribe el título del libro.');
      return;
    }
    const totalPages = Number(pages);
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      setError('Indica un número de páginas mayor que cero.');
      return;
    }
    if (totalPages > 100_000) {
      setError('Ese número de páginas parece demasiado alto.');
      return;
    }
    onSubmit({
      title: cleanTitle,
      author: author.trim() || undefined,
      totalPages: Math.round(totalPages),
      color,
    });
    onClose();
  };

  return (
    <Modal
      title={book ? 'Editar libro' : 'Añadir libro'}
      description={
        book
          ? 'Los cambios se guardan al instante en este dispositivo.'
          : 'Solo necesitas el título y el total de páginas.'
      }
      onClose={onClose}
    >
      <form className="book-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Título</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="El nombre del viento"
            maxLength={200}
            autoComplete="off"
            required
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="label">Autor <span className="optional">(opcional)</span></span>
            <input
              className="input"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Patrick Rothfuss"
              maxLength={160}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="label">Páginas totales</span>
            <input
              className="input"
              type="number"
              min={1}
              max={100000}
              inputMode="numeric"
              value={pages}
              onChange={(event) => {
                setPages(event.target.value);
                setError(null);
              }}
              placeholder="320"
              required
            />
          </label>
        </div>

        <fieldset className="field swatch-field">
          <legend className="label">Color en tu estantería</legend>
          <div className="swatches">
            {BOOK_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`swatch${color === option ? ' is-selected' : ''}`}
                style={{ background: option }}
                onClick={() => setColor(option)}
                aria-label={`Color ${option}`}
                aria-pressed={color === option}
              />
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            {book ? 'Guardar cambios' : 'Añadir a mi biblioteca'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

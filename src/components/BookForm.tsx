import { useState, type FormEvent } from 'react';
import { BOOK_COLORS, DEFAULT_BOOK_COLOR, type Book, type BookInput } from '../types';
import { formatNumber } from '../lib/format';
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
  const [startPage, setStartPage] = useState(
    book?.startPage ? String(book.startPage) : '',
  );
  const [endPage, setEndPage] = useState(book?.endPage ? String(book.endPage) : '');
  const [color, setColor] = useState(book?.color ?? DEFAULT_BOOK_COLOR);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Escribe el título del libro.');
      return;
    }
    const cleanAuthor = author.trim();
    if (!cleanAuthor) {
      setError('Escribe el autor del libro.');
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

    const total = Math.round(totalPages);
    const start = startPage.trim() ? Number(startPage) : 1;
    const end = endPage.trim() ? Number(endPage) : total;

    if (!Number.isInteger(start) || start < 1) {
      setError('La primera página de lectura debe ser un número mayor que cero.');
      return;
    }
    if (!Number.isInteger(end) || end < 1) {
      setError('La última página de lectura debe ser un número mayor que cero.');
      return;
    }
    if (start > total || end > total) {
      setError('El rango de lectura no puede superar las páginas totales del libro.');
      return;
    }
    if (start > end) {
      setError('La primera página de lectura no puede ser posterior a la última.');
      return;
    }

    onSubmit({
      title: cleanTitle,
      author: cleanAuthor,
      totalPages: total,
      startPage: start > 1 ? start : undefined,
      endPage: end < total ? end : undefined,
      color,
    });
    onClose();
  };

  const totalNumber = Number(pages);
  const previewStart = startPage.trim() ? Number(startPage) : 1;
  const previewEnd = endPage.trim() ? Number(endPage) : totalNumber;
  const previewValid =
    Number.isInteger(totalNumber) &&
    totalNumber > 0 &&
    Number.isInteger(previewStart) &&
    Number.isInteger(previewEnd) &&
    previewStart >= 1 &&
    previewEnd >= previewStart &&
    previewEnd <= totalNumber;
  const rangePreview = previewValid
    ? previewStart === 1 && previewEnd === totalNumber
      ? `Contarán las ${formatNumber(totalNumber)} páginas del libro.`
      : `Contarán ${formatNumber(previewEnd - previewStart + 1)} de ${formatNumber(
          totalNumber,
        )} páginas (de la ${formatNumber(previewStart)} a la ${formatNumber(previewEnd)}).`
    : null;

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
            <span className="label">Autor</span>
            <input
              className="input"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Patrick Rothfuss"
              maxLength={160}
              autoComplete="off"
              required
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

        <fieldset className="field range-field">
          <legend className="label">
            Páginas que cuentan como lectura <span className="optional">(opcional)</span>
          </legend>
          <p className="hint">
            Úsalo para saltar prólogos, introducciones, notas, índices o apéndices.
          </p>
          <div className="range-grid">
            <label className="field">
              <span className="label">Desde la página</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100000}
                inputMode="numeric"
                placeholder="1"
                value={startPage}
                onChange={(event) => {
                  setStartPage(event.target.value);
                  setError(null);
                }}
              />
            </label>
            <label className="field">
              <span className="label">Hasta la página</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100000}
                inputMode="numeric"
                placeholder={pages || 'Última'}
                value={endPage}
                onChange={(event) => {
                  setEndPage(event.target.value);
                  setError(null);
                }}
              />
            </label>
          </div>
          {rangePreview ? <p className="range-preview">{rangePreview}</p> : null}
          {startPage || endPage ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setStartPage('');
                setEndPage('');
                setError(null);
              }}
            >
              Contar todo el libro
            </button>
          ) : null}
        </fieldset>

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

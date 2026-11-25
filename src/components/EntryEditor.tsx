import { useState } from 'react';
import type { Book, Entry } from '../types';
import { useApp } from '../state/store';
import { formatLongDate } from '../lib/date';
import { formatNumber, formatPercent } from '../lib/format';
import { Modal } from './Modal';

interface EntryEditorProps {
  entry: Entry;
  book: Book;
  onClose: () => void;
}

const ADJUSTMENTS = [-10, -5, 5, 10];

export function EntryEditor({ entry, book, onClose }: EntryEditorProps) {
  const { updateEntryPages, deleteEntry, notify } = useApp();
  const [value, setValue] = useState(String(entry.pages));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const adjust = (delta: number) => {
    const current = Number(value);
    const base = Number.isFinite(current) ? current : 0;
    setValue(String(Math.max(0, Math.round(base + delta))));
    setError(null);
  };

  const save = () => {
    const pages = Number(value);
    if (!Number.isFinite(pages) || pages < 0) {
      setError('Escribe un número de páginas válido.');
      return;
    }
    if (pages > 100000) {
      setError('Ese número de páginas parece demasiado alto.');
      return;
    }
    const rounded = Math.round(pages);
    updateEntryPages(entry.id, rounded);
    notify(
      rounded === 0 ? 'Registro eliminado.' : 'Páginas actualizadas.',
      rounded === 0 ? 'info' : 'success',
    );
    onClose();
  };

  const remove = () => {
    deleteEntry(entry.id);
    notify('Registro eliminado.', 'info');
    onClose();
  };

  const numericValue = Number(value);
  const previewValid = Number.isFinite(numericValue) && numericValue >= 0;

  return (
    <Modal
      title="Ajustar páginas"
      description={`${book.title} · ${formatLongDate(entry.date)}`}
      onClose={onClose}
    >
      <div className="entry-editor">
        <label className="field">
          <span className="label">Páginas leídas ese día</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
        </label>

        <div className="quick-adjust" role="group" aria-label="Ajustar cantidad">
          {ADJUSTMENTS.map((delta) => (
            <button
              key={delta}
              type="button"
              className="chip-btn"
              onClick={() => adjust(delta)}
            >
              {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
            </button>
          ))}
        </div>

        <p className="hint">
          {previewValid
            ? `${formatNumber(Math.round(numericValue))} páginas · ${formatPercent(
                (Math.round(numericValue) / book.totalPages) * 100,
              )} del libro.`
            : 'Escribe un número de páginas válido.'}{' '}
          Si el total queda en 0, el registro se elimina.
        </p>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="editor-footer">
          {confirmDelete ? (
            <div className="confirm-inline">
              <span>¿Eliminar este registro?</span>
              <button type="button" className="btn danger sm" onClick={remove}>
                Sí
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-btn danger-text"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar registro
            </button>
          )}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn primary" onClick={save}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

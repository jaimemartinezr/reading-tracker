import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../state/store';
import type { Entry } from '../types';
import type { Screen } from '../navigation';
import {
  activeBooks,
  activeEntries,
  bookStat,
  buildDayStat,
  lastNDays,
  libraryTotals,
  readingStreak,
} from '../lib/stats';
import { formatLongDate, formatShortDate, formatWeekday, todayISO } from '../lib/date';
import { formatNumber, formatPercent } from '../lib/format';
import { positionHint, positionLabel } from '../lib/position';
import { DateField } from '../components/DateField';
import { EntryEditor } from '../components/EntryEditor';
import { Icon } from '../components/Icon';

interface TodayScreenProps {
  onNavigate: (screen: Screen) => void;
  onAddBook: () => void;
}

const QUICK_AMOUNTS = [5, 10, 25];

export function TodayScreen({ onNavigate, onAddBook }: TodayScreenProps) {
  const { data, logPages, deleteEntry, notify } = useApp();
  const today = todayISO();

  const books = useMemo(() => activeBooks(data.books), [data.books]);
  const totals = useMemo(
    () => libraryTotals(data.books, data.entries, today),
    [data.books, data.entries, today],
  );
  const week = useMemo(
    () => lastNDays(7, data.books, data.entries, today),
    [data.books, data.entries, today],
  );
  const streak = useMemo(
    () => readingStreak(activeEntries(data.entries, data.books), today),
    [data.entries, data.books, today],
  );

  const [selectedBookId, setSelectedBookId] = useState('');
  const [date, setDate] = useState(today);
  const [dateValid, setDateValid] = useState(true);
  const [pages, setPages] = useState('');
  const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null);

  useEffect(() => {
    setSelectedBookId((previous) =>
      previous && books.some((book) => book.id === previous) ? previous : (books[0]?.id ?? ''),
    );
  }, [books]);

  const bookById = useMemo(
    () => new Map(data.books.map((book) => [book.id, book])),
    [data.books],
  );

  const selectedStat = useMemo(() => {
    const book = data.books.find((item) => item.id === selectedBookId && !item.deletedAt);
    return book ? bookStat(book, data.entries, today) : null;
  }, [selectedBookId, data.books, data.entries, today]);

  const dayStat = useMemo(
    () => buildDayStat(date, data.books, data.entries),
    [date, data.books, data.entries],
  );

  const dateEntries = useMemo(() => {
    const activeIds = new Set(books.map((book) => book.id));
    return data.entries
      .filter(
        (entry) => !entry.deletedAt && entry.date === date && activeIds.has(entry.bookId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [data.entries, books, date]);

  const editingBook = entryToEdit ? bookById.get(entryToEdit.bookId) ?? null : null;

  const weekMax = Math.max(1, ...week.map((day) => day.pages));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const book = bookById.get(selectedBookId);
    const amount = Number(pages);
    if (!book) {
      notify('Elige un libro antes de registrar páginas.', 'error');
      return;
    }
    if (!dateValid) {
      notify('La fecha no es válida. Usa el formato DD-MM-AAAA.', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Escribe cuántas páginas has leído (mayor que cero).', 'error');
      return;
    }
    logPages(book.id, date, amount);
    notify(
      `${formatNumber(Math.round(amount))} páginas de «${book.title}» ${
        date === today ? 'registradas para hoy' : `registradas el ${formatLongDate(date)}`
      }.`,
    );
    setPages('');
    setDate(today);
    setDateValid(true);
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <p className="eyebrow">{formatLongDate(today)}</p>
          <h1 className="page-title">Hoy</h1>
        </div>
        <button type="button" className="btn ghost sm hide-sm" onClick={() => onNavigate('progress')}>
          Ver progreso
          <Icon name="chevron" size={16} />
        </button>
      </header>

      <section className="hero">
        <div className="hero-main">
          <span className="hero-label">Páginas leídas hoy</span>
          <p className="hero-number">{formatNumber(totals.pagesToday)}</p>
          <p className="hero-sub">
            <strong>{formatPercent(totals.percentToday)}</strong> de tu biblioteca
            {totals.activeBooks > 0
              ? ` · ${totals.activeBooks} ${totals.activeBooks === 1 ? 'libro' : 'libros'} en curso`
              : ''}
          </p>
        </div>
        <div className="hero-side">
          <div className="hero-streak">
            <Icon name="flame" size={18} />
            <span>
              {streak} {streak === 1 ? 'día' : 'días'} de racha
            </span>
          </div>
          <div className="spark" aria-hidden="true">
            {week.map((day) => (
              <span
                key={day.date}
                className={day.pages > 0 ? 'is-active' : ''}
                style={{ height: `${Math.max(8, (day.pages / weekMax) * 100)}%` }}
                title={`${formatWeekday(day.date)}: ${day.pages} páginas`}
              />
            ))}
          </div>
          <p className="hero-footnote">Últimos 7 días</p>
        </div>
      </section>

      {books.length === 0 ? (
        <section className="empty-card">
          <span className="empty-icon">
            <Icon name="book" size={26} />
          </span>
          <h2>Tu estantería está vacía</h2>
          <p>
            Añade el libro que estás leyendo con su número de páginas y empieza a registrar tus
            días de lectura.
          </p>
          <button type="button" className="btn primary" onClick={onAddBook}>
            <Icon name="plus" size={18} />
            Añadir mi primer libro
          </button>
        </section>
      ) : (
        <>
          <section className="card composer">
            <div className="section-head">
              <h2>Registrar lectura</h2>
              <span className="muted">
                {selectedStat ? positionHint(selectedStat) : 'Se suma al total del día'}
              </span>
            </div>
            <form className="composer-form" onSubmit={handleSubmit}>
              <label className="field grow">
                <span className="label">Libro</span>
                <select
                  className="input"
                  value={selectedBookId}
                  onChange={(event) => setSelectedBookId(event.target.value)}
                >
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="reading-date">
                <span className="label">Fecha</span>
                <DateField
                  id="reading-date"
                  value={date}
                  max={today}
                  onChange={setDate}
                  onValidityChange={setDateValid}
                />
              </label>
              <div className="field pages-input">
                <label className="label" htmlFor="pages-to-log">
                  Páginas
                </label>
                <div className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label="Restar 5 páginas"
                    onClick={() => setPages(String(Math.max(0, (Number(pages) || 0) - 5)))}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <input
                    id="pages-to-log"
                    className="input stepper-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    placeholder="0"
                    value={pages}
                    onChange={(event) => setPages(event.target.value)}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label="Sumar 5 páginas"
                    onClick={() => setPages(String((Number(pages) || 0) + 5))}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
              <div className="quick-add" role="group" aria-label="Añadir cantidad rápida">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="chip-btn"
                    onClick={() => setPages(String((Number(pages) || 0) + amount))}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              <button type="submit" className="btn primary submit-btn">
                Registrar
              </button>
            </form>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>{date === today ? 'Registros de hoy' : 'Registros del día'}</h2>
              <span className="muted">
                {date === today ? '' : `${formatShortDate(date)} · `}
                {formatNumber(dayStat.pages)} páginas
              </span>
            </div>
            {dateEntries.length === 0 ? (
              <p className="empty-line">
                {date === today
                  ? 'Aún no has registrado páginas hoy. Cuando lo hagas, aparecerán aquí.'
                  : 'No hay registros para esta fecha.'}
              </p>
            ) : (
              <ul className="entry-list">
                {dateEntries.map((entry) => {
                  const book = bookById.get(entry.bookId);
                  if (!book) return null;
                  return (
                    <li className="entry" key={entry.id}>
                      <span className="entry-dot" style={{ background: book.color }} />
                      <div className="entry-body">
                        <span className="entry-title">{book.title}</span>
                        <span className="entry-meta">
                          {formatNumber(entry.pages)} págs ·{' '}
                          {formatPercent((entry.pages / book.totalPages) * 100)} del libro
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-btn entry-adjust"
                        onClick={() => setEntryToEdit(entry)}
                        aria-label={`Ajustar páginas de ${book.title}`}
                        title="Ajustar o restar páginas"
                      >
                        <Icon name="edit" size={14} />
                        Ajustar
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Quitar el registro de ${book.title}`}
                        title="Quitar registro"
                        onClick={() => {
                          deleteEntry(entry.id);
                          notify(`Registro de «${book.title}» eliminado.`, 'info');
                        }}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="section-head">
              <h2>En curso</h2>
              <button
                type="button"
                className="text-btn"
                onClick={() => onNavigate('books')}
              >
                Toda la biblioteca
                <Icon name="chevron" size={15} />
              </button>
            </div>
            <div className="book-mini-grid">
              {books.map((book) => {
                const stat = bookStat(book, data.entries, today);
                return (
                  <article
                    className="book-mini"
                    key={book.id}
                    style={{ ['--book-color' as string]: book.color }}
                  >
                    <div className="mini-head">
                      <span className="book-swatch" aria-hidden="true" />
                      <h3 title={book.title}>{book.title}</h3>
                      <span className="mini-percent">{formatPercent(stat.percent)}</span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.max(stat.percent, stat.pagesRead > 0 ? 2 : 0)}%`,
                        }}
                      />
                    </div>
                    <p className="mini-meta">
                      {positionLabel(stat)} ·{' '}
                      {stat.pagesToday > 0
                        ? `+${formatNumber(stat.pagesToday)} hoy`
                        : 'sin páginas hoy'}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {entryToEdit && editingBook ? (
        <EntryEditor
          entry={entryToEdit}
          book={editingBook}
          onClose={() => setEntryToEdit(null)}
        />
      ) : null}
    </div>
  );
}

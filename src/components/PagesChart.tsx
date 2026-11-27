import { useEffect, useMemo, useState } from 'react';
import type { Book } from '../types';
import type { DayStat } from '../lib/stats';
import { formatShortDate, formatWeekday } from '../lib/date';
import { formatNumber, formatPercent } from '../lib/format';
import { Icon } from './Icon';

interface PagesChartProps {
  days: DayStat[];
  books: Book[];
}

interface Selection {
  date: string;
  bookId: string;
}

export function PagesChart({ days, books }: PagesChartProps) {
  const [selected, setSelected] = useState<Selection | null>(null);

  const bookById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const max = Math.max(10, ...days.map((day) => day.pages));
  const total = days.reduce((sum, day) => sum + day.pages, 0);
  const compact = days.length > 14;
  const labelEvery = compact ? 5 : 1;

  const chartBooks = useMemo(
    () => books.filter((book) => days.some((day) => (day.perBook[book.id] ?? 0) > 0)),
    [books, days],
  );

  useEffect(() => {
    if (!selected) return;
    const day = days.find((item) => item.date === selected.date);
    if (!day || !day.perBook[selected.bookId]) setSelected(null);
  }, [days, selected]);

  const selectedDay = selected
    ? (days.find((day) => day.date === selected.date) ?? null)
    : null;
  const selectedBook = selected ? (bookById.get(selected.bookId) ?? null) : null;
  const selectedPages =
    selectedDay && selected ? (selectedDay.perBook[selected.bookId] ?? 0) : 0;
  const selectedPercent =
    selectedDay && selectedDay.pages > 0 ? (selectedPages / selectedDay.pages) * 100 : 0;

  const toggle = (date: string, bookId: string) => {
    setSelected((previous) =>
      previous && previous.date === date && previous.bookId === bookId
        ? null
        : { date, bookId },
    );
  };

  return (
    <div className="chart">
      <div className="chart-header">
        <span className="chart-scale">Máx. {formatNumber(max)} págs</span>
        <span className="chart-total">{formatNumber(total)} páginas en total</span>
      </div>

      {chartBooks.length > 0 ? (
        <div className="chart-legend" aria-label="Libros representados en el gráfico">
          {chartBooks.map((book) => (
            <span className="chart-legend-item" key={book.id}>
              <span className="chart-legend-dot" style={{ background: book.color }} />
              {book.title}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="chart-plot"
        role="group"
        aria-label="Páginas por día divididas por libro. Cada segmento de color indica un libro."
      >
        <div className="chart-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="chart-bars">
          {days.map((day) => (
            <div
              className="chart-col"
              key={day.date}
              title={`${formatShortDate(day.date)}: ${formatNumber(day.pages)} páginas`}
            >
              {day.pages === 0 ? (
                <div className="chart-bar is-empty" style={{ height: '2px' }} />
              ) : (
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(4, (day.pages / max) * 100)}%` }}
                >
                  {books.map((book) => {
                    const pages = day.perBook[book.id] ?? 0;
                    if (pages <= 0) return null;
                    const isSelected =
                      selected?.date === day.date && selected.bookId === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        className={`chart-segment${isSelected ? ' is-selected' : ''}`}
                        style={{ flexGrow: pages, background: book.color }}
                        onClick={() => toggle(day.date, book.id)}
                        aria-pressed={isSelected}
                        aria-label={`${book.title}: ${formatNumber(pages)} páginas el ${formatShortDate(
                          day.date,
                        )}`}
                        title={`${book.title}: ${formatNumber(pages)} páginas`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chart-labels" aria-hidden="true">
        {days.map((day, index) => (
          <div className="chart-label" key={day.date}>
            {index % labelEvery === 0 || index === days.length - 1 ? (
              <>
                <span className="chart-label-day">
                  {compact ? String(Number(day.date.slice(8))) : formatShortDate(day.date)}
                </span>
                {compact ? null : (
                  <span className="chart-label-weekday">{formatWeekday(day.date)}</span>
                )}
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="chart-selection" aria-live="polite">
        {selected && selectedBook && selectedDay ? (
          <>
            <span className="chart-legend-dot" style={{ background: selectedBook.color }} />
            <strong>{selectedBook.title}</strong>
            <span>
              {formatNumber(selectedPages)} págs · {formatPercent(selectedPercent)} del día ·{' '}
              {formatShortDate(selected.date)}
            </span>
            <button
              type="button"
              className="chart-selection-clear"
              onClick={() => setSelected(null)}
              aria-label="Cerrar detalle del libro"
            >
              <Icon name="close" size={13} />
            </button>
          </>
        ) : (
          <span className="chart-hint">
            Toca un segmento de la barra para ver a qué libro corresponde.
          </span>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { activeBooks, bestDay, bookStat, monthDayStats } from '../lib/stats';
import { formatShortDate, formatWeekday, todayISO } from '../lib/date';
import { formatNumber, formatPages, formatPercent } from '../lib/format';
import { PagesChart } from '../components/PagesChart';
import { Icon } from '../components/Icon';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function ProgressScreen() {
  const { data } = useApp();
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = todayISO();

  const [period, setPeriod] = useState(() => ({
    year: currentYear,
    month: currentMonth,
  }));

  const books = useMemo(() => activeBooks(data.books), [data.books]);
  const days = useMemo(
    () => monthDayStats(period.year, period.month, data.books, data.entries, today),
    [period, data.books, data.entries, today],
  );

  const bookById = useMemo(
    () => new Map(data.books.map((book) => [book.id, book])),
    [data.books],
  );

  const minYear = useMemo(() => {
    let oldest = currentYear;
    for (const entry of data.entries) {
      if (entry.deletedAt) continue;
      const year = Number(entry.date.slice(0, 4));
      if (Number.isFinite(year) && year < oldest) oldest = year;
    }
    for (const book of data.books) {
      const year = new Date(book.createdAt).getFullYear();
      if (Number.isFinite(year) && year < oldest) oldest = year;
    }
    return Math.min(oldest, currentYear - 3);
  }, [data.entries, data.books, currentYear]);

  const yearOptions = useMemo(() => {
    const from = Math.min(minYear, period.year);
    return Array.from({ length: currentYear - from + 1 }, (_, index) => currentYear - index);
  }, [minYear, period.year, currentYear]);

  const periodLabel = `${MONTHS[period.month]} de ${period.year}`;
  const canGoNext =
    period.year < currentYear ||
    (period.year === currentYear && period.month < currentMonth);

  const changeMonth = (month: number) => {
    if (period.year === currentYear && month > currentMonth) return;
    setPeriod({ ...period, month });
  };

  const changeYear = (year: number) => {
    const month =
      year === currentYear ? Math.min(period.month, currentMonth) : period.month;
    setPeriod({ year, month });
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(period.year, period.month + delta, 1);
    const year = next.getFullYear();
    const month = next.getMonth();
    if (year < 1900) return;
    if (year > currentYear || (year === currentYear && month > currentMonth)) return;
    setPeriod({ year, month });
  };

  const totalPages = days.reduce((sum, day) => sum + day.pages, 0);
  const libraryPages = books.reduce((sum, book) => sum + book.totalPages, 0);
  const activeDays = days.filter((day) => day.pages > 0).length;
  const average = days.length > 0 ? totalPages / days.length : 0;
  const best = bestDay(days);
  const recentDays = [...days].reverse().filter((day) => day.pages > 0);

  const monthPrefix = `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
  const monthEntries = data.entries.filter(
    (entry) => !entry.deletedAt && entry.date.startsWith(monthPrefix),
  );

  const bookRows = books
    .map((book) => {
      const pages = monthEntries
        .filter((entry) => entry.bookId === book.id)
        .reduce((sum, entry) => sum + entry.pages, 0);
      const allTime = bookStat(book, data.entries);
      return {
        book,
        pages,
        percentMonth: book.totalPages > 0 ? Math.min(100, (pages / book.totalPages) * 100) : 0,
        accumulated: allTime.percent,
      };
    })
    .sort((a, b) => b.pages - a.pages || b.accumulated - a.accumulated);

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <p className="eyebrow">{periodLabel}</p>
          <h1 className="page-title">Progreso</h1>
        </div>
        <div className="month-nav" role="group" aria-label="Elegir mes y año">
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
            title="Mes anterior"
          >
            <Icon name="chevron" size={17} className="flip" />
          </button>
          <select
            className="month-select"
            aria-label="Mes"
            value={period.month}
            onChange={(event) => changeMonth(Number(event.target.value))}
          >
            {MONTHS.map((name, index) => (
              <option
                key={name}
                value={index}
                disabled={period.year === currentYear && index > currentMonth}
              >
                {name}
              </option>
            ))}
          </select>
          <select
            className="year-select"
            aria-label="Año"
            value={period.year}
            onChange={(event) => changeYear(Number(event.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
            title="Mes siguiente"
            disabled={!canGoNext}
          >
            <Icon name="chevron" size={17} />
          </button>
        </div>
      </header>

      {books.length === 0 ? (
        <section className="empty-card">
          <span className="empty-icon">
            <Icon name="chart" size={26} />
          </span>
          <h2>Sin datos todavía</h2>
          <p>
            Cuando registres tus primeras páginas verás aquí el avance diario, tu media y el
            porcentaje leído de cada libro.
          </p>
        </section>
      ) : (
        <>
          <section className="stats-row">
            <article className="stat-card accent">
              <span className="stat-label">Páginas en el mes</span>
              <strong className="stat-value">{formatNumber(totalPages)}</strong>
              <span className="stat-hint">
                {formatPercent(libraryPages > 0 ? (totalPages / libraryPages) * 100 : 0)} de tu
                biblioteca
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Media diaria</span>
              <strong className="stat-value">{formatNumber(average, 1)}</strong>
              <span className="stat-hint">páginas por día</span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Mejor día</span>
              <strong className="stat-value">{best ? formatNumber(best.pages) : '—'}</strong>
              <span className="stat-hint">
                {best
                  ? `${formatWeekday(best.date)} ${formatShortDate(best.date)}`
                  : 'Aún sin registros'}
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Días con lectura</span>
              <strong className="stat-value">{activeDays}</strong>
              <span className="stat-hint">de {days.length} días</span>
            </article>
          </section>

          <section className="card chart-card">
            <div className="section-head">
              <h2>Páginas por día</h2>
              <span className="muted">{periodLabel}</span>
            </div>
            {totalPages > 0 ? (
              <PagesChart days={days} />
            ) : (
              <p className="empty-line">No hay páginas registradas en este mes.</p>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Avance por libro</h2>
              <span className="muted">Este mes · acumulado</span>
            </div>
            <ul className="per-book-list">
              {bookRows.map((row) => (
                <li key={row.book.id} className="per-book">
                  <div className="per-book-head">
                    <span className="entry-dot" style={{ background: row.book.color }} />
                    <span className="per-book-title">{row.book.title}</span>
                    <span className="per-book-percent">{formatPercent(row.percentMonth)}</span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(row.percentMonth)}
                    aria-label={`${row.book.title}: ${formatPercent(row.percentMonth)} leído este mes`}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(row.percentMonth, row.pages > 0 ? 2 : 0)}%`,
                        background: row.book.color,
                      }}
                    />
                  </div>
                  <p className="per-book-meta">
                    {formatNumber(row.pages)} de {formatNumber(row.book.totalPages)} páginas este
                    mes · {formatPercent(row.accumulated)} acumulado
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Detalle por día</h2>
              <span className="muted">Días con lectura</span>
            </div>
            {recentDays.length === 0 ? (
              <p className="empty-line">No hay registros en {periodLabel.toLowerCase()}.</p>
            ) : (
              <ul className="day-list">
                {recentDays.map((day) => (
                  <li className="day-row" key={day.date}>
                    <div className="day-date">
                      <strong>{formatShortDate(day.date)}</strong>
                      <span>{formatWeekday(day.date)}</span>
                    </div>
                    <div className="day-body">
                      <p className="day-summary">
                        <strong>{formatPages(day.pages)}</strong>
                        <span className="muted">
                          {formatPercent(day.libraryPercent)} de tu biblioteca
                        </span>
                      </p>
                      <div className="chips">
                        {Object.entries(day.perBook).map(([bookId, pages]) => {
                          const book = bookById.get(bookId);
                          if (!book) return null;
                          return (
                            <span className="chip" key={bookId}>
                              <span className="chip-dot" style={{ background: book.color }} />
                              {book.title} · {formatNumber(pages)} págs (
                              {formatPercent((pages / book.totalPages) * 100)})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

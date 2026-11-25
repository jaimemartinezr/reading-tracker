import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { activeBooks, bestDay, bookStat, lastNDays } from '../lib/stats';
import { formatShortDate, formatWeekday } from '../lib/date';
import { formatNumber, formatPages, formatPercent } from '../lib/format';
import { PagesChart } from '../components/PagesChart';
import { Icon } from '../components/Icon';

type Range = 7 | 30;

export function ProgressScreen() {
  const { data } = useApp();
  const [range, setRange] = useState<Range>(7);

  const books = useMemo(() => activeBooks(data.books), [data.books]);
  const days = useMemo(
    () => lastNDays(range, data.books, data.entries),
    [range, data.books, data.entries],
  );
  const bookById = useMemo(
    () => new Map(data.books.map((book) => [book.id, book])),
    [data.books],
  );

  const totalPages = days.reduce((sum, day) => sum + day.pages, 0);
  const activeDays = days.filter((day) => day.pages > 0).length;
  const average = totalPages / range;
  const best = bestDay(days);
  const recentDays = [...days].reverse().filter((day) => day.pages > 0).slice(0, 14);
  const bookStats = books
    .map((book) => bookStat(book, data.entries))
    .sort((a, b) => b.percent - a.percent);

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <p className="eyebrow">Últimos {range} días</p>
          <h1 className="page-title">Progreso</h1>
        </div>
        <div className="segmented" role="group" aria-label="Periodo">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={range === option ? 'is-active' : ''}
              aria-pressed={range === option}
              onClick={() => setRange(option as Range)}
            >
              {option} días
            </button>
          ))}
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
              <span className="stat-label">Páginas en el periodo</span>
              <strong className="stat-value">{formatNumber(totalPages)}</strong>
              <span className="stat-hint">{formatPercent((totalPages / Math.max(1, books.reduce((sum, book) => sum + book.totalPages, 0))) * 100)} de tu biblioteca</span>
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
                {best ? `${formatWeekday(best.date)} ${formatShortDate(best.date)}` : 'Aún sin registros'}
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Días con lectura</span>
              <strong className="stat-value">{activeDays}</strong>
              <span className="stat-hint">de {range} días</span>
            </article>
          </section>

          <section className="card chart-card">
            <div className="section-head">
              <h2>Páginas por día</h2>
              <span className="muted">Meta diaria: tu constancia</span>
            </div>
            <PagesChart days={days} />
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Avance por libro</h2>
              <span className="muted">Porcentaje acumulado</span>
            </div>
            <ul className="per-book-list">
              {bookStats.map((stat) => (
                <li key={stat.book.id} className="per-book">
                  <div className="per-book-head">
                    <span className="entry-dot" style={{ background: stat.book.color }} />
                    <span className="per-book-title">{stat.book.title}</span>
                    <span className="per-book-percent">{formatPercent(stat.percent)}</span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(stat.percent)}
                    aria-label={`${stat.book.title}: ${formatPercent(stat.percent)} leído`}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(stat.percent, stat.pagesRead > 0 ? 2 : 0)}%`,
                        background: stat.book.color,
                      }}
                    />
                  </div>
                  <p className="per-book-meta">
                    {formatNumber(stat.pagesRead)} de {formatNumber(stat.book.totalPages)} páginas
                    {stat.pagesToday > 0 ? ` · +${formatNumber(stat.pagesToday)} hoy` : ''}
                    {stat.estimatedFinish && stat.remainingPages > 0
                      ? ` · fin estimado ${formatShortDate(stat.estimatedFinish)}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Detalle por día</h2>
              <span className="muted">Últimos días con lectura</span>
            </div>
            {recentDays.length === 0 ? (
              <p className="empty-line">Todavía no hay registros en este periodo.</p>
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
                        <span className="muted">{formatPercent(day.libraryPercent)} de tu biblioteca</span>
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

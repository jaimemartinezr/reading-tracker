import type { BookStat } from '../lib/stats';
import { formatNumber, formatPercent } from '../lib/format';
import { formatShortDate } from '../lib/date';
import { positionLabel } from '../lib/position';
import { Icon } from './Icon';

interface ProgressRingProps {
  percent: number;
  color: string;
}

function ProgressRing({ percent, color }: ProgressRingProps) {
  const size = 76;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg
      className="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(percent)} por ciento leído`}
    >
      <circle
        className="ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
      />
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        stroke={color}
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" className="ring-label" textAnchor="middle" dominantBaseline="central">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

interface BookCardProps {
  stat: BookStat;
  onEdit: () => void;
  onDelete: () => void;
}

export function BookCard({ stat, onEdit, onDelete }: BookCardProps) {
  const { book } = stat;
  const percentLabel = formatPercent(stat.percent);

  return (
    <article className="book-card" style={{ ['--book-color' as string]: book.color }}>
      <header className="book-card-top">
        <div className="book-heading">
          <span className="book-swatch" aria-hidden="true" />
          <div>
            <h3 className="book-title" title={book.title}>
              {book.title}
            </h3>
            <p className="book-author">{book.author ?? 'Sin autor'}</p>
          </div>
        </div>
        <ProgressRing percent={stat.percent} color={book.color} />
      </header>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(stat.percent)}
        aria-label={`${book.title}: ${percentLabel} leído`}
      >
        <div
          className="progress-fill"
          style={{ width: `${Math.max(stat.percent, stat.pagesRead > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="book-progress-meta">
        <span>
          <strong>{positionLabel(stat)}</strong>
          {stat.pagesRead <= 0 || stat.remainingPages <= 0
            ? ` · ${formatNumber(book.totalPages)} páginas`
            : null}
        </span>
        <span>{percentLabel} leído</span>
      </p>

      <dl className="book-facts">
        <div>
          <dt>Restan</dt>
          <dd>{stat.remainingPages === 0 ? 'Terminado' : `${formatNumber(stat.remainingPages)} págs`}</dd>
        </div>
        <div>
          <dt>Ritmo</dt>
          <dd>{stat.pace > 0 ? `${formatNumber(stat.pace, 1)} págs/día` : '—'}</dd>
        </div>
        <div>
          <dt>Fin estimado</dt>
          <dd>
            {stat.estimatedFinish
              ? formatShortDate(stat.estimatedFinish)
              : stat.remainingPages === 0
                ? 'Completado'
                : '—'}
          </dd>
        </div>
      </dl>

      <footer className="book-card-actions">
        <button type="button" className="btn ghost sm" onClick={onEdit}>
          <Icon name="edit" size={16} />
          Editar
        </button>
        <button
          type="button"
          className="icon-btn danger"
          onClick={onDelete}
          aria-label={`Eliminar ${book.title}`}
          title="Eliminar libro"
        >
          <Icon name="trash" size={17} />
        </button>
      </footer>
    </article>
  );
}

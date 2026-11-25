import type { DayStat } from '../lib/stats';
import { formatShortDate, formatWeekday } from '../lib/date';
import { formatNumber } from '../lib/format';

interface PagesChartProps {
  days: DayStat[];
}

export function PagesChart({ days }: PagesChartProps) {
  const max = Math.max(10, ...days.map((day) => day.pages));
  const total = days.reduce((sum, day) => sum + day.pages, 0);
  const compact = days.length > 14;
  const labelEvery = compact ? 5 : 1;

  return (
    <div className="chart">
      <div className="chart-header">
        <span className="chart-scale">Máx. {formatNumber(max)} págs</span>
        <span className="chart-total">{formatNumber(total)} páginas en total</span>
      </div>
      <div
        className="chart-plot"
        role="img"
        aria-label={`Gráfico de páginas leídas por día: ${days
          .filter((day) => day.pages > 0)
          .map((day) => `${formatShortDate(day.date)}: ${day.pages}`)
          .join(', ')}`}
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
              <div
                className={`chart-bar${day.pages === 0 ? ' is-empty' : ''}`}
                style={{
                  height: day.pages === 0 ? '2px' : `${Math.max(4, (day.pages / max) * 100)}%`,
                }}
              >
                {day.pages > 0 ? (
                  <span className="chart-tooltip">{formatNumber(day.pages)}</span>
                ) : null}
              </div>
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
    </div>
  );
}

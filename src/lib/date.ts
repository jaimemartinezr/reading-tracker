/** Utilidades de fecha basadas en el calendario local del dispositivo. */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(iso: string, amount: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

/** Días completos entre dos fechas ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

const LONG_FORMAT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const SHORT_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' });

export function formatLongDate(iso: string): string {
  return LONG_FORMAT.format(parseISODate(iso));
}

export function formatShortDate(iso: string): string {
  return SHORT_FORMAT.format(parseISODate(iso)).replace('.', '');
}

export function formatWeekday(iso: string): string {
  return WEEKDAY_FORMAT.format(parseISODate(iso));
}

export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value);
}

export function formatPages(pages: number): string {
  return `${formatNumber(pages)} ${pages === 1 ? 'página' : 'páginas'}`;
}

/** Formatea un porcentaje con un decimal cuando es necesario. */
export function formatPercent(value: number, maximumFractionDigits = 1): string {
  const rounded = Number(value.toFixed(maximumFractionDigits));
  const text = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits,
  }).format(rounded);
  return `${text}\u00a0%`;
}

export function formatCompactPercent(value: number): string {
  if (value > 0 && value < 0.1) return '<0,1\u00a0%';
  return formatPercent(value);
}

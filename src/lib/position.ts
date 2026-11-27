import type { BookStat } from './stats';
import { formatNumber } from './format';

/** Etiqueta compacta: «Página 139 de 640», «Sin empezar» o «Terminado». */
export function positionLabel(stat: BookStat): string {
  if (stat.pagesRead <= 0) return 'Sin empezar';
  if (stat.remainingPages <= 0) return 'Terminado';
  return `Página ${formatNumber(stat.currentPage)} de ${formatNumber(stat.endPage)}`;
}

/** Texto contextual para el compositor de lectura. */
export function positionHint(stat: BookStat): string {
  if (stat.pagesRead <= 0) {
    if (stat.startPage > 1) {
      return `Sin empezar · empieza en la página ${formatNumber(stat.startPage)}`;
    }
    return `Sin empezar · ${formatNumber(stat.readingPages)} páginas`;
  }
  if (stat.remainingPages <= 0) return 'Libro terminado';
  return `Vas por la página ${formatNumber(stat.currentPage)} de ${formatNumber(stat.endPage)}`;
}

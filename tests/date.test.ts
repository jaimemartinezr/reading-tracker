import { describe, expect, it } from 'vitest';
import { formatNumericDate, parseNumericDate } from '../src/lib/date';

describe('formatNumericDate', () => {
  it('convierte ISO a DD-MM-YYYY', () => {
    expect(formatNumericDate('2026-11-25')).toBe('25-11-2026');
    expect(formatNumericDate('2026-01-02')).toBe('02-01-2026');
  });
});

describe('parseNumericDate', () => {
  it('acepta DD-MM-YYYY', () => {
    expect(parseNumericDate('25-11-2026')).toBe('2026-11-25');
  });

  it('acepta barras, puntos y dígitos seguidos', () => {
    expect(parseNumericDate('25/11/2026')).toBe('2026-11-25');
    expect(parseNumericDate('25.11.2026')).toBe('2026-11-25');
    expect(parseNumericDate('25112026')).toBe('2026-11-25');
  });

  it('acepta el formato ISO como entrada', () => {
    expect(parseNumericDate('2026-11-25')).toBe('2026-11-25');
  });

  it('rechaza fechas inexistentes', () => {
    expect(parseNumericDate('31-02-2026')).toBeNull();
    expect(parseNumericDate('32-01-2026')).toBeNull();
    expect(parseNumericDate('25-13-2026')).toBeNull();
    expect(parseNumericDate('29-02-2025')).toBeNull();
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(parseNumericDate('29-02-2028')).toBe('2028-02-29');
  });

  it('rechaza entradas incompletas o con letras', () => {
    expect(parseNumericDate('')).toBeNull();
    expect(parseNumericDate('25-11')).toBeNull();
    expect(parseNumericDate('hoy')).toBeNull();
    expect(parseNumericDate('25-11-26')).toBeNull();
  });
});

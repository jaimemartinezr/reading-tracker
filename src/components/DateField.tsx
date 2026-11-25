import { useEffect, useId, useRef, useState } from 'react';
import { formatNumericDate, parseNumericDate } from '../lib/date';
import { Icon } from './Icon';

interface DateFieldProps {
  value: string;
  max?: string;
  onChange: (iso: string) => void;
  onValidityChange?: (valid: boolean) => void;
  id?: string;
}

/**
 * Campo de fecha con formato DD-MM-AAAA independiente del idioma del navegador.
 * Mantiene un input nativo oculto para abrir el calendario del sistema.
 */
export function DateField({
  value,
  max,
  onChange,
  onValidityChange,
  id,
}: DateFieldProps) {
  const errorId = useId();
  const nativeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef('');
  const [text, setText] = useState(() => formatNumericDate(value));
  const [error, setError] = useState<string | null>(null);

  textRef.current = text;

  // Si el valor cambia desde fuera (por ejemplo, al guardar), sincroniza el texto.
  useEffect(() => {
    if (parseNumericDate(textRef.current) !== value) {
      setText(formatNumericDate(value));
      setError(null);
    }
  }, [value]);

  const validate = (raw: string): string | null => {
    const iso = parseNumericDate(raw);
    if (!iso) return 'Escribe una fecha válida con el formato DD-MM-AAAA.';
    if (max && iso > max) return 'La fecha no puede ser posterior a hoy.';
    return null;
  };

  const handleTextChange = (raw: string) => {
    setText(raw);
    const message = validate(raw);
    if (!message) {
      const iso = parseNumericDate(raw);
      if (iso) {
        // Al escribir 25112026 lo mostramos ya como 25-11-2026.
        if (/^\d{8}$/.test(raw.trim())) setText(formatNumericDate(iso));
        onChange(iso);
      }
      setError(null);
      onValidityChange?.(true);
    } else {
      setError(raw.trim().length >= 8 ? message : null);
      onValidityChange?.(false);
    }
  };

  const handleBlur = () => {
    const message = validate(text);
    setError(message);
    onValidityChange?.(
      !message,
    );
    if (!message) {
      const iso = parseNumericDate(text);
      if (iso) setText(formatNumericDate(iso));
    }
  };

  const openPicker = () => {
    const input = nativeRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.focus();
    } catch {
      input.focus();
    }
  };

  return (
    <div className={`date-field${error ? ' is-invalid' : ''}`}>
      <input
        id={id}
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-AAAA"
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        onBlur={handleBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        maxLength={10}
      />
      <span className="date-icon" aria-hidden="true">
        <Icon name="calendar" size={17} />
      </span>
      <input
        ref={nativeRef}
        className="date-native"
        type="date"
        tabIndex={-1}
        aria-label="Elegir fecha en el calendario"
        value={value}
        max={max}
        onClick={openPicker}
        onChange={(event) => {
          const iso = event.target.value;
          if (!iso) return;
          setText(formatNumericDate(iso));
          setError(null);
          onValidityChange?.(true);
          onChange(iso);
        }}
      />
      {error ? (
        <p className="date-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

import { useEffect, useId, useState } from 'react';
import { clamp, roundTo } from '../lib/limits';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function format(value: number): string {
  return String(roundTo(value, 2));
}

/** Input numérico + slider sincronizados, con validación y clamp al rango. */
export function NumberField({ label, value, min, max, step, unit, disabled = false, onChange }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(format(value));

  useEffect(() => {
    setDraft((d) => (Number(d) === value && d.trim() !== '' ? d : format(value)));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) {
      setDraft(format(value));
      return;
    }
    const c = clamp(n, min, max);
    setDraft(format(c));
    if (c !== value) onChange(c);
  };

  const outOfRange = (() => {
    const n = Number(draft);
    return draft.trim() !== '' && Number.isFinite(n) && (n < min || n > max);
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="flex-1 text-xs text-slate-300">
          {label}
        </label>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={`field-input num w-24 text-right ${outOfRange ? 'border-lab-warn' : ''}`}
          value={draft}
          min={min}
          max={max}
          step="any"
          disabled={disabled}
          aria-invalid={outOfRange}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw);
            if (raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value);
          }}
        />
        <span className="num w-6 text-[11px] text-slate-500">{unit}</span>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer disabled:cursor-not-allowed"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        disabled={disabled}
        aria-label={`${label} (deslizador)`}
        aria-valuetext={`${format(value)} ${unit}`}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
      />
    </div>
  );
}

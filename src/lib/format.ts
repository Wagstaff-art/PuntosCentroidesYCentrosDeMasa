/** Número con `d` decimales fijos; evita "-0.00" y muestra "—" si no es finito. */
export function fmtFixed(value: number, d = 2): string {
  if (!Number.isFinite(value)) return '—';
  const s = value.toFixed(d);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/** Número con hasta `d` decimales, sin ceros finales. */
export function fmtTrim(value: number, d = 4): string {
  const s = fmtFixed(value, d);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Envuelve entre paréntesis los negativos para sustituir en fórmulas TeX. */
export function texNum(s: string): string {
  return s.startsWith('-') ? `(${s})` : s;
}

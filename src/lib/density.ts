/** Estilo de relleno de un bloque según su densidad relativa. */
export interface DensityShade {
  /** Opacidad del relleno cian, de 0.25 (ρmin) a 0.95 (ρmax). */
  opacity: number;
  /** Separación del rayado diagonal en px (menor = más denso); null si no hay rayado. */
  hatchSpacing: number | null;
  /** Densidad normalizada (ρ − ρmin)/(ρmax − ρmin) en [0, 1]. */
  t: number;
}

const HATCH_SPARSE = 18;
const HATCH_DENSE = 4;

/**
 * Normaliza la densidad y la traduce a opacidad y rayado.
 * Si todas las densidades son iguales: opacidad 0.6 y sin rayado.
 */
export function densityShade(rho: number, range: { min: number; max: number } | null): DensityShade {
  if (!range || range.max - range.min < 1e-12) return { opacity: 0.6, hatchSpacing: null, t: 0.5 };
  const t = Math.min(1, Math.max(0, (rho - range.min) / (range.max - range.min)));
  return { opacity: 0.25 + 0.7 * t, hatchSpacing: HATCH_SPARSE - (HATCH_SPARSE - HATCH_DENSE) * t, t };
}

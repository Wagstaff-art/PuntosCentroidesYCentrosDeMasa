import type { ShapeField } from '../types';

export interface FieldLimit {
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
}

/** Rangos válidos de cada magnitud numérica editable de una figura. */
export const SHAPE_LIMITS: Readonly<Record<ShapeField, FieldLimit>> = {
  b: { min: 1, max: 200, step: 1, unit: 'cm', label: 'Base b' },
  h: { min: 1, max: 200, step: 1, unit: 'cm', label: 'Altura h' },
  a: { min: 1, max: 200, step: 1, unit: 'cm', label: 'Base superior a' },
  apex: { min: 0, max: 1, step: 0.05, unit: '', label: 'Vértice (apex)' },
  offset: { min: -200, max: 200, step: 1, unit: 'cm', label: 'Desfase' },
  r: { min: 0.5, max: 100, step: 0.5, unit: 'cm', label: 'Radio r' },
  m: { min: 0.1, max: 500, step: 0.1, unit: 'kg', label: 'Masa m' },
  x: { min: -300, max: 300, step: 1, unit: 'cm', label: 'Posición x' },
  y: { min: -300, max: 300, step: 1, unit: 'cm', label: 'Posición y' },
};

/** Rango válido de la posición horizontal de los apoyos. */
export const SUPPORT_LIMIT: Readonly<FieldLimit> = {
  min: -300,
  max: 300,
  step: 1,
  unit: 'cm',
  label: 'Posición x',
};

/** Límites del intervalo [a, b] de una región de ecuación. */
export const EQUATION_INTERVAL = { min: -300, max: 300, maxWidth: 400 } as const;

/** Límites de los vértices de un polígono libre (coords locales tras normalizar). */
export const POLYGON_LIMITS = { coordMax: 400, minVertices: 3, maxVertices: 40 } as const;

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 8;

/** Limita `value` al intervalo [min, max]. Valores no finitos devuelven `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Redondea a un número fijo de decimales eliminando ruido de coma flotante. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

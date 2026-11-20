import type { Shape, SupportId, Supports } from '../types';
import { shapeGeometry, worldPolygon, type Pt } from './shapes';

/** Aceleración de la gravedad en m/s². */
export const G = 9.81;

/** Tolerancia numérica para comparaciones en cm, kg y N. */
export const EPS = 1e-9;

/** Propiedades derivadas de una figura homogénea. Longitudes en cm, masa en kg. */
export type ShapeProperties = Shape & {
  /** Área Aᵢ en cm². */
  area: number;
  /** Densidad superficial ρᵢ = mᵢ/Aᵢ en kg/cm². */
  density: number;
  /** Abscisa del centroide xᵢ en cm (coordenada del mundo). */
  cx: number;
  /** Ordenada del centroide yᵢ en cm (coordenada del mundo). */
  cy: number;
  /** Segundo momento polar del área respecto al centroide, en cm⁴. */
  jc: number;
  /** Contorno en coordenadas del mundo (CCW). */
  polygon: Pt[];
};

/** Figura descartada del análisis por geometría inválida. */
export interface InvalidShape {
  id: string;
  error: string;
}

/** Un sumando de un promedio ponderado: peso (Aᵢ o mᵢ) × coordenada (xᵢ o yᵢ). */
export interface WeightedTerm {
  id: string;
  name: string;
  weight: number;
  coord: number;
  product: number;
}

/** Traza completa de un promedio ponderado Σwᵢcᵢ / Σwᵢ. `value` es null si Σwᵢ = 0. */
export interface WeightedAverageTrace {
  terms: WeightedTerm[];
  numerator: number;
  denominator: number;
  value: number | null;
}

/** Par de trazas (x, y) de un punto característico. */
export interface PointTrace {
  x: WeightedAverageTrace;
  y: WeightedAverageTrace;
}

/** Base de sustentación ordenada. Conserva qué etiqueta (A/B) corresponde a cada extremo. */
export interface SupportBase {
  xmin: number;
  xmax: number;
  /** L = xmax − xmin en cm. */
  width: number;
  minLabel: SupportId;
  maxLabel: SupportId;
}

export type StabilityReason = 'dentro' | 'fuera_izquierda' | 'fuera_derecha' | 'base_nula';

/** Resultado del criterio xmin ≤ x̄_CM ≤ xmax. */
export interface StabilityResult {
  stable: boolean;
  /** min(x̄_CM − xmin, xmax − x̄_CM) en cm; negativo si el CM cae fuera de la base. */
  margin: number;
  /** Apoyo en torno al cual vuelca el sistema (null si es estable). */
  pivot: SupportId | null;
  /** Abscisa del pivote crítico en cm (null si es estable). */
  pivotX: number | null;
  reason: StabilityReason;
}

/** Reacciones verticales en los apoyos y comprobación del equilibrio. Fuerzas en N. */
export interface ReactionsResult {
  /** Peso total W = M·g en N. */
  weight: number;
  RA: number;
  RB: number;
  /** Reacción en el apoyo situado en xmin. */
  Rmin: number;
  /** Reacción en el apoyo situado en xmax. */
  Rmax: number;
  /** L = xmax − xmin en cm. */
  L: number;
  /** ΣF_y = R_A + R_B − W en N (≈ 0). */
  sumFy: number;
  /** Στ respecto al apoyo en xmin, en N·m (≈ 0). */
  sumTorque: number;
}

export type ModelStatus = 'estable' | 'inestable' | 'sin_masa';

/** Resultado completo del análisis de propiedades de masa y estabilidad. */
export interface MassAnalysis {
  status: ModelStatus;
  g: number;
  supports: Supports;
  shapes: ShapeProperties[];
  /** Figuras excluidas por geometría inválida. */
  invalid: InvalidShape[];
  /** A = ΣAᵢ en cm². */
  totalArea: number;
  /** M = Σmᵢ en kg. */
  totalMass: number;
  centroid: PointTrace;
  centerOfMass: PointTrace;
  base: SupportBase;
  densityRange: { min: number; max: number } | null;
  stability: StabilityResult | null;
  reactions: ReactionsResult | null;
  /** Momento de vuelco W·|x̄_CM − x_P| en N·m respecto al pivote (solo si es inestable). */
  overturningMoment: number | null;
}

/**
 * Calcula área, densidad, centroide (mundo), J_c y contorno de una figura.
 * @param shape Figura con (x, y) = esquina inferior izquierda de su caja envolvente.
 * @returns null si la geometría es inválida.
 */
export function shapeProperties(shape: Shape): ShapeProperties | null {
  const r = shapeGeometry(shape);
  if (!r.ok) return null;
  const { area, cx, cy, jc } = r.geom;
  return {
    ...shape,
    area,
    density: area > EPS ? shape.m / area : 0,
    cx: shape.x + cx,
    cy: shape.y + cy,
    jc,
    polygon: worldPolygon(shape, r.geom),
  };
}

/**
 * Promedio ponderado Σwᵢcᵢ / Σwᵢ conservando cada sumando para la sustitución numérica.
 * @param items Pesos y coordenadas con identificador.
 * @returns Traza con `value = null` si la suma de pesos es 0.
 */
export function weightedAverage(
  items: readonly { id: string; name: string; weight: number; coord: number }[],
): WeightedAverageTrace {
  const terms: WeightedTerm[] = items.map((it) => ({ ...it, product: it.weight * it.coord }));
  const numerator = terms.reduce((acc, t) => acc + t.product, 0);
  const denominator = terms.reduce((acc, t) => acc + t.weight, 0);
  return { terms, numerator, denominator, value: Math.abs(denominator) > EPS ? numerator / denominator : null };
}

/**
 * Centroide geométrico: x̄_G = ΣAᵢxᵢ/ΣAᵢ, ȳ_G = ΣAᵢyᵢ/ΣAᵢ.
 * @param shapes Propiedades de las figuras.
 */
export function centroid(shapes: readonly ShapeProperties[]): PointTrace {
  return {
    x: weightedAverage(shapes.map((b) => ({ id: b.id, name: b.name, weight: b.area, coord: b.cx }))),
    y: weightedAverage(shapes.map((b) => ({ id: b.id, name: b.name, weight: b.area, coord: b.cy }))),
  };
}

/**
 * Centro de masa: x̄_CM = Σmᵢxᵢ/Σmᵢ, ȳ_CM = Σmᵢyᵢ/Σmᵢ.
 * @param shapes Propiedades de las figuras.
 */
export function centerOfMass(shapes: readonly ShapeProperties[]): PointTrace {
  return {
    x: weightedAverage(shapes.map((b) => ({ id: b.id, name: b.name, weight: b.m, coord: b.cx }))),
    y: weightedAverage(shapes.map((b) => ({ id: b.id, name: b.name, weight: b.m, coord: b.cy }))),
  };
}

/**
 * Ordena los apoyos en (xmin, xmax) conservando las etiquetas A/B.
 * @param supports Posiciones de A y B en cm.
 */
export function supportBase(supports: Supports): SupportBase {
  const { xA, xB } = supports;
  return xA <= xB
    ? { xmin: xA, xmax: xB, width: xB - xA, minLabel: 'A', maxLabel: 'B' }
    : { xmin: xB, xmax: xA, width: xA - xB, minLabel: 'B', maxLabel: 'A' };
}

/**
 * Criterio de estabilidad: estable si xmin ≤ x̄_CM ≤ xmax y la base tiene ancho > 0.
 * @param xCM Abscisa del centro de masa en cm.
 * @param base Base de sustentación ordenada.
 */
export function evaluateStability(xCM: number, base: SupportBase): StabilityResult {
  const margin = Math.min(xCM - base.xmin, base.xmax - xCM);
  if (base.width <= EPS) {
    const right = xCM >= base.xmax;
    return {
      stable: false,
      margin,
      pivot: right ? base.maxLabel : base.minLabel,
      pivotX: right ? base.xmax : base.xmin,
      reason: 'base_nula',
    };
  }
  if (xCM < base.xmin - EPS) {
    return { stable: false, margin, pivot: base.minLabel, pivotX: base.xmin, reason: 'fuera_izquierda' };
  }
  if (xCM > base.xmax + EPS) {
    return { stable: false, margin, pivot: base.maxLabel, pivotX: base.xmax, reason: 'fuera_derecha' };
  }
  return { stable: true, margin: Math.max(margin, 0), pivot: null, pivotX: null, reason: 'dentro' };
}

/**
 * Reacciones de una viga simplemente apoyada con la carga W = M·g en x̄_CM:
 * R_min = W·(xmax − x̄)/L, R_max = W·(x̄ − xmin)/L.
 * @param totalMass Masa total M en kg.
 * @param xCM Abscisa del centro de masa en cm.
 * @param base Base de sustentación ordenada.
 * @param g Gravedad en m/s².
 * @returns null si L = 0 o M = 0.
 */
export function computeReactions(
  totalMass: number,
  xCM: number,
  base: SupportBase,
  g: number = G,
): ReactionsResult | null {
  const L = base.width;
  if (L <= EPS || totalMass <= EPS) return null;
  const weight = totalMass * g;
  const Rmin = (weight * (base.xmax - xCM)) / L;
  const Rmax = (weight * (xCM - base.xmin)) / L;
  return {
    weight,
    RA: base.minLabel === 'A' ? Rmin : Rmax,
    RB: base.minLabel === 'B' ? Rmin : Rmax,
    Rmin,
    Rmax,
    L,
    sumFy: Rmin + Rmax - weight,
    sumTorque: (Rmax * L - weight * (xCM - base.xmin)) / 100,
  };
}

/**
 * Momento de inercia del conjunto respecto a un eje perpendicular que pasa por P
 * (teorema de ejes paralelos): I_P = Σ [ mᵢ·J_ci/Aᵢ + mᵢ·dᵢ² ], con J_ci el segundo
 * momento polar del área respecto al centroide (para rectángulos: A(b² + h²)/12).
 * @param shapes Figuras del modelo (cm, kg).
 * @param px Abscisa del pivote en cm.
 * @param py Ordenada del pivote en cm.
 * @returns I_P en kg·m².
 */
export function inertiaAboutPivot(shapes: readonly Shape[], px: number, py: number): number {
  return shapes.reduce((acc, s) => {
    const r = shapeGeometry(s);
    if (!r.ok || r.geom.area <= EPS) return acc;
    const dx = (s.x + r.geom.cx - px) / 100;
    const dy = (s.y + r.geom.cy - py) / 100;
    return acc + (s.m * r.geom.jc) / r.geom.area / 1e4 + s.m * (dx * dx + dy * dy);
  }, 0);
}

/**
 * Análisis completo: propiedades, centroide, centro de masa, estabilidad y reacciones.
 * Nunca devuelve NaN: si M = 0 o A = 0 el estado es "sin_masa". Las figuras con
 * geometría inválida se excluyen y se listan en `invalid`.
 * @param shapes Figuras del modelo.
 * @param supports Apoyos A y B.
 * @param g Gravedad en m/s².
 */
export function analyzeModel(shapes: readonly Shape[], supports: Supports, g: number = G): MassAnalysis {
  const props: ShapeProperties[] = [];
  const invalid: InvalidShape[] = [];
  for (const s of shapes) {
    const p = shapeProperties(s);
    if (p) props.push(p);
    else {
      const r = shapeGeometry(s);
      invalid.push({ id: s.id, error: r.ok ? 'Geometría inválida' : r.error });
    }
  }
  const totalArea = props.reduce((acc, b) => acc + b.area, 0);
  const totalMass = props.reduce((acc, b) => acc + b.m, 0);
  const cg = centroid(props);
  const cm = centerOfMass(props);
  const base = supportBase(supports);
  const densities = props.filter((b) => b.area > EPS).map((b) => b.density);
  const densityRange = densities.length > 0 ? { min: Math.min(...densities), max: Math.max(...densities) } : null;

  const common = {
    g,
    supports: { ...supports },
    shapes: props,
    invalid,
    totalArea,
    totalMass,
    centroid: cg,
    centerOfMass: cm,
    base,
    densityRange,
  };

  const xCM = cm.x.value;
  if (totalMass <= EPS || totalArea <= EPS || xCM === null || cm.y.value === null || cg.x.value === null || cg.y.value === null) {
    return { ...common, status: 'sin_masa', stability: null, reactions: null, overturningMoment: null };
  }

  const stability = evaluateStability(xCM, base);
  const reactions = stability.stable ? computeReactions(totalMass, xCM, base, g) : null;
  const overturningMoment =
    !stability.stable && stability.pivotX !== null ? (totalMass * g * Math.abs(xCM - stability.pivotX)) / 100 : null;

  return {
    ...common,
    status: stability.stable ? 'estable' : 'inestable',
    stability,
    reactions,
    overturningMoment,
  };
}

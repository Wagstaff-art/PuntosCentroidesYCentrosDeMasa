/** Tipos de figura geométrica homogénea admitidas por el modelo. */
export type ShapeKind =
  | 'rect'
  | 'triangle'
  | 'circle'
  | 'semicircle'
  | 'quarter'
  | 'trapezoid'
  | 'polygon'
  | 'equation';

/**
 * Campos comunes. (x, y) es la esquina inferior izquierda de la caja envolvente
 * de la figura, en cm; m es la masa en kg. flipX/flipY reflejan la geometría
 * local dentro de su caja (x → w − x, y → h − y).
 */
export interface ShapeBase {
  id: string;
  name: string;
  /** Masa en kg. */
  m: number;
  /** Coordenada x de la esquina inferior izquierda de la caja envolvente, en cm. */
  x: number;
  /** Coordenada y de la esquina inferior izquierda de la caja envolvente, en cm. */
  y: number;
  flipX: boolean;
  flipY: boolean;
}

/** Rectángulo de base b y altura h. */
export interface RectShape extends ShapeBase {
  kind: 'rect';
  /** Base en cm. */
  b: number;
  /** Altura en cm. */
  h: number;
}

/** Triángulo de vértices locales (0,0), (b,0), (apex·b, h); apex ∈ [0, 1]. */
export interface TriangleShape extends ShapeBase {
  kind: 'triangle';
  b: number;
  h: number;
  /** Posición relativa del vértice superior: 0 ó 1 = rectángulo, 0.5 = isósceles. */
  apex: number;
}

/** Círculo de radio r (caja 2r × 2r). */
export interface CircleShape extends ShapeBase {
  kind: 'circle';
  r: number;
}

/** Semicírculo con el lado plano abajo y la cúpula arriba (caja 2r × r). */
export interface SemicircleShape extends ShapeBase {
  kind: 'semicircle';
  r: number;
}

/** Cuarto de círculo con la esquina recta en el (0,0) local y arco en el primer cuadrante (caja r × r). */
export interface QuarterShape extends ShapeBase {
  kind: 'quarter';
  r: number;
}

/** Trapecio de vértices locales (0,0), (b,0), (offset+a,h), (offset,h), desplazado para min x = 0. */
export interface TrapezoidShape extends ShapeBase {
  kind: 'trapezoid';
  /** Base inferior en cm. */
  b: number;
  /** Base superior en cm. */
  a: number;
  h: number;
  /** Desplazamiento horizontal de la base superior respecto a la inferior, en cm. */
  offset: number;
}

/** Polígono de vértices libres, normalizado para que el mínimo de su caja sea (0, 0). */
export interface PolygonShape extends ShapeBase {
  kind: 'polygon';
  points: { x: number; y: number }[];
}

/** Región g(x) ≤ y ≤ f(x) con x ∈ [a, b] en coordenadas propias, anclada en (x, y). */
export interface EquationShape extends ShapeBase {
  kind: 'equation';
  /** Borde superior f(x). */
  f: string;
  /** Borde inferior g(x). */
  g: string;
  a: number;
  b: number;
}

export type Shape =
  | RectShape
  | TriangleShape
  | CircleShape
  | SemicircleShape
  | QuarterShape
  | TrapezoidShape
  | PolygonShape
  | EquationShape;

/** Posiciones horizontales (cm) de los apoyos A (fijo) y B (rodillo), ambos sobre y = 0. */
export interface Supports {
  xA: number;
  xB: number;
}

export type SupportId = 'A' | 'B';

/** Campo numérico editable de una figura (según su tipo). */
export type ShapeField = 'b' | 'h' | 'm' | 'x' | 'y' | 'r' | 'a' | 'apex' | 'offset';

/** Etiqueta de cada tipo de figura en español. */
export const SHAPE_LABELS: Readonly<Record<ShapeKind, string>> = {
  rect: 'Rectángulo',
  triangle: 'Triángulo',
  circle: 'Círculo',
  semicircle: 'Semicírculo',
  quarter: 'Cuarto de círculo',
  trapezoid: 'Trapecio',
  polygon: 'Polígono',
  equation: 'Región f–g',
};

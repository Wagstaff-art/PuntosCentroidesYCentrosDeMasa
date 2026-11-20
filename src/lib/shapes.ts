/**
 * Motor de geometría de figuras: área, centroide, segundo momento polar
 * y polígono de contorno (local, CCW) para dibujo, hit-test y contactos.
 * Longitudes en cm; jc en cm⁴.
 */
import type { Shape } from '../types';
import { compileExpr } from './expr';

export interface Pt {
  x: number;
  y: number;
}

/** Resultado geométrico en coordenadas locales (el ancla (x, y) de la figura es el (0, 0)). */
export interface ShapeGeometry {
  /** Área en cm². */
  area: number;
  /** Centroide local en cm. */
  cx: number;
  cy: number;
  /** Segundo momento polar del área respecto al centroide, en cm⁴. */
  jc: number;
  /** Ancho y alto de la caja envolvente local, en cm. */
  width: number;
  height: number;
  /** Contorno local en sentido antihorario (para dibujo, hit-test, solapes y contactos). */
  polygon: Pt[];
}

export type GeometryResult = { ok: true; geom: ShapeGeometry } | { ok: false; error: string };

const ERR_SELF = 'El polígono no debe cruzarse a sí mismo';
const ERR_FEW = 'El polígono necesita al menos 3 vértices';
const ERR_AREA = 'La figura tiene área nula';

const CIRCLE_SEGS = 96;
const SEMI_SEGS = 64;
const QUARTER_SEGS = 48;
const EQ_POLY_PTS = 121;
const SIMPSON_N = 600;

/* ---------- utilidades de polígonos ---------- */

/** Área con signo (shoelace); positiva si el contorno es antihorario. */
export function signedArea(p: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i += 1) {
    const a = p[i] as Pt;
    const b = p[(i + 1) % p.length] as Pt;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * Área, centroide y momento polar respecto al origen de un polígono (CCW o CW).
 * J_O = (1/12) Σ (xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)(xᵢ² + xᵢxᵢ₊₁ + xᵢ₊₁² + yᵢ² + yᵢyᵢ₊₁ + yᵢ₊₁²).
 */
function polygonMeasure(pts: readonly Pt[]): { area: number; cx: number; cy: number; jo: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  let jo = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i] as Pt;
    const q = pts[(i + 1) % pts.length] as Pt;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
    jo += cross * (p.x * p.x + p.x * q.x + q.x * q.x + p.y * p.y + p.y * q.y + q.y * q.y);
  }
  a /= 2;
  const k = 6 * a;
  return { area: a, cx: cx / k, cy: cy / k, jo: jo / 12 };
}

/** Indica si los segmentos p1p2 y q1q2 se cruzan en su interior (intersección propia). */
export function segmentsIntersect(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(q1, q2, p1);
  const d2 = d(q1, q2, p2);
  const d3 = d(p1, p2, q1);
  const d4 = d(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Indica si un polígono se corta a sí mismo (aristas no adyacentes con cruce propio). */
export function isSelfIntersecting(p: readonly Pt[]): boolean {
  const n = p.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (j === i || j === (i + 1) % n || i === (j + 1) % n) continue;
      if (segmentsIntersect(p[i] as Pt, p[(i + 1) % n] as Pt, p[j] as Pt, p[(j + 1) % n] as Pt)) return true;
    }
  }
  return false;
}

/** Test del rayo: punto dentro del polígono (el borde cuenta como dentro). */
export function pointInPolygon(pt: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = poly[i] as Pt;
    const b = poly[j] as Pt;
    // Punto sobre el segmento
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (
      Math.abs(cross) < 1e-9 &&
      pt.x >= Math.min(a.x, b.x) - 1e-9 &&
      pt.x <= Math.max(a.x, b.x) + 1e-9 &&
      pt.y >= Math.min(a.y, b.y) - 1e-9 &&
      pt.y <= Math.max(a.y, b.y) + 1e-9
    ) {
      return true;
    }
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Punto estrictamente dentro (sin contar el borde). */
function pointStrictlyInside(pt: Pt, poly: readonly Pt[]): boolean {
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = poly[i] as Pt;
    const b = poly[j] as Pt;
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (
      Math.abs(cross) < 1e-9 &&
      pt.x >= Math.min(a.x, b.x) - 1e-9 &&
      pt.x <= Math.max(a.x, b.x) + 1e-9 &&
      pt.y >= Math.min(a.y, b.y) - 1e-9 &&
      pt.y <= Math.max(a.y, b.y) + 1e-9
    ) {
      return false;
    }
  }
  return pointInPolygon(pt, poly);
}

/** Indica si dos polígonos se solapan con área positiva (cruce propio o vértice estrictamente dentro). */
export function polygonsOverlap(p: readonly Pt[], q: readonly Pt[]): boolean {
  const np = p.length;
  const nq = q.length;
  for (let i = 0; i < np; i += 1) {
    for (let j = 0; j < nq; j += 1) {
      if (segmentsIntersect(p[i] as Pt, p[(i + 1) % np] as Pt, q[j] as Pt, q[(j + 1) % nq] as Pt)) return true;
    }
  }
  if (p.some((v) => pointStrictlyInside(v, q)) || q.some((v) => pointStrictlyInside(v, p))) return true;
  return false;
}

/** Indica si el polígono (CCW) es convexo. */
export function isConvex(p: readonly Pt[]): boolean {
  const n = p.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i += 1) {
    const a = p[i] as Pt;
    const b = p[(i + 1) % n] as Pt;
    const c = p[(i + 2) % n] as Pt;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Área de intersección por recorte de Sutherland–Hodgman (válida si `clip` es convexo). */
export function clipArea(subject: readonly Pt[], clip: readonly Pt[]): number {
  let out = [...subject];
  const n = clip.length;
  for (let i = 0; i < n; i += 1) {
    const a = clip[i] as Pt;
    const b = clip[(i + 1) % n] as Pt;
    const inside = (p: Pt) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-12;
    const next: Pt[] = [];
    for (let j = 0; j < out.length; j += 1) {
      const s = out[j] as Pt;
      const e = out[(j + 1) % out.length] as Pt;
      const sIn = inside(s);
      const eIn = inside(e);
      if (sIn !== eIn) {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const t = -((b.x - a.x) * (s.y - a.y) - (b.y - a.y) * (s.x - a.x)) / ((b.x - a.x) * dy - (b.y - a.y) * dx);
        next.push({ x: s.x + t * dx, y: s.y + t * dy });
      }
      if (eIn) next.push(e);
    }
    out = next;
    if (out.length === 0) return 0;
  }
  return Math.abs(signedArea(out));
}

function distPtSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  const px = a.x + t * dx - p.x;
  const py = a.y + t * dy - p.y;
  return Math.hypot(px, py);
}

function distSegSeg(p1: Pt, p2: Pt, q1: Pt, q2: Pt): number {
  if (segmentsIntersect(p1, p2, q1, q2)) return 0;
  return Math.min(distPtSeg(p1, q1, q2), distPtSeg(p2, q1, q2), distPtSeg(q1, p1, p2), distPtSeg(q2, p1, p2));
}

/** Distancia mínima entre dos polígonos (0 si se solapan o se tocan). */
export function polygonDistance(p: readonly Pt[], q: readonly Pt[]): number {
  const np = p.length;
  const nq = q.length;
  let min = Infinity;
  for (let i = 0; i < np; i += 1) {
    for (let j = 0; j < nq; j += 1) {
      const d = distSegSeg(p[i] as Pt, p[(i + 1) % np] as Pt, q[j] as Pt, q[(j + 1) % nq] as Pt);
      if (d < min) min = d;
      if (min === 0) return 0;
    }
  }
  if (pointInPolygon(p[0] as Pt, q) || pointInPolygon(q[0] as Pt, p)) return 0;
  return min;
}

/* ---------- geometrías por tipo ---------- */

function fromPolygon(pts: Pt[]): GeometryResult {
  let poly = pts;
  if (signedArea(poly) < 0) poly = [...poly].reverse();
  if (isSelfIntersecting(poly)) return { ok: false, error: ERR_SELF };
  const { area, cx, cy, jo } = polygonMeasure(poly);
  if (!(area > 1e-6)) return { ok: false, error: ERR_AREA };
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    ok: true,
    geom: {
      area,
      cx,
      cy,
      jc: jo - area * (cx * cx + cy * cy),
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      polygon: poly,
    },
  };
}

function regularPolygon(cx: number, cy: number, r: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

/** Momentos de la región g ≤ y ≤ f en coordenadas propias de la ecuación (Simpson, n = 600). */
export interface EquationMoments {
  area: number;
  /** x̄ y ȳ del centroide en coordenadas de la ecuación. */
  xb: number;
  yb: number;
  /** Mínimo de g y máximo de f en la malla de muestreo (bbox vertical). */
  ymin: number;
  ymax: number;
  /** Segundo momento polar del área respecto al origen de la ecuación, en cm⁴. */
  jo: number;
}

export const EQUATION_SIMPSON_N = SIMPSON_N;

/** Integra la región por Simpson compuesto; devuelve los momentos o el motivo del fallo. */
export function equationMoments(
  f: string,
  g: string,
  a: number,
  b: number,
): { ok: true; m: EquationMoments } | { ok: false; error: string } {
  const fc = compileExpr(f);
  if (!fc.ok) return { ok: false, error: `f(x): ${fc.error}` };
  const gc = compileExpr(g);
  if (!gc.ok) return { ok: false, error: `g(x): ${gc.error}` };
  if (!(b > a)) return { ok: false, error: 'Se requiere a < b' };

  const n = SIMPSON_N;
  const h = (b - a) / n;
  const fs: number[] = new Array<number>(n + 1);
  const gs: number[] = new Array<number>(n + 1);
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i <= n; i += 1) {
    const x = a + i * h;
    const fv = fc.fn(x);
    const gv = gc.fn(x);
    if (!Number.isFinite(fv) || !Number.isFinite(gv)) {
      return { ok: false, error: 'f(x) o g(x) no es finita en algún punto de [a, b]' };
    }
    if (fv < gv - 1e-9) return { ok: false, error: 'f(x) debe ser ≥ g(x) en todo [a, b]' };
    fs[i] = fv;
    gs[i] = gv;
    if (gv < ymin) ymin = gv;
    if (fv > ymax) ymax = fv;
  }

  const simpson = (terms: (fv: number, gv: number, x: number) => number): number => {
    let sum = 0;
    for (let i = 0; i <= n; i += 1) {
      const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
      sum += w * terms(fs[i] as number, gs[i] as number, a + i * h);
    }
    return (sum * h) / 3;
  };

  const area = simpson((fv, gv) => fv - gv);
  if (!(area > 1e-6)) return { ok: false, error: ERR_AREA };
  const mx = simpson((fv, gv, x) => x * (fv - gv));
  const my = simpson((fv, gv) => (fv * fv - gv * gv) / 2);
  const jo = simpson((fv, gv, x) => x * x * (fv - gv) + (fv * fv * fv - gv * gv * gv) / 3);
  return { ok: true, m: { area, xb: mx / area, yb: my / area, ymin, ymax, jo } };
}

function equationGeometry(s: Extract<Shape, { kind: 'equation' }>): GeometryResult {
  // Momentos por Simpson: única fuente en equationMoments.
  const mom = equationMoments(s.f, s.g, s.a, s.b);
  if (!mom.ok) return { ok: false, error: mom.error };
  const { area, xb, yb, ymin, ymax, jo } = mom.m;

  // Contorno: f de izquierda a derecha, g de derecha a izquierda (121 puntos por borde).
  const fc = compileExpr(s.f);
  const gc = compileExpr(s.g);
  if (!fc.ok || !gc.ok) return { ok: false, error: 'Expresión inválida' };
  const m = EQ_POLY_PTS - 1;
  const hp = (s.b - s.a) / m;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= m; i += 1) {
    const x = s.a + i * hp;
    top.push({ x, y: fc.fn(x) });
    bottom.push({ x, y: gc.fn(x) });
  }
  const poly = [...top, ...[...bottom].reverse()].map((p) => ({ x: p.x - s.a, y: p.y - ymin }));
  if (signedArea(poly) < 0) poly.reverse();

  return {
    ok: true,
    geom: {
      area,
      cx: xb - s.a,
      cy: yb - ymin,
      jc: jo - area * (xb * xb + yb * yb),
      width: s.b - s.a,
      height: ymax - ymin,
      polygon: poly,
    },
  };
}

/** Geometría local de la figura sin aplicar los reflejos. */
function baseGeometry(s: Shape): GeometryResult {
  switch (s.kind) {
    case 'rect': {
      const { b, h } = s;
      return {
        ok: true,
        geom: {
          area: b * h,
          cx: b / 2,
          cy: h / 2,
          jc: (b * h * (b * b + h * h)) / 12,
          width: b,
          height: h,
          polygon: [
            { x: 0, y: 0 },
            { x: b, y: 0 },
            { x: b, y: h },
            { x: 0, y: h },
          ],
        },
      };
    }
    case 'triangle':
      return fromPolygon([
        { x: 0, y: 0 },
        { x: s.b, y: 0 },
        { x: s.apex * s.b, y: s.h },
      ]);
    case 'circle': {
      const { r } = s;
      const area = Math.PI * r * r;
      return {
        ok: true,
        geom: {
          area,
          cx: r,
          cy: r,
          jc: (Math.PI * r ** 4) / 2,
          width: 2 * r,
          height: 2 * r,
          polygon: regularPolygon(r, r, r, CIRCLE_SEGS),
        },
      };
    }
    case 'semicircle': {
      const { r } = s;
      const area = (Math.PI * r * r) / 2;
      const cy = (4 * r) / (3 * Math.PI);
      const jo = (Math.PI * r ** 4) / 4;
      const pts: Pt[] = [];
      for (let i = 0; i <= SEMI_SEGS; i += 1) {
        const t = (i / SEMI_SEGS) * Math.PI;
        pts.push({ x: r + r * Math.cos(t), y: r * Math.sin(t) });
      }
      return {
        ok: true,
        geom: {
          area,
          cx: r,
          cy,
          jc: jo - area * cy * cy,
          width: 2 * r,
          height: r,
          polygon: pts,
        },
      };
    }
    case 'quarter': {
      const { r } = s;
      const area = (Math.PI * r * r) / 4;
      const c = (4 * r) / (3 * Math.PI);
      const jo = (Math.PI * r ** 4) / 8;
      const pts: Pt[] = [{ x: 0, y: 0 }];
      for (let i = 0; i <= QUARTER_SEGS; i += 1) {
        const t = (i / QUARTER_SEGS) * (Math.PI / 2);
        pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
      }
      return {
        ok: true,
        geom: { area, cx: c, cy: c, jc: jo - area * 2 * c * c, width: r, height: r, polygon: pts },
      };
    }
    case 'trapezoid': {
      const minX = Math.min(0, s.offset, s.offset + s.a);
      return fromPolygon([
        { x: -minX, y: 0 },
        { x: s.b - minX, y: 0 },
        { x: s.offset + s.a - minX, y: s.h },
        { x: s.offset - minX, y: s.h },
      ]);
    }
    case 'polygon': {
      if (s.points.length < 3) return { ok: false, error: ERR_FEW };
      if (s.points.length > 40) return { ok: false, error: 'El polígono admite como máximo 40 vértices' };
      const minX = Math.min(...s.points.map((p) => p.x));
      const minY = Math.min(...s.points.map((p) => p.y));
      const pts = s.points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      return fromPolygon(pts);
    }
    case 'equation':
      return equationGeometry(s);
  }
}

/**
 * Área, centroide local, momento polar y polígono local (CCW) de la figura,
 * con los reflejos flipX/flipY aplicados dentro de su caja envolvente.
 */
export function shapeGeometry(s: Shape): GeometryResult {
  const r = baseGeometry(s);
  if (!r.ok) return r;
  if (!s.flipX && !s.flipY) return r;
  const { width: w, height: h, polygon } = r.geom;
  const mirror = (p: Pt): Pt => ({ x: s.flipX ? w - p.x : p.x, y: s.flipY ? h - p.y : p.y });
  let poly = polygon.map(mirror);
  if (signedArea(poly) < 0) poly = [...poly].reverse();
  const cx = s.flipX ? w - r.geom.cx : r.geom.cx;
  const cy = s.flipY ? h - r.geom.cy : r.geom.cy;
  return { ok: true, geom: { ...r.geom, cx, cy, polygon: poly } };
}

/** Polígono en coordenadas del mundo (local + ancla). */
export function worldPolygon(s: Shape, geom: ShapeGeometry): Pt[] {
  return geom.polygon.map((p) => ({ x: p.x + s.x, y: p.y + s.y }));
}

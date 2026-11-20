import { describe, expect, it } from 'vitest';
import { shapeGeometry, signedArea } from './shapes';
import type {
  CircleShape,
  EquationShape,
  PolygonShape,
  QuarterShape,
  RectShape,
  SemicircleShape,
  TrapezoidShape,
  TriangleShape,
} from '../types';

const base = { m: 1, x: 0, y: 0, flipX: false, flipY: false };

const rect = (b: number, h: number): RectShape => ({ id: 'r', name: 'r', kind: 'rect', b, h, ...base });
const circ = (r: number): CircleShape => ({ id: 'c', name: 'c', kind: 'circle', r, ...base });
const semi = (r: number, flipY = false): SemicircleShape => ({ id: 's', name: 's', kind: 'semicircle', r, ...base, flipY });
const quarter = (r: number): QuarterShape => ({ id: 'q', name: 'q', kind: 'quarter', r, ...base });
const tri = (b: number, h: number, apex: number): TriangleShape => ({ id: 't', name: 't', kind: 'triangle', b, h, apex, ...base });
const trap = (b: number, a: number, h: number, offset: number): TrapezoidShape => ({
  id: 'z',
  name: 'z',
  kind: 'trapezoid',
  b,
  a,
  h,
  offset,
  ...base,
});
const poly = (points: { x: number; y: number }[]): PolygonShape => ({ id: 'p', name: 'p', kind: 'polygon', points, ...base });
const eq = (f: string, g: string, a: number, b: number): EquationShape => ({
  id: 'e',
  name: 'e',
  kind: 'equation',
  f,
  g,
  a,
  b,
  ...base,
});

const geom = (s: Parameters<typeof shapeGeometry>[0]) => {
  const r = shapeGeometry(s);
  if (!r.ok) throw new Error(`geometría inválida: ${r.error}`);
  return r.geom;
};

describe('shapeGeometry: fórmulas exactas', () => {
  it('rectángulo: A = b·h, c = (b/2, h/2), J_c = A(b²+h²)/12', () => {
    const g = geom(rect(20, 10));
    expect(g.area).toBe(200);
    expect(g.cx).toBe(10);
    expect(g.cy).toBe(5);
    expect(g.jc).toBeCloseTo((200 * (400 + 100)) / 12, 9);
    expect(g.width).toBe(20);
    expect(g.height).toBe(10);
  });

  it('círculo: A = πr², J_c = πr⁴/2', () => {
    const g = geom(circ(10));
    expect(g.area).toBeCloseTo(Math.PI * 100, 9);
    expect(g.cx).toBe(10);
    expect(g.cy).toBe(10);
    expect(g.jc).toBeCloseTo((Math.PI * 10 ** 4) / 2, 6);
    expect(g.polygon).toHaveLength(96);
  });

  it('semicírculo r = 10: A = 50π, c.y = 40/(3π)', () => {
    const g = geom(semi(10));
    expect(g.area).toBeCloseTo(50 * Math.PI, 9);
    expect(g.cx).toBe(10);
    expect(g.cy).toBeCloseTo(40 / (3 * Math.PI), 6);
    expect(g.cy).toBeCloseTo(4.24413, 4);
    expect(g.width).toBe(20);
    expect(g.height).toBe(10);
  });

  it('cuarto de círculo r = 12: c = (16/π, 16/π), A = 36π', () => {
    const g = geom(quarter(12));
    expect(g.area).toBeCloseTo(36 * Math.PI, 9);
    expect(g.cx).toBeCloseTo(16 / Math.PI, 6);
    expect(g.cy).toBeCloseTo(16 / Math.PI, 6);
    expect(g.cx).toBeCloseTo(5.09296, 4);
  });

  it('triángulo rectángulo b = 30, h = 18, apex = 0: A = 270, c = (10, 6)', () => {
    const g = geom(tri(30, 18, 0));
    expect(g.area).toBeCloseTo(270, 9);
    expect(g.cx).toBeCloseTo(10, 9);
    expect(g.cy).toBeCloseTo(6, 9);
  });

  it('trapecio b = 10, a = 4, h = 6, offset = 3: A = 42, c.y = 18/7', () => {
    const g = geom(trap(10, 4, 6, 3));
    expect(g.area).toBeCloseTo(42, 9);
    expect(g.cy).toBeCloseTo((6 * (10 + 8)) / (3 * 14), 9);
    expect(g.cy).toBeCloseTo(2.571428, 5);
  });

  it('polígono cuadrado unidad (cualquier orden/orientación): A = 1, c = (0.5, 0.5), J_c = 1/6', () => {
    const cw = poly([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]);
    const g = geom(cw);
    expect(g.area).toBeCloseTo(1, 9);
    expect(g.cx).toBeCloseTo(0.5, 9);
    expect(g.cy).toBeCloseTo(0.5, 9);
    expect(g.jc).toBeCloseTo(1 / 6, 9);
    expect(signedArea(g.polygon)).toBeGreaterThan(0);
  });

  it('polígono auto-cruzado (bow-tie) → error', () => {
    const r = shapeGeometry(
      poly([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cruzarse');
  });

  it('flipY en semicírculo → c.y = r − 4r/(3π)', () => {
    const g = geom(semi(10, true));
    expect(g.cy).toBeCloseTo(10 - 40 / (3 * Math.PI), 6);
    expect(signedArea(g.polygon)).toBeGreaterThan(0);
  });

  it('el polígono del semicírculo aproxima el área exacta al 0.2%', () => {
    const g = geom(semi(10));
    const polyArea = Math.abs(signedArea(g.polygon));
    expect(Math.abs(polyArea - g.area) / g.area).toBeLessThan(0.002);
  });
});

describe('shapeGeometry: regiones de ecuación (Simpson, n = 600)', () => {
  it('parábola y = 20 − x²/20 en [−20, 20]: A = 533.3333, x̄ = 0, ȳ = 8', () => {
    const g = geom(eq('20 - x^2/20', '0', -20, 20));
    expect(g.area).toBeCloseTo(533.3333, 3);
    expect(g.cx).toBeCloseTo(20, 9); // x̄_eq = 0 → local = 0 − (−20) = 20
    expect(g.cy).toBeCloseTo(8, 4);
    expect(g.width).toBeCloseTo(40, 9);
    expect(g.height).toBeCloseTo(20, 9);
  });

  it('sqrt(100 − x²) en [−10, 10]: A ≈ 50π, ȳ ≈ 4.2441', () => {
    const g = geom(eq('sqrt(100 - x^2)', '0', -10, 10));
    expect(g.area).toBeCloseTo(50 * Math.PI, 2);
    expect(g.cy).toBeCloseTo(4.2441, 2);
    expect(g.cx).toBeCloseTo(10, 6);
  });

  it('f < g en algún punto → error', () => {
    const r = shapeGeometry(eq('x', 'x + 5', 0, 10));
    expect(r.ok).toBe(false);
  });

  it('1/x en [−1, 1] → error (no finita)', () => {
    const r = shapeGeometry(eq('1/x', '0', -1, 1));
    expect(r.ok).toBe(false);
  });
});

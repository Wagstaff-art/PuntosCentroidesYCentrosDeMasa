import { describe, expect, it } from 'vitest';
import { createShape, defaultShapeProto } from './shapeFactory';
import { shapeGeometry } from './shapes';
import type { ShapeKind } from '../types';

const KINDS: ShapeKind[] = ['rect', 'triangle', 'circle', 'semicircle', 'quarter', 'trapezoid', 'polygon', 'equation'];

describe('createShape', () => {
  it.each(KINDS)('%s: geometría válida y centro de la caja = solicitado (±0.5 con snap)', (kind) => {
    const center = { x: 12.3, y: 40.7 };
    const s = createShape(kind, center, 'k1', 'Figura', true);
    const r = shapeGeometry(s);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (!r.ok) return;
    const cx = s.x + r.geom.width / 2;
    const cy = s.y + r.geom.height / 2;
    expect(Math.abs(cx - center.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(cy - center.y)).toBeLessThanOrEqual(0.5);
  });

  it.each(KINDS)('%s: el proto por defecto es geométricamente válido', (kind) => {
    expect(shapeGeometry(defaultShapeProto(kind)).ok).toBe(true);
  });
});

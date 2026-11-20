import { describe, expect, it } from 'vitest';
import { PRESETS, presetToSnapshot } from '../data/presets';
import { analyzeGeometry, intersectionArea, touches } from './geometry';
import type { CircleShape, RectShape } from '../types';

const blk = (id: string, b: number, h: number, x: number, y: number): RectShape => ({
  id,
  name: id,
  kind: 'rect',
  b,
  h,
  m: 1,
  x,
  y,
  flipX: false,
  flipY: false,
});

const circle = (id: string, r: number, x: number, y: number): CircleShape => ({
  id,
  name: id,
  kind: 'circle',
  r,
  m: 1,
  x,
  y,
  flipX: false,
  flipY: false,
});

describe('geometría de figuras', () => {
  it('figuras que solo se tocan no se solapan', () => {
    const p = blk('p', 10, 10, 0, 0);
    const q = blk('q', 10, 10, 10, 0);
    expect(intersectionArea(p, q)).toBe(0);
    expect(touches(p, q)).toBe(true);
  });

  it('detecta solapamiento con área positiva', () => {
    const w = analyzeGeometry([blk('p', 10, 10, 0, 0), blk('q', 10, 10, 5, 5)]);
    expect(w.overlaps).toHaveLength(1);
    expect(w.overlaps[0]?.area).toBeCloseTo(25, 6);
    expect(w.overlapIds.has('p') && w.overlapIds.has('q')).toBe(true);
  });

  it('un contacto en un solo vértice sí cuenta como contacto', () => {
    // p ocupa [0,10]² y q [10,20]×[10,20]: se tocan en (10, 10).
    expect(touches(blk('p', 10, 10, 0, 0), blk('q', 10, 10, 10, 10))).toBe(true);
  });

  it('un círculo apoyado en tangente sobre un rectángulo no flota', () => {
    const w = analyzeGeometry([blk('suelo', 40, 10, -20, 0), circle('disco', 10, -10, 10)]);
    expect(w.floatingIds.size).toBe(0);
  });

  it('un círculo que atraviesa un rectángulo se reporta como solapamiento', () => {
    const w = analyzeGeometry([blk('suelo', 40, 10, -20, 0), circle('disco', 10, -10, 5)]);
    expect(w.overlaps).toHaveLength(1);
    expect(w.overlaps[0]?.area).not.toBeNull();
  });

  it('detecta figuras flotantes', () => {
    const w = analyzeGeometry([blk('suelo', 10, 10, 0, 0), blk('aire', 10, 10, 50, 30), blk('encima', 5, 5, 2, 10)]);
    expect([...w.floatingIds]).toEqual(['aire']);
  });

  it('los presets no tienen solapamientos ni figuras flotantes', () => {
    for (const p of PRESETS) {
      const w = analyzeGeometry(presetToSnapshot(p).shapes);
      expect(w.overlaps, p.name).toHaveLength(0);
      expect(w.floatingIds.size, p.name).toBe(0);
    }
  });
});

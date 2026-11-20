import { describe, expect, it } from 'vitest';
import { PRESETS, presetToSnapshot, type Preset } from '../data/presets';
import { G, analyzeModel, shapeProperties, inertiaAboutPivot, type ShapeProperties } from './physics';
import { buildDerivation } from './derivation';
import type { Shape, RectShape, CircleShape } from '../types';

const TOL = 1e-2;

function close(actual: number | null | undefined, expected: number, tol = TOL): void {
  expect(actual).not.toBeNull();
  expect(actual).not.toBeUndefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThan(tol);
}

function analyzePreset(p: Preset) {
  const s = presetToSnapshot(p);
  return analyzeModel(s.shapes, s.supports);
}

function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  return Object.values(value as Record<string, unknown>).every(allFinite);
}

describe('presets: resultados esperados (sección 8)', () => {
  for (const p of PRESETS) {
    it(p.name, () => {
      const a = analyzePreset(p);
      close(a.centroid.x.value, p.expected.xG);
      close(a.centerOfMass.x.value, p.expected.xCM);
      close(a.totalMass, p.expected.M);
      expect(a.status).toBe(p.expected.status);
      if (p.expected.pivot) expect(a.stability?.pivot).toBe(p.expected.pivot);
      if (p.expected.margin !== undefined) close(a.stability?.margin, p.expected.margin);
      if (p.expected.equalReactions) close(a.reactions?.RA, a.reactions?.RB ?? Number.NaN);
      if (p.expected.xGInsideBase !== undefined) {
        const xG = a.centroid.x.value ?? Number.NaN;
        expect(xG >= a.base.xmin && xG <= a.base.xmax).toBe(p.expected.xGInsideBase);
      }
      expect(allFinite(a)).toBe(true);
    });
  }

  it('preset 3: densidades iguales a 0.1 kg/cm²', () => {
    const p = PRESETS.find((x) => x.id === 'colapso-geometria');
    expect(p).toBeDefined();
    const a = analyzePreset(p as Preset);
    for (const b of a.shapes) close(b.density, 0.1, 1e-9);
  });

  it('preset 5: arco parabólico, A = 533.333 cm² y ȳ = 8 cm', () => {
    const p = PRESETS.find((x) => x.id === 'arco-parabolico') as Preset;
    const a = analyzePreset(p);
    close(a.totalArea, 533.3333, 1e-3);
    close(a.centroid.y.value, 8, 1e-4);
    close(a.centroid.x.value, 0, 1e-9);
    expect(a.status).toBe('estable');
    close(a.reactions?.RA, a.reactions?.RB ?? Number.NaN);
  });

  it('preset 6: figuras combinadas, x̄_G = 3.289 y x̄_CM = 3.8889', () => {
    const p = PRESETS.find((x) => x.id === 'figuras-combinadas') as Preset;
    const a = analyzePreset(p);
    close(a.centroid.x.value, 3.289, TOL);
    close(a.centerOfMass.x.value, 3.8889, TOL);
    close(a.totalMass, 60);
    expect(a.status).toBe('estable');
  });

  it('preset 4: x̄_G dentro de la base y x̄_CM fuera, pivote B', () => {
    const p = PRESETS.find((x) => x.id === 'trampa-densidad') as Preset;
    const a = analyzePreset(p);
    const xG = a.centroid.x.value as number;
    const xCM = a.centerOfMass.x.value as number;
    expect(xG).toBeGreaterThanOrEqual(a.base.xmin);
    expect(xG).toBeLessThanOrEqual(a.base.xmax);
    expect(xCM).toBeGreaterThan(a.base.xmax);
    expect(a.stability?.pivot).toBe('B');
  });
});

describe('casos borde', () => {
  it('M = 0 (sin bloques) → "sin_masa" sin NaN', () => {
    const a = analyzeModel([], { xA: -10, xB: 10 });
    expect(a.status).toBe('sin_masa');
    expect(a.centroid.x.value).toBeNull();
    expect(a.centerOfMass.x.value).toBeNull();
    expect(a.stability).toBeNull();
    expect(a.reactions).toBeNull();
    expect(allFinite(a)).toBe(true);
  });

  it('masa nula en un bloque degenerado → "sin_masa"', () => {
    const a = analyzeModel(
      [{ id: 'z', name: 'Z', kind: 'rect', b: 10, h: 10, m: 0, x: 0, y: 0, flipX: false, flipY: false }],
      { xA: -10, xB: 10 },
    );
    expect(a.status).toBe('sin_masa');
  });

  it('xA = xB → base de ancho 0 → INESTABLE sin reacciones', () => {
    const p = PRESETS[0] as Preset;
    const s = presetToSnapshot(p);
    const a = analyzeModel(s.shapes, { xA: 0, xB: 0 });
    expect(a.status).toBe('inestable');
    expect(a.stability?.reason).toBe('base_nula');
    expect(a.base.width).toBe(0);
    expect(a.reactions).toBeNull();
    expect(allFinite(a)).toBe(true);
  });

  it('xA > xB → se ordena internamente y se conservan las etiquetas', () => {
    const p1 = presetToSnapshot(PRESETS[0] as Preset);
    const a1 = analyzeModel(p1.shapes, { xA: 30, xB: -30 });
    expect(a1.base).toMatchObject({ xmin: -30, xmax: 30, minLabel: 'B', maxLabel: 'A' });
    expect(a1.status).toBe('estable');
    close(a1.reactions?.RA, a1.reactions?.RB ?? Number.NaN);

    const p3 = presetToSnapshot(PRESETS[2] as Preset);
    const a3 = analyzeModel(p3.shapes, { xA: 10, xB: -10 });
    expect(a3.status).toBe('inestable');
    expect(a3.stability?.pivot).toBe('A');
    close(a3.stability?.margin, -9);
  });

  it('CM exactamente sobre un apoyo → estable con margen 0', () => {
    const blocks: Shape[] = [
      { id: 'q', name: 'Q', kind: 'rect', b: 20, h: 10, m: 10, x: 0, y: 0, flipX: false, flipY: false },
    ];
    const a = analyzeModel(blocks, { xA: 10, xB: 40 });
    expect(a.status).toBe('estable');
    close(a.stability?.margin, 0, 1e-9);
    close(a.reactions?.RA, 10 * G, 1e-9);
    close(a.reactions?.RB, 0, 1e-9);
  });

  it('el desarrollo TeX nunca contiene NaN ni Infinity', () => {
    const cases = [
      analyzeModel([], { xA: 0, xB: 0 }),
      ...PRESETS.map((p) => analyzePreset(p)),
      analyzeModel(presetToSnapshot(PRESETS[0] as Preset).shapes, { xA: 5, xB: 5 }),
    ];
    for (const a of cases) {
      const tex = Object.values(buildDerivation(a)).filter((s): s is string => typeof s === 'string').join('\n');
      expect(tex).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('equilibrio de reacciones', () => {
  for (const p of PRESETS.filter((x) => x.expected.status === 'estable')) {
    it(`${p.name}: ΣF_y = 0 y Στ = 0`, () => {
      const a = analyzePreset(p);
      const r = a.reactions;
      expect(r).not.toBeNull();
      if (!r) return;
      close(r.RA + r.RB, a.totalMass * G, 1e-9);
      close(r.sumFy, 0, 1e-9);
      close(r.sumTorque, 0, 1e-9);
      expect(r.RA).toBeGreaterThanOrEqual(0);
      expect(r.RB).toBeGreaterThanOrEqual(0);
    });
  }

  it('Voladizo con Contrapeso: R_A = W·(x_B − x̄_CM)/L', () => {
    const a = analyzePreset(PRESETS[1] as Preset);
    const xCM = a.centerOfMass.x.value as number;
    close(a.reactions?.RA, (90 * G * (30 - xCM)) / 40);
    close(a.reactions?.RB, (90 * G * (xCM + 10)) / 40);
  });
});

describe('momento de inercia respecto al pivote', () => {
  const block: RectShape = { id: 'r', name: 'R', kind: 'rect', b: 20, h: 10, m: 6, x: 0, y: 0, flipX: false, flipY: false };
  const bm = 0.2;
  const hm = 0.1;

  it('respecto al centro: m(b² + h²)/12', () => {
    const p = shapeProperties(block) as ShapeProperties;
    close(inertiaAboutPivot([block], p.cx, p.cy), (6 * (bm * bm + hm * hm)) / 12, 1e-12);
  });

  it('respecto a una esquina: m(b² + h²)/3', () => {
    close(inertiaAboutPivot([block], 20, 0), (6 * (bm * bm + hm * hm)) / 3, 1e-12);
  });

  it('círculo respecto a su centro: m·r²/2 (kg·m²)', () => {
    const disc: CircleShape = { id: 'c', name: 'C', kind: 'circle', r: 10, m: 8, x: 0, y: 0, flipX: false, flipY: false };
    // Centro en (10, 10): I = m·r²/2 con r en metros → 8·0.01/2 = 0.04 kg·m².
    close(inertiaAboutPivot([disc], 10, 10), (8 * 0.1 * 0.1) / 2, 1e-12);
  });
});

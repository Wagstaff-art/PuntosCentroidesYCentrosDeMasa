import { describe, expect, it } from 'vitest';
import { chooseGridSteps, fitCamera, panBy, screenToWorld, worldToScreen, zoomAt, type Camera } from './camera';
import { densityShade } from './density';
import { ZOOM_MAX, ZOOM_MIN } from './limits';

const size = { w: 800, h: 600 };
const cam: Camera = { zoom: 1.5, cx: 12, cy: -4 };

describe('cámara', () => {
  it('worldToScreen y screenToWorld son inversas y el eje y apunta hacia arriba', () => {
    const p = { x: 37.5, y: 81 };
    const back = screenToWorld(cam, size, worldToScreen(cam, size, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    expect(worldToScreen(cam, size, { x: 0, y: 10 }).y).toBeLessThan(worldToScreen(cam, size, { x: 0, y: 0 }).y);
  });

  it('zoomAt mantiene fijo el punto bajo el cursor y respeta el rango 0.2×–8×', () => {
    const cursor = { x: 640, y: 120 };
    const before = screenToWorld(cam, size, cursor);
    const z = zoomAt(cam, size, cursor, 3.7);
    const after = screenToWorld(z, size, cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomAt(cam, size, cursor, 100).zoom).toBe(ZOOM_MAX);
    expect(zoomAt(cam, size, cursor, 0.001).zoom).toBe(ZOOM_MIN);
  });

  it('panBy desplaza el mundo con el cursor', () => {
    const p = { x: 5, y: 5 };
    const s0 = worldToScreen(cam, size, p);
    const s1 = worldToScreen(panBy(cam, 30, -20), size, p);
    expect(s1.x - s0.x).toBeCloseTo(30, 9);
    expect(s1.y - s0.y).toBeCloseTo(-20, 9);
  });

  it('fitCamera encuadra los límites dentro del área útil', () => {
    const pad = { top: 50, right: 40, bottom: 100, left: 60 };
    const b = { minX: -30, minY: 0, maxX: 30, maxY: 60 };
    const c = fitCamera(b, size, pad);
    const tl = worldToScreen(c, size, { x: b.minX, y: b.maxY });
    const br = worldToScreen(c, size, { x: b.maxX, y: b.minY });
    expect(tl.x).toBeGreaterThanOrEqual(pad.left - 1e-6);
    expect(tl.y).toBeGreaterThanOrEqual(pad.top - 1e-6);
    expect(br.x).toBeLessThanOrEqual(size.w - pad.right + 1e-6);
    expect(br.y).toBeLessThanOrEqual(size.h - pad.bottom + 1e-6);
  });

  it('subdivisiones adaptativas de la cuadrícula', () => {
    expect(chooseGridSteps(0.8)).toEqual({ minor: 10, major: 50 });
    expect(chooseGridSteps(4)).toEqual({ minor: 5, major: 10 });
    expect(chooseGridSteps(32)).toEqual({ minor: 1, major: 5 });
    expect(chooseGridSteps(1.6).minor).toBe(5);
  });
});

describe('sombreado por densidad', () => {
  it('densidades iguales → opacidad 0.6 sin rayado', () => {
    expect(densityShade(0.1, { min: 0.1, max: 0.1 })).toMatchObject({ opacity: 0.6, hatchSpacing: null });
    expect(densityShade(0.1, null).hatchSpacing).toBeNull();
  });

  it('ρmin → 0.25, ρmax → 0.95 y rayado más denso a mayor ρ', () => {
    const range = { min: 0.01, max: 0.4 };
    const lo = densityShade(0.01, range);
    const mid = densityShade(0.2, range);
    const hi = densityShade(0.4, range);
    expect(lo.opacity).toBeCloseTo(0.25, 9);
    expect(hi.opacity).toBeCloseTo(0.95, 9);
    expect(mid.opacity).toBeGreaterThan(lo.opacity);
    expect(hi.hatchSpacing ?? 0).toBeLessThan(mid.hatchSpacing ?? 0);
    expect(mid.hatchSpacing ?? 0).toBeLessThan(lo.hatchSpacing ?? 0);
  });
});

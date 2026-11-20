import { describe, expect, it } from 'vitest';
import { PRESETS, presetToSnapshot, type Preset } from '../data/presets';
import { analyzeModel } from './physics';
import {
  SIM_DT,
  SETTLE_HEIGHT_CM,
  advanceTip,
  angularAcceleration,
  createTipSetup,
  initialTipState,
  leverArm,
  rotateAbout,
  settleOffset,
  torqueAboutPivot,
  type TipSetup,
  type TipState,
} from './dynamics';
import type { RectShape, Shape } from '../types';

function setupFor(id: string): { setup: TipSetup; shapes: Shape[] } {
  const p = PRESETS.find((x) => x.id === id) as Preset;
  const s = presetToSnapshot(p);
  const setup = createTipSetup(s.shapes, analyzeModel(s.shapes, s.supports));
  expect(setup).not.toBeNull();
  return { setup: setup as TipSetup, shapes: s.shapes };
}

function runToEnd(setup: TipSetup, frame: number): TipState {
  let s = initialTipState(setup);
  for (let i = 0; i < 100000 && !s.finished; i += 1) s = advanceTip(s, setup, frame);
  return s;
}

describe('vuelco de cuerpo rígido', () => {
  it('modelos estables no generan simulación de vuelco', () => {
    const s = presetToSnapshot(PRESETS[0] as Preset);
    expect(createTipSetup(s.shapes, analyzeModel(s.shapes, s.supports))).toBeNull();
  });

  it('preset 4: gira en sentido horario alrededor de B hasta el impacto del vértice (40, 10)', () => {
    const { setup } = setupFor('trampa-densidad');
    expect(setup.pivotLabel).toBe('B');
    expect(setup.px).toBe(20);
    expect(setup.direction).toBe(-1);
    expect(setup.endReason).toBe('impacto');
    expect(setup.impactVertex).toEqual({ x: 40, y: 10 });
    expect(setup.endAngle).toBeCloseTo(-Math.atan2(10, 20), 12);
  });

  it('preset 3: impacto del vértice (40, 10) a −atan(10/30)', () => {
    const { setup } = setupFor('colapso-geometria');
    expect(setup.pivotLabel).toBe('B');
    expect(setup.endAngle).toBeCloseTo(-Math.atan2(10, 30), 12);
  });

  it('α(0) = −M·g·r_x / I_P', () => {
    const { setup } = setupFor('trampa-densidad');
    expect(angularAcceleration(0, setup)).toBeCloseTo((-setup.mass * setup.g * setup.rx) / setup.inertia, 12);
    expect(angularAcceleration(0, setup)).toBeLessThan(0);
  });

  it('termina en el ángulo de impacto con ω = 0 (impacto inelástico)', () => {
    const { setup } = setupFor('trampa-densidad');
    const end = runToEnd(setup, 1 / 60);
    expect(end.finished).toBe(true);
    expect(end.theta).toBe(setup.endAngle);
    expect(end.omega).toBe(0);
    expect(end.t).toBeGreaterThan(0);
    expect(end.t).toBeLessThan(5);
  });

  it('es independiente de los FPS (paso fijo con acumulador)', () => {
    const { setup } = setupFor('colapso-geometria');
    let a = initialTipState(setup);
    let b = initialTipState(setup);
    for (let i = 0; i < 18; i += 1) a = advanceTip(a, setup, 1 / 60);
    for (let i = 0; i < 9; i += 1) b = advanceTip(b, setup, 1 / 30);
    expect(a.t).toBeCloseTo(b.t, 12);
    expect(a.theta).toBeCloseTo(b.theta, 12);
    expect(runToEnd(setup, 1 / 144).t).toBeCloseTo(runToEnd(setup, 1 / 24).t, 9);
  });

  it('conserva aproximadamente la energía antes del impacto', () => {
    const block: RectShape = { id: 'q', name: 'Q', kind: 'rect', b: 20, h: 60, m: 10, x: 0, y: 0, flipX: false, flipY: false };
    const a = analyzeModel([block], { xA: -10, xB: 5 });
    const setup = createTipSetup([block], a) as TipSetup;
    expect(setup).not.toBeNull();
    let s = initialTipState(setup);
    while (!s.finished && Math.abs(s.theta) < Math.abs(setup.endAngle) * 0.8) s = advanceTip(s, setup, SIM_DT);
    const cm0 = { x: 10, y: 30 };
    const cm = rotateAbout(cm0, setup.px, setup.py, s.theta);
    const drop = (cm0.y - cm.y) / 100;
    const kinetic = 0.5 * setup.inertia * s.omega * s.omega;
    const potential = setup.mass * setup.g * drop;
    expect(potential).toBeGreaterThan(0);
    expect(Math.abs(kinetic - potential) / potential).toBeLessThan(0.05);
  });

  it('base de ancho nulo con el CM sobre el pivote: arranca con una perturbación y termina', () => {
    const block: RectShape = { id: 'q', name: 'Q', kind: 'rect', b: 20, h: 20, m: 5, x: -10, y: 0, flipX: false, flipY: false };
    const a = analyzeModel([block], { xA: 0, xB: 0 });
    const setup = createTipSetup([block], a) as TipSetup;
    expect(setup).not.toBeNull();
    const end = runToEnd(setup, 1 / 60);
    expect(end.finished).toBe(true);
    expect(Number.isFinite(end.theta)).toBe(true);
  });
});

describe('efectos de gravedad y torque', () => {
  it('torqueAboutPivot(θ) = α(θ)·I_P y en θ=0 es −M·g·r_x', () => {
    const { setup } = setupFor('trampa-densidad');
    for (const th of [0, -0.3]) {
      expect(torqueAboutPivot(th, setup)).toBeCloseTo(angularAcceleration(th, setup) * setup.inertia, 10);
    }
    expect(torqueAboutPivot(0, setup)).toBeCloseTo(-setup.mass * setup.g * setup.rx, 10);
  });

  it('leverArm es la distancia horizontal |r_x cosθ − r_y sinθ|', () => {
    const { setup } = setupFor('trampa-densidad');
    expect(leverArm(0, setup)).toBeCloseTo(Math.abs(setup.rx), 10);
    const th = -0.2;
    expect(leverArm(th, setup)).toBeCloseTo(
      Math.abs(setup.rx * Math.cos(th) - setup.ry * Math.sin(th)),
      12,
    );
  });

  it('settleOffset: caída libre desde 8 cm, aterriza en sqrt(2·0.08/g)', () => {
    const g = 9.81;
    const tL = Math.sqrt((2 * 0.08) / g);
    expect(settleOffset(0, g).offsetCm).toBeCloseTo(SETTLE_HEIGHT_CM, 10);
    expect(settleOffset(0, g).landed).toBe(false);
    const atLand = settleOffset(tL, g);
    expect(atLand.offsetCm).toBe(0);
    expect(atLand.landed).toBe(true);
    let prev = SETTLE_HEIGHT_CM;
    for (let t = 0.01; t < tL; t += 0.01) {
      const { offsetCm } = settleOffset(t, g);
      expect(offsetCm).toBeLessThan(prev);
      prev = offsetCm;
    }
  });
});

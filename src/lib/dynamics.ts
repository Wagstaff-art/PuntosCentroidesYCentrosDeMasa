import type { Shape, SupportId } from '../types';
import { EPS, inertiaAboutPivot, type MassAnalysis } from './physics';
import { shapeGeometry, worldPolygon } from './shapes';

/** Paso fijo de integración en s. */
export const SIM_DT = 1 / 120;
/** Tiempo máximo que se acumula por frame (evita la "espiral de la muerte" tras una pestaña inactiva). */
export const MAX_FRAME_TIME = 0.25;
/** Límite de seguridad del tiempo simulado en s. */
export const MAX_SIM_TIME = 20;
/** Velocidad angular inicial (rad/s) cuando el CM está exactamente sobre el pivote (equilibrio inestable). */
export const PERTURBATION_OMEGA = 0.05;

/** Configuración constante del vuelco de cuerpo rígido en torno al pivote crítico. */
export interface TipSetup {
  pivotLabel: SupportId;
  /** Pivote P en cm. */
  px: number;
  py: number;
  /** r = CM − P en m. */
  rx: number;
  ry: number;
  /** Masa total en kg. */
  mass: number;
  /** Gravedad en m/s². */
  g: number;
  /** I_P en kg·m². */
  inertia: number;
  /** +1 antihorario, −1 horario. */
  direction: 1 | -1;
  /** Ángulo final con signo (rad): primer impacto contra el suelo o ±90°. */
  endAngle: number;
  endReason: 'impacto' | 'noventa';
  /** Vértice (cm, coordenadas iniciales) que impacta contra el suelo. */
  impactVertex: { x: number; y: number } | null;
}

/** Estado dinámico del vuelco. */
export interface TipState {
  /** Ángulo girado en rad (positivo antihorario). */
  theta: number;
  /** Velocidad angular en rad/s. */
  omega: number;
  /** Tiempo simulado en s. */
  t: number;
  /** Acumulador de tiempo real pendiente de integrar, en s. */
  acc: number;
  finished: boolean;
}

export type SimMode = 'idle' | 'forces' | 'tipping';

/** Instantánea publicada a la UI y al lienzo. */
export interface SimSnapshot {
  mode: SimMode;
  setup: TipSetup | null;
  state: TipState | null;
  /** performance.now() al iniciar el modo 'forces' (anima el crecimiento de las flechas). */
  startedAt?: number;
}

export const IDLE_SIM: SimSnapshot = { mode: 'idle', setup: null, state: null };

/** Vértices del contorno de la figura en coordenadas del mundo (candidatos a punto de impacto). */
function contourVertices(s: Shape): [number, number][] {
  const r = shapeGeometry(s);
  if (!r.ok) return [];
  return worldPolygon(s, r.geom).map((p) => [p.x, p.y]);
}

/**
 * Prepara el vuelco alrededor del pivote crítico. Devuelve null si el modelo es estable o no tiene masa.
 * El ángulo final se obtiene analíticamente: un vértice (dx, dy) respecto a P, con dy > 0, toca y = 0
 * cuando su ángulo polar β + θ vale 0 (giro horario) o π (giro antihorario). Se excluyen el pivote y
 * los vértices que ya están en y ≤ 0. Los vértices candidatos son los del contorno de cada figura.
 * @param shapes Figuras del modelo (cm, kg).
 * @param a Resultado de `analyzeModel`.
 */
export function createTipSetup(shapes: readonly Shape[], a: MassAnalysis): TipSetup | null {
  const st = a.stability;
  const xCM = a.centerOfMass.x.value;
  const yCM = a.centerOfMass.y.value;
  if (a.status !== 'inestable' || !st || st.pivot === null || st.pivotX === null || xCM === null || yCM === null) {
    return null;
  }
  const px = st.pivotX;
  const py = 0;
  const inertia = inertiaAboutPivot(shapes, px, py);
  if (inertia <= EPS) return null;
  const rx = (xCM - px) / 100;
  const ry = (yCM - py) / 100;
  const direction: 1 | -1 = rx < -EPS ? 1 : -1;

  let endAngle = (direction * Math.PI) / 2;
  let endReason: TipSetup['endReason'] = 'noventa';
  let impactVertex: TipSetup['impactVertex'] = null;
  for (const s of shapes) {
    for (const [vx, vy] of contourVertices(s)) {
      const dx = vx - px;
      const dy = vy - py;
      if (dy <= 1e-9) continue;
      const beta = Math.atan2(dy, dx);
      const contact = direction < 0 ? -beta : Math.PI - beta;
      if (Math.abs(contact) < Math.abs(endAngle)) {
        endAngle = contact;
        endReason = 'impacto';
        impactVertex = { x: vx, y: vy };
      }
    }
  }

  return { pivotLabel: st.pivot, px, py, rx, ry, mass: a.totalMass, g: a.g, inertia, direction, endAngle, endReason, impactVertex };
}

/**
 * Aceleración angular α = −M·g·(r_x cosθ − r_y sinθ)/I_P (θ positivo antihorario).
 */
export function angularAcceleration(theta: number, s: TipSetup): number {
  return (-s.mass * s.g * (s.rx * Math.cos(theta) - s.ry * Math.sin(theta))) / s.inertia;
}

/** Estado inicial en reposo (con una perturbación mínima si el CM está justo sobre el pivote). */
export function initialTipState(s: TipSetup): TipState {
  const omega = Math.abs(s.rx) < EPS ? s.direction * PERTURBATION_OMEGA : 0;
  const finished = Math.abs(s.endAngle) < 1e-9;
  return { theta: finished ? s.endAngle : 0, omega: finished ? 0 : omega, t: 0, acc: 0, finished };
}

/**
 * Un paso de Euler semi-implícito (ω += α·dt; θ += ω·dt). Al alcanzar el ángulo final aplica
 * un impacto inelástico (ω = 0) y marca el estado como terminado.
 */
export function stepTip(s: TipState, setup: TipSetup): TipState {
  if (s.finished) return s;
  const omega = s.omega + angularAcceleration(s.theta, setup) * SIM_DT;
  const theta = s.theta + omega * SIM_DT;
  const t = s.t + SIM_DT;
  const reached = Math.sign(theta) === Math.sign(setup.endAngle) && Math.abs(theta) >= Math.abs(setup.endAngle);
  if (reached) return { theta: setup.endAngle, omega: 0, t, acc: s.acc, finished: true };
  if (t >= MAX_SIM_TIME) return { theta, omega: 0, t, acc: s.acc, finished: true };
  return { theta, omega, t, acc: s.acc, finished: false };
}

/**
 * Avanza la simulación con paso fijo `SIM_DT` usando un acumulador de tiempo real,
 * de modo que el resultado no depende de los FPS.
 * @param elapsed Tiempo real transcurrido desde el último frame, en s.
 */
export function advanceTip(s: TipState, setup: TipSetup, elapsed: number): TipState {
  let next: TipState = { ...s, acc: s.acc + Math.min(Math.max(elapsed, 0), MAX_FRAME_TIME) };
  while (!next.finished && next.acc >= SIM_DT - 1e-12) {
    next = stepTip({ ...next, acc: next.acc - SIM_DT }, setup);
  }
  return next;
}

/** Rota el punto p (cm) un ángulo θ alrededor de (px, py). */
export function rotateAbout(p: { x: number; y: number }, px: number, py: number, theta: number): { x: number; y: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dx = p.x - px;
  const dy = p.y - py;
  return { x: px + dx * c - dy * s, y: py + dx * s + dy * c };
}

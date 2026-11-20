import type { RectShape, Shape, SupportId, Supports } from '../types';
import { POLYGON_LIMITS, SHAPE_LIMITS, SUPPORT_LIMIT, clamp, roundTo } from '../lib/limits';
import type { ShapeField } from '../types';

export interface ModelSnapshot {
  presetId: string | null;
  name: string;
  shapes: Shape[];
  supports: Supports;
}

export interface ModelState extends ModelSnapshot {
  selectedId: string | null;
  snap: boolean;
  seq: number;
  initial: ModelSnapshot;
}

/** Parche parcial de una figura (solo los campos propios de su tipo se aplican). */
export type ShapePatch = Partial<Shape> & { name?: string };

export type ModelAction =
  | { type: 'shape/add' }
  | { type: 'shape/insert'; shape: Shape }
  | { type: 'shape/duplicate'; id: string }
  | { type: 'shape/delete'; id: string }
  | { type: 'shape/select'; id: string | null }
  | { type: 'shape/update'; id: string; patch: ShapePatch }
  | { type: 'support/set'; support: SupportId; x: number }
  | { type: 'snap/set'; value: boolean }
  | { type: 'model/load'; snapshot: ModelSnapshot }
  | { type: 'model/rename'; name: string }
  | { type: 'model/reset' };

const COMMON_FIELDS: readonly ShapeField[] = ['m', 'x', 'y'];
const NAME_MAX = 40;

export const DEFAULT_SNAPSHOT: ModelSnapshot = {
  presetId: null,
  name: 'Modelo inicial',
  shapes: [
    { id: 'b1', name: 'Figura 1', kind: 'rect', b: 60, h: 10, m: 20, x: -30, y: 0, flipX: false, flipY: false },
    { id: 'b2', name: 'Figura 2', kind: 'rect', b: 30, h: 30, m: 15, x: -15, y: 10, flipX: false, flipY: false },
  ],
  supports: { xA: -30, xB: 30 },
};

const KIND_KEYS: Readonly<Record<Shape['kind'], readonly string[]>> = {
  rect: ['b', 'h'],
  triangle: ['b', 'h', 'apex'],
  circle: ['r'],
  semicircle: ['r'],
  quarter: ['r'],
  trapezoid: ['b', 'a', 'h', 'offset'],
  polygon: ['points'],
  equation: ['f', 'g', 'a', 'b'],
};

/** Devuelve una copia de la figura con todas sus magnitudes dentro de rango. */
export function clampShape(shape: Shape): Shape {
  const clean: Record<string, unknown> = {
    id: shape.id,
    name: shape.name,
    kind: shape.kind,
    m: shape.m,
    x: shape.x,
    y: shape.y,
    flipX: shape.flipX,
    flipY: shape.flipY,
  };
  for (const k of KIND_KEYS[shape.kind]) clean[k] = (shape as unknown as Record<string, unknown>)[k];
  const out = clean;
  const numeric = new Set<string>([...COMMON_FIELDS, ...numericFieldsOf(shape)]);
  for (const f of numeric) {
    const lim = SHAPE_LIMITS[f as ShapeField];
    if (lim) out[f] = roundTo(clamp(out[f] as number, lim.min, lim.max), 4);
  }
  if (shape.kind === 'polygon') {
    const pts = shape.points.map((p) => ({
      x: clamp(p.x, 0, POLYGON_LIMITS.coordMax),
      y: clamp(p.y, 0, POLYGON_LIMITS.coordMax),
    }));
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    out.points = pts.map((p) => ({ x: roundTo(p.x - minX, 4), y: roundTo(p.y - minY, 4) }));
  }
  if (shape.kind === 'equation') {
    out.a = clamp(shape.a, -300, 300);
    out.b = clamp(shape.b, -300, 300);
    if (!(shape.b > shape.a)) {
      out.a = Math.min(shape.a, shape.b);
      out.b = Math.max(shape.a, shape.b);
    }
  }
  const name = shape.name.slice(0, NAME_MAX);
  out.name = name.trim().length > 0 ? name : 'Figura';
  return out as unknown as Shape;
}

/** Campos numéricos propios de cada tipo (además de m, x, y). */
export function numericFieldsOf(shape: Shape): readonly ShapeField[] {
  switch (shape.kind) {
    case 'rect':
      return ['b', 'h'];
    case 'triangle':
      return ['b', 'h', 'apex'];
    case 'circle':
    case 'semicircle':
    case 'quarter':
      return ['r'];
    case 'trapezoid':
      return ['b', 'a', 'h', 'offset'];
    case 'polygon':
    case 'equation':
      return [];
  }
}

function cloneSnapshot(s: ModelSnapshot): ModelSnapshot {
  return {
    presetId: s.presetId,
    name: s.name,
    shapes: s.shapes.map((b) => clampShape(b)),
    supports: {
      xA: clamp(s.supports.xA, SUPPORT_LIMIT.min, SUPPORT_LIMIT.max),
      xB: clamp(s.supports.xB, SUPPORT_LIMIT.min, SUPPORT_LIMIT.max),
    },
  };
}

/** Crea el estado completo del modelo a partir de una instantánea. */
export function createModelState(snapshot: ModelSnapshot = DEFAULT_SNAPSHOT, snap = true): ModelState {
  const working = cloneSnapshot(snapshot);
  return {
    ...working,
    selectedId: working.shapes[0]?.id ?? null,
    snap,
    seq: working.shapes.length + 1,
    initial: cloneSnapshot(snapshot),
  };
}

function nextId(state: ModelState): { id: string; seq: number } {
  let seq = state.seq;
  while (state.shapes.some((b) => b.id === `b${seq}`)) seq += 1;
  return { id: `b${seq}`, seq: seq + 1 };
}

function sameShape(a: Shape, b: Shape): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function modelReducer(state: ModelState, action: ModelAction): ModelState {
  switch (action.type) {
    case 'shape/add': {
      const { id, seq } = nextId(state);
      const top = state.shapes.reduce((acc, b) => Math.max(acc, b.y + shapeHeight(b)), 0);
      const shape = clampShape({
        id,
        name: `Figura ${seq - 1}`,
        kind: 'rect',
        b: 20,
        h: 10,
        m: 5,
        x: -10,
        y: top,
        flipX: false,
        flipY: false,
      } as RectShape);
      return { ...state, shapes: [...state.shapes, shape], selectedId: id, seq };
    }
    case 'shape/insert': {
      let { id, seq } = nextId(state);
      if (action.shape.id && !state.shapes.some((b) => b.id === action.shape.id)) id = action.shape.id;
      const name = action.shape.name.trim() || `Figura ${seq - 1}`;
      const shape = clampShape({ ...action.shape, id, name });
      return { ...state, shapes: [...state.shapes, shape], selectedId: id, seq };
    }
    case 'shape/duplicate': {
      const src = state.shapes.find((b) => b.id === action.id);
      if (!src) return state;
      const { id, seq } = nextId(state);
      const copy = clampShape({ ...src, id, name: `${src.name} (copia)`, x: src.x + 10 });
      const index = state.shapes.indexOf(src);
      const shapes = [...state.shapes.slice(0, index + 1), copy, ...state.shapes.slice(index + 1)];
      return { ...state, shapes, selectedId: id, seq };
    }
    case 'shape/delete': {
      const index = state.shapes.findIndex((b) => b.id === action.id);
      if (index < 0) return state;
      const shapes = state.shapes.filter((b) => b.id !== action.id);
      let selectedId = state.selectedId;
      if (selectedId === action.id) {
        selectedId = shapes[Math.min(index, shapes.length - 1)]?.id ?? null;
      }
      return { ...state, shapes, selectedId };
    }
    case 'shape/select': {
      if (action.id !== null && !state.shapes.some((b) => b.id === action.id)) return state;
      return { ...state, selectedId: action.id };
    }
    case 'shape/update': {
      let changed = false;
      const shapes = state.shapes.map((b) => {
        if (b.id !== action.id) return b;
        const next = clampShape({ ...b, ...action.patch, id: b.id, kind: b.kind } as Shape);
        if (sameShape(next, b)) return b;
        changed = true;
        return next;
      });
      return changed ? { ...state, shapes } : state;
    }
    case 'support/set': {
      const x = roundTo(clamp(action.x, SUPPORT_LIMIT.min, SUPPORT_LIMIT.max), 4);
      if ((action.support === 'A' ? state.supports.xA : state.supports.xB) === x) return state;
      const supports: Supports =
        action.support === 'A' ? { ...state.supports, xA: x } : { ...state.supports, xB: x };
      return { ...state, supports };
    }
    case 'snap/set':
      return { ...state, snap: action.value };
    case 'model/load':
      return createModelState(action.snapshot, state.snap);
    case 'model/rename': {
      const name = action.name.slice(0, NAME_MAX);
      if (name === state.name) return state;
      return { ...state, name };
    }
    case 'model/reset':
      return { ...createModelState(state.initial, state.snap), seq: Math.max(state.seq, state.initial.shapes.length + 1) };
  }
}

/** Alto de la caja envolvente usado para apilar figuras nuevas (aprox. por tipo). */
function shapeHeight(s: Shape): number {
  switch (s.kind) {
    case 'rect':
    case 'triangle':
      return s.h;
    case 'circle':
      return 2 * s.r;
    case 'semicircle':
    case 'quarter':
      return s.r;
    case 'trapezoid':
      return s.h;
    case 'polygon':
      return s.points.reduce((acc, p) => Math.max(acc, p.y), 0);
    case 'equation':
      return 10;
  }
}

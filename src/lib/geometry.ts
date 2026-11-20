import type { Shape } from '../types';
import {
  clipArea,
  isConvex,
  polygonDistance,
  polygonsOverlap,
  shapeGeometry,
  worldPolygon,
  type Pt,
} from './shapes';

/** Tolerancia de contacto en cm (distancia 0 incluye el contacto en un solo vértice). */
const CONTACT_TOL = 0.01;

/** Par de figuras cuya intersección tiene área positiva. */
export interface OverlapPair {
  a: string;
  b: string;
  /** Área de intersección en cm², o null si ninguna envolvente es convexa. */
  area: number | null;
}

/** Avisos geométricos no bloqueantes del modelo. */
export interface GeometryWarnings {
  overlaps: OverlapPair[];
  overlapIds: ReadonlySet<string>;
  /** Figuras sin contacto con el suelo ni con otra figura. */
  floatingIds: ReadonlySet<string>;
}

interface WorldShape {
  id: string;
  polygon: Pt[];
  minY: number;
  convex: boolean;
}

function toWorld(s: Shape): WorldShape | null {
  const r = shapeGeometry(s);
  if (!r.ok) return null;
  const polygon = worldPolygon(s, r.geom);
  return { id: s.id, polygon, minY: Math.min(...polygon.map((p) => p.y)), convex: isConvex(polygon) };
}

/**
 * Área de intersección entre dos figuras (≥ 0), o null si no se puede
 * recortar (ambas envolventes no convexas). Devuelve 0 si solo se tocan.
 */
export function intersectionArea(p: Shape, q: Shape): number | null {
  const wp = toWorld(p);
  const wq = toWorld(q);
  if (!wp || !wq) return null;
  if (wp.convex) return clipArea(wq.polygon, wp.polygon);
  if (wq.convex) return clipArea(wp.polygon, wq.polygon);
  return null;
}

/** Indica si dos figuras se tocan o se solapan (distancia 0, incluido el contacto puntual). */
export function touches(p: Shape, q: Shape): boolean {
  const wp = toWorld(p);
  const wq = toWorld(q);
  if (!wp || !wq) return false;
  return polygonDistance(wp.polygon, wq.polygon) <= CONTACT_TOL;
}

/** Indica si una figura toca o atraviesa el suelo y = 0. */
export function touchesGround(s: Shape): boolean {
  const w = toWorld(s);
  if (!w) return false;
  return w.minY <= CONTACT_TOL;
}

/**
 * Detecta solapamientos (área > 0) y figuras flotantes sin ningún contacto.
 * El contacto en un solo vértice cuenta como contacto.
 * @param shapes Figuras del modelo.
 */
export function analyzeGeometry(shapes: readonly Shape[]): GeometryWarnings {
  const overlaps: OverlapPair[] = [];
  const overlapIds = new Set<string>();
  const contact = new Set<string>();

  const world = shapes.map(toWorld);

  world.forEach((p, i) => {
    if (!p) return;
    if (p.minY <= CONTACT_TOL) contact.add(p.id);
    for (let j = i + 1; j < world.length; j += 1) {
      const q = world[j];
      if (!q) continue;
      const d = polygonDistance(p.polygon, q.polygon);
      if (d <= CONTACT_TOL) {
        contact.add(p.id);
        contact.add(q.id);
      }
      if (polygonsOverlap(p.polygon, q.polygon)) {
        const area = p.convex ? clipArea(q.polygon, p.polygon) : q.convex ? clipArea(p.polygon, q.polygon) : null;
        overlaps.push({ a: p.id, b: q.id, area });
        overlapIds.add(p.id);
        overlapIds.add(q.id);
        contact.add(p.id);
        contact.add(q.id);
      }
    }
  });

  const floatingIds = new Set(world.filter((w) => w !== null && !contact.has(w.id)).map((w) => (w as WorldShape).id));
  return { overlaps, overlapIds, floatingIds };
}

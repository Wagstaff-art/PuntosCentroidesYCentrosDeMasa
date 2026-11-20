import { ZOOM_MAX, ZOOM_MIN, clamp } from './limits';

/** Píxeles CSS por centímetro con zoom 1×. */
export const PX_PER_CM = 4;

/** Cámara 2D: (cx, cy) es el punto del mundo (cm) que se ve en el centro del lienzo. */
export interface Camera {
  zoom: number;
  cx: number;
  cy: number;
}

export interface ViewSize {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Escala en píxeles por cm. */
export function scaleOf(cam: Camera): number {
  return PX_PER_CM * cam.zoom;
}

/** Mundo (cm, y hacia arriba) → pantalla (px, y hacia abajo). */
export function worldToScreen(cam: Camera, size: ViewSize, p: Point): Point {
  const s = scaleOf(cam);
  return { x: size.w / 2 + (p.x - cam.cx) * s, y: size.h / 2 - (p.y - cam.cy) * s };
}

/** Pantalla (px) → mundo (cm). */
export function screenToWorld(cam: Camera, size: ViewSize, p: Point): Point {
  const s = scaleOf(cam);
  return { x: cam.cx + (p.x - size.w / 2) / s, y: cam.cy - (p.y - size.h / 2) / s };
}

/** Cambia el zoom manteniendo fijo el punto del mundo bajo `screen` (zoom centrado en el cursor). */
export function zoomAt(cam: Camera, size: ViewSize, screen: Point, zoom: number): Camera {
  const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  const p = screenToWorld(cam, size, screen);
  const s = PX_PER_CM * z;
  return { zoom: z, cx: p.x - (screen.x - size.w / 2) / s, cy: p.y + (screen.y - size.h / 2) / s };
}

/** Desplaza la cámara siguiendo un arrastre de (dx, dy) píxeles. */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  const s = scaleOf(cam);
  return { ...cam, cx: cam.cx - dx / s, cy: cam.cy + dy / s };
}

/** Cámara que encuadra `b` dentro del área útil del lienzo descontando `pad`. */
export function fitCamera(b: Bounds, size: ViewSize, pad: Padding): Camera {
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const availW = Math.max(size.w - pad.left - pad.right, 40);
  const availH = Math.max(size.h - pad.top - pad.bottom, 40);
  const zoom = clamp(Math.min(availW / bw, availH / bh) / PX_PER_CM, ZOOM_MIN, ZOOM_MAX);
  const s = PX_PER_CM * zoom;
  const rcx = pad.left + availW / 2;
  const rcy = pad.top + availH / 2;
  const bx = (b.minX + b.maxX) / 2;
  const by = (b.minY + b.maxY) / 2;
  return { zoom, cx: bx - (rcx - size.w / 2) / s, cy: by + (rcy - size.h / 2) / s };
}

const GRID_LEVELS = [1, 5, 10, 50, 100] as const;

/**
 * Subdivisiones adaptativas de la cuadrícula (1, 5, 10, 50, 100 cm):
 * la menor con al menos 8 px y la mayor (con etiquetas) con al menos 40 px.
 */
export function chooseGridSteps(pxPerCm: number): { minor: number; major: number } {
  const minor = GRID_LEVELS.find((l) => l * pxPerCm >= 8) ?? 100;
  const major = GRID_LEVELS.find((l) => l > minor && l * pxPerCm >= 40) ?? minor * 10;
  return { minor, major };
}

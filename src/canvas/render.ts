import type { MassAnalysis, ShapeProperties } from '../lib/physics';
import type { GeometryWarnings } from '../lib/geometry';
import type { SupportId } from '../types';
import { THEME } from '../theme';
import {
  chooseGridSteps,
  scaleOf,
  screenToWorld,
  worldToScreen,
  type Camera,
  type Point,
  type ViewSize,
} from '../lib/camera';
import { densityShade } from '../lib/density';
import { fmtFixed, fmtTrim } from '../lib/format';
import { leverArm, maxTorque, rotateAbout, torqueAboutPivot, type SimSnapshot } from '../lib/dynamics';

/** Alto de la regla superior y ancho de la regla izquierda, en px. */
export const RULER_TOP = 22;
export const RULER_LEFT = 44;

/** Zona (px bajo y = 0) ocupada por los símbolos de apoyo; se usa también para el hit-test. */
export const SUPPORT_HIT = { halfWidth: 14, above: 6, below: 52 } as const;

const TRI_H = 16;
const TRI_W = 11;
const BASE_DIM_OFFSET = 70;
const PLUMB_DIM_OFFSET = 96;

/** Estado visual que necesita el renderizador. */
export interface SceneState {
  analysis: MassAnalysis;
  warnings: GeometryWarnings;
  selectedId: string | null;
  hoverId: string | null;
  hoverSupport: SupportId | null;
  activeSupport: SupportId | null;
  sim: SimSnapshot;
  /** false oculta la cuadrícula (por defecto visible). */
  showGrid?: boolean;
  /** false oculta las líneas de cota (por defecto visibles). */
  showDims?: boolean;
}

const crisp = (v: number): number => Math.round(v) + 0.5;

function statusColor(a: MassAnalysis): string {
  if (a.status === 'estable') return THEME.stable;
  if (a.status === 'inestable') return THEME.danger;
  return THEME.warn;
}

function tag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'center',
): void {
  ctx.font = `10px ${THEME.fontMono}`;
  const w = ctx.measureText(text).width + 8;
  const h = 15;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
  ctx.fillRect(left, y - h / 2, w, h);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 4, y + 0.5);
}

function dimension(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  from0: number,
  from1: number,
  yDim: number,
  text: string,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(crisp(x0), from0);
  ctx.lineTo(crisp(x0), yDim + 5);
  ctx.moveTo(crisp(x1), from1);
  ctx.lineTo(crisp(x1), yDim + 5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x0, crisp(yDim));
  ctx.lineTo(x1, crisp(yDim));
  for (const x of [x0, x1]) {
    ctx.moveTo(x - 4, yDim + 4);
    ctx.lineTo(x + 4, yDim - 4);
  }
  ctx.stroke();
  tag(ctx, text, (x0 + x1) / 2, yDim - 10, color);
}

function drawGrid(ctx: CanvasRenderingContext2D, size: ViewSize, cam: Camera, toS: (x: number, y: number) => Point): void {
  const { minor, major } = chooseGridSteps(scaleOf(cam));
  const tl = screenToWorld(cam, size, { x: 0, y: 0 });
  const br = screenToWorld(cam, size, { x: size.w, y: size.h });
  const lines = (step: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.ceil(tl.x / step); k * step <= br.x; k += 1) {
      const sx = crisp(toS(k * step, 0).x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, size.h);
    }
    for (let k = Math.ceil(br.y / step); k * step <= tl.y; k += 1) {
      const sy = crisp(toS(0, k * step).y);
      ctx.moveTo(0, sy);
      ctx.lineTo(size.w, sy);
    }
    ctx.stroke();
  };
  lines(minor, THEME.gridMinor);
  lines(major, THEME.gridMajor);
}

function drawRulers(ctx: CanvasRenderingContext2D, size: ViewSize, cam: Camera, toS: (x: number, y: number) => Point): void {
  const { minor, major } = chooseGridSteps(scaleOf(cam));
  const tl = screenToWorld(cam, size, { x: 0, y: 0 });
  const br = screenToWorld(cam, size, { x: size.w, y: size.h });
  const isMajor = (v: number) => Math.abs(v / major - Math.round(v / major)) < 1e-6;

  ctx.fillStyle = THEME.panel;
  ctx.fillRect(0, 0, size.w, RULER_TOP);
  ctx.fillRect(0, 0, RULER_LEFT, size.h);
  ctx.strokeStyle = THEME.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, crisp(RULER_TOP));
  ctx.lineTo(size.w, crisp(RULER_TOP));
  ctx.moveTo(crisp(RULER_LEFT), 0);
  ctx.lineTo(crisp(RULER_LEFT), size.h);
  ctx.stroke();

  ctx.font = `9px ${THEME.fontMono}`;
  ctx.strokeStyle = THEME.axis;
  ctx.beginPath();
  for (let k = Math.ceil(tl.x / minor); k * minor <= br.x; k += 1) {
    const v = k * minor;
    const sx = crisp(toS(v, 0).x);
    if (sx < RULER_LEFT + 2) continue;
    const len = isMajor(v) ? 8 : 4;
    ctx.moveTo(sx, RULER_TOP - len);
    ctx.lineTo(sx, RULER_TOP);
    if (isMajor(v)) {
      ctx.fillStyle = Math.abs(v) < 1e-9 ? THEME.accent : THEME.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(fmtTrim(v, 2), sx + 3, 3);
    }
  }
  for (let k = Math.ceil(br.y / minor); k * minor <= tl.y; k += 1) {
    const v = k * minor;
    const sy = crisp(toS(0, v).y);
    if (sy < RULER_TOP + 2) continue;
    const len = isMajor(v) ? 8 : 4;
    ctx.moveTo(RULER_LEFT - len, sy);
    ctx.lineTo(RULER_LEFT, sy);
    if (isMajor(v)) {
      ctx.fillStyle = Math.abs(v) < 1e-9 ? THEME.accent : THEME.textMuted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtTrim(v, 2), RULER_LEFT - 10, sy);
    }
  }
  ctx.stroke();

  ctx.fillStyle = THEME.panel;
  ctx.fillRect(0, 0, RULER_LEFT, RULER_TOP);
  ctx.fillStyle = THEME.textMuted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('cm', RULER_LEFT / 2, RULER_TOP / 2);
}

function drawShape(ctx: CanvasRenderingContext2D, b: ShapeProperties, scene: SceneState, toS: (x: number, y: number) => Point): void {
  const pts = b.polygon.map((p) => toS(p.x, p.y));
  if (pts.length === 0) return;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const rx = Math.min(...xs);
  const ry = Math.min(...ys);
  const rw = Math.max(...xs) - rx;
  const rh = Math.max(...ys) - ry;
  const shade = densityShade(b.density, scene.analysis.densityRange);

  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };

  ctx.fillStyle = `rgba(56, 189, 248, ${shade.opacity})`;
  path();
  ctx.fill();

  if (shade.hatchSpacing !== null) {
    ctx.save();
    path();
    ctx.clip();
    ctx.strokeStyle = shade.opacity > 0.6 ? 'rgba(11, 15, 25, 0.45)' : 'rgba(224, 242, 254, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -rh; k < rw; k += shade.hatchSpacing) {
      ctx.moveTo(rx + k, ry + rh);
      ctx.lineTo(rx + k + rh, ry);
    }
    ctx.stroke();
    ctx.restore();
  }

  const overlap = scene.warnings.overlapIds.has(b.id);
  const selected = b.id === scene.selectedId;
  const hover = b.id === scene.hoverId;
  ctx.setLineDash(overlap ? [6, 4] : []);
  ctx.strokeStyle = overlap ? THEME.warn : THEME.accent;
  ctx.lineWidth = selected || hover ? 2 : 1.25;
  path();
  ctx.stroke();
  ctx.setLineDash([]);

  if (selected) {
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(rx - 4, ry - 4, rw + 8, rh + 8);
    ctx.setLineDash([]);
    ctx.fillStyle = '#F8FAFC';
    for (const [hx, hy] of [
      [rx - 4, ry - 4],
      [rx + rw + 4, ry - 4],
      [rx - 4, ry + rh + 4],
      [rx + rw + 4, ry + rh + 4],
    ] as const) {
      ctx.fillRect(hx - 2.5, hy - 2.5, 5, 5);
    }
  }

  const textColor = shade.opacity > 0.6 ? THEME.bg : THEME.text;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  const mass = `${fmtTrim(b.m, 2)} kg`;
  if (rw > 56 && rh > 28) {
    ctx.font = `600 11px ${THEME.fontSans}`;
    if (ctx.measureText(b.name).width < rw - 8) ctx.fillText(b.name, cx, cy - 7);
    ctx.font = `10px ${THEME.fontMono}`;
    ctx.fillText(mass, cx, cy + 7);
  } else if (rw > 34 && rh > 14) {
    ctx.font = `10px ${THEME.fontMono}`;
    if (ctx.measureText(mass).width < rw - 4) ctx.fillText(mass, cx, cy);
  }
}

function drawSupport(
  ctx: CanvasRenderingContext2D,
  label: SupportId,
  x: number,
  labelShift: number,
  gy: number,
  scene: SceneState,
  toS: (x: number, y: number) => Point,
): void {
  const sx = toS(x, 0).x;
  const active = scene.activeSupport === label || scene.hoverSupport === label;
  const color = active ? THEME.accent : THEME.text;
  const triH = label === 'A' ? TRI_H : TRI_H - 4;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = THEME.panel;
  ctx.beginPath();
  ctx.moveTo(sx, gy);
  ctx.lineTo(sx - TRI_W, gy + triH);
  ctx.lineTo(sx + TRI_W, gy + triH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  let baseY = gy + triH;
  if (label === 'B') {
    ctx.beginPath();
    ctx.arc(sx, gy + triH + 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = THEME.panel;
    ctx.fill();
    ctx.stroke();
    baseY = gy + triH + 8;
  }

  ctx.beginPath();
  ctx.moveTo(sx - 15, baseY);
  ctx.lineTo(sx + 15, baseY);
  for (let i = -15; i < 15; i += 5) {
    ctx.moveTo(sx + i, baseY + 5);
    ctx.lineTo(sx + i + 5, baseY);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sx, gy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const lx = sx + labelShift;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `700 12px ${THEME.fontSans}`;
  ctx.fillText(label, lx, gy + 28);
  ctx.font = `10px ${THEME.fontMono}`;
  ctx.fillStyle = active ? THEME.accent : THEME.textMuted;
  ctx.fillText(`x=${fmtTrim(x, 2)}`, lx, gy + 42);
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  width = 2.5,
  head = 9,
): void {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(ang) * head * 0.6, y1 - Math.sin(ang) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(ang - 0.4), y1 - head * Math.sin(ang - 0.4));
  ctx.lineTo(x1 - head * Math.cos(ang + 0.4), y1 - head * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

function niceNumber(v: number): number {
  if (!(v > 0)) return 1;
  const exp = Math.floor(Math.log10(v));
  const f = v / 10 ** exp;
  const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Longitud en px de la flecha del peso; las demás fuerzas se escalan proporcionalmente. */
const FORCE_PX = 110;

function drawForceScale(ctx: CanvasRenderingContext2D, size: ViewSize, pxPerN: number): void {
  const value = niceNumber(FORCE_PX / 2 / pxPerN);
  const len = value * pxPerN;
  const x1 = size.w - 18;
  const x0 = x1 - len;
  const y = RULER_TOP + 30;
  ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
  ctx.fillRect(x0 - 10, y - 22, len + 20, 32);
  ctx.strokeStyle = THEME.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - 4);
  ctx.lineTo(x0, y + 4);
  ctx.moveTo(x1, y - 4);
  ctx.lineTo(x1, y + 4);
  ctx.stroke();
  ctx.fillStyle = THEME.text;
  ctx.font = `10px ${THEME.fontMono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Escala: ${fmtTrim(value, 2)} N`, (x0 + x1) / 2, y - 6);
}

/** Rótulo al pie para la exportación PNG. */
export function drawCaption(ctx: CanvasRenderingContext2D, w: number, top: number, height: number, lines: readonly string[]): void {
  ctx.fillStyle = THEME.panel;
  ctx.fillRect(0, top, w, height);
  ctx.fillStyle = THEME.accent;
  ctx.fillRect(0, top, w, 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `600 13px ${THEME.fontSans}` : `11px ${THEME.fontMono}`;
    ctx.fillStyle = i === 0 ? '#F8FAFC' : THEME.textMuted;
    ctx.fillText(line, 14, top + 10 + i * 18);
  });
}

function drawCentroidMarker(ctx: CanvasRenderingContext2D, p: Point): void {
  const r = 7;
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(11, 15, 25, 0.7)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - r - 5, p.y);
  ctx.lineTo(p.x + r + 5, p.y);
  ctx.moveTo(p.x, p.y - r - 5);
  ctx.lineTo(p.x, p.y + r + 5);
  ctx.stroke();
}

function drawMassMarker(ctx: CanvasRenderingContext2D, p: Point): void {
  const r = 8;
  ctx.fillStyle = THEME.bg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = THEME.warn;
  for (const start of [-Math.PI / 2, Math.PI / 2]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, r, start, start + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = THEME.warn;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Dibuja la escena completa del lienzo CAD en coordenadas CSS (el llamador aplica el devicePixelRatio).
 */
export function drawScene(ctx: CanvasRenderingContext2D, size: ViewSize, cam: Camera, scene: SceneState): void {
  const { w, h } = size;
  const toS = (x: number, y: number): Point => worldToScreen(cam, size, { x, y });
  const a = scene.analysis;
  const origin = toS(0, 0);
  const gy = origin.y;
  const sc = statusColor(a);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, h);
  if (scene.showGrid !== false) drawGrid(ctx, size, cam, toS);

  if (gy < h) {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.28)';
    ctx.fillRect(0, Math.max(gy, 0), w, h - Math.max(gy, 0));
  }

  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, crisp(gy));
  ctx.lineTo(w, crisp(gy));
  ctx.moveTo(crisp(origin.x), 0);
  ctx.lineTo(crisp(origin.x), h);
  ctx.stroke();
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `10px ${THEME.fontMono}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x (cm)', w - 8, gy - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('y (cm)', origin.x + 6, RULER_TOP + 6);

  const { xmin, xmax } = a.base;
  const bx0 = toS(xmin, 0).x;
  const bx1 = toS(xmax, 0).x;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = sc;
  ctx.fillRect(bx0, gy - 4, Math.max(bx1 - bx0, 2), 8);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = sc;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx0, gy);
  ctx.lineTo(Math.max(bx1, bx0 + 1), gy);
  ctx.stroke();

  const sim = scene.sim;
  const tipping = sim.mode === 'tipping' && sim.setup && sim.state ? { setup: sim.setup, theta: sim.state.theta } : null;
  const rot = (p: Point): Point => (tipping ? rotateAbout(p, tipping.setup.px, tipping.setup.py, tipping.theta) : p);
  const settle = sim.mode === 'forces' ? (sim.settle ?? null) : null;
  const liftCm = settle ? settle.offsetCm : 0;
  const liftPx = liftCm * scaleOf(cam);

  if (tipping) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const b of a.shapes) {
      ctx.beginPath();
      b.polygon.forEach((p, i) => {
        const s = toS(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const ps = toS(tipping.setup.px, tipping.setup.py);
    ctx.save();
    ctx.translate(ps.x, ps.y);
    ctx.rotate(-tipping.theta);
    ctx.translate(-ps.x, -ps.y);
  }
  if (liftPx > 0.5) {
    ctx.save();
    ctx.translate(0, -liftPx);
  }
  for (const b of a.shapes) drawShape(ctx, b, scene, toS);
  if (liftPx > 0.5) ctx.restore();
  if (tipping) ctx.restore();

  const { xA, xB } = a.supports;
  const sxA = toS(xA, 0).x;
  const sxB = toS(xB, 0).x;
  const near = Math.abs(sxA - sxB) < 34;
  const dir = sxA <= sxB ? -1 : 1;
  drawSupport(ctx, 'A', xA, near ? dir * 18 : 0, gy, scene, toS);
  drawSupport(ctx, 'B', xB, near ? -dir * 18 : 0, gy, scene, toS);

  if (scene.showDims !== false)
    dimension(ctx, bx0, bx1, gy + 56, gy + 56, gy + BASE_DIM_OFFSET, `L = ${fmtFixed(a.base.width)} cm`, sc);

  const xG = a.centroid.x.value;
  const yG = a.centroid.y.value;
  const xCM = a.centerOfMass.x.value;
  const yCM = a.centerOfMass.y.value;
  if (a.status !== 'sin_masa' && xG !== null && yG !== null && xCM !== null && yCM !== null) {
    const gw = rot({ x: xG, y: yG + liftCm });
    const cw = rot({ x: xCM, y: yCM + liftCm });
    const g = toS(gw.x, gw.y);
    const c = toS(cw.x, cw.y);

    ctx.strokeStyle = THEME.warn;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(c.x, gy, 4, 0, Math.PI * 2);
    ctx.fillStyle = sc;
    ctx.fill();
    ctx.strokeStyle = THEME.bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const dA = Math.abs(cw.x - xA);
    const dB = Math.abs(cw.x - xB);
    const nearest: SupportId = tipping ? tipping.setup.pivotLabel : dA <= dB ? 'A' : 'B';
    const nx = nearest === 'A' ? sxA : sxB;
    if (scene.showDims !== false)
      dimension(
        ctx,
        c.x,
        nx,
        gy + 6,
        gy + 56,
        gy + PLUMB_DIM_OFFSET,
        `d(CM→${nearest}) = ${fmtFixed(nearest === 'A' ? dA : dB)} cm`,
        sc,
      );

    if (tipping) {
      const ps = toS(tipping.setup.px, tipping.setup.py);
      ctx.strokeStyle = THEME.danger;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      const a0 = Math.atan2(-tipping.setup.ry, tipping.setup.rx);
      const a1 = a0 - tipping.theta;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 38, a0, a1, tipping.theta > 0);
      ctx.stroke();
      tag(
        ctx,
        `θ = ${fmtFixed((tipping.theta * 180) / Math.PI, 1)}°`,
        ps.x + 46 * Math.cos(a1),
        ps.y + 46 * Math.sin(a1),
        THEME.danger,
      );
      const W = a.totalMass * a.g;
      arrow(ctx, c.x, c.y, c.x, c.y + FORCE_PX * 0.6, THEME.danger);
      tag(ctx, `W = ${fmtFixed(W)} N`, c.x + 10, c.y + FORCE_PX * 0.6 - 4, THEME.danger, 'left');
      if (sim.state?.finished && tipping.setup.impactVertex) {
        const rw = rot(tipping.setup.impactVertex);
        const ip = toS(rw.x, rw.y);
        ctx.strokeStyle = THEME.danger;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ip.x, ip.y, 9, 0, Math.PI * 2);
        ctx.stroke();
        tag(ctx, 'impacto', ip.x, ip.y - 16, THEME.danger);
      }

      // Torque en vivo: arco alrededor del pivote proporcional a |τ| + brazo de palanca.
      const tau = torqueAboutPivot(tipping.theta, tipping.setup);
      const tmax = maxTorque(tipping.setup);
      const frac = tmax > 1e-9 ? Math.min(1, Math.abs(tau) / tmax) : 0;
      const sweep = ((60 + frac * 240) * Math.PI) / 180;
      const dirS = tau >= 0 ? -1 : 1;
      const aStart = -Math.PI / 2;
      const aEnd = aStart + dirS * sweep;
      const R_T = 56;
      ctx.strokeStyle = THEME.danger;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, R_T, aStart, aEnd, dirS < 0);
      ctx.stroke();
      const ex = ps.x + R_T * Math.cos(aEnd);
      const ey = ps.y + R_T * Math.sin(aEnd);
      const tang = aEnd + (dirS > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.fillStyle = THEME.danger;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 8 * Math.cos(tang - 0.35), ey - 8 * Math.sin(tang - 0.35));
      ctx.lineTo(ex - 8 * Math.cos(tang + 0.35), ey - 8 * Math.sin(tang + 0.35));
      ctx.closePath();
      ctx.fill();
      tag(ctx, `τ_P = ${fmtFixed(tau, 2)} N·m`, ex, ey - 16, THEME.danger);
      ctx.strokeStyle = THEME.warn;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ps.x, c.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
      tag(ctx, `d = ${fmtFixed(leverArm(tipping.theta, tipping.setup) * 100, 1)} cm`, (ps.x + c.x) / 2, c.y - 12, THEME.warn);
      tag(ctx, 'g = 9,81 m/s² ↓', size.w - 18, RULER_TOP + 44, THEME.textMuted, 'right');
    }

    if (sim.mode === 'forces' && a.reactions) {
      const r = a.reactions;
      const k = FORCE_PX / r.weight;
      const now = performance.now();
      const growP = settle
        ? settle.landedAt !== null
          ? Math.min(1, (now - settle.landedAt) / 400)
          : 0
        : sim.startedAt === undefined
          ? 1
          : Math.min(1, (now - sim.startedAt) / 400);
      const grow = 1 - Math.pow(1 - growP, 3);

      // Tique de "polvo" en el aterrizaje (~300 ms).
      if (settle?.landed && settle.landedAt !== null && now - settle.landedAt < 300) {
        ctx.strokeStyle = THEME.textMuted;
        ctx.lineWidth = 1.5;
        for (const sx of [sxA, sxB]) {
          for (const dx of [-14, -7, 7, 14]) {
            ctx.beginPath();
            ctx.moveTo(sx + dx - 4, gy + 4);
            ctx.lineTo(sx + dx + 4, gy + 4);
            ctx.stroke();
          }
        }
      }

      for (const [label, x, R] of [
        ['A', xA, r.RA],
        ['B', xB, r.RB],
      ] as const) {
        const sx = toS(x, 0).x;
        const len = R * k * grow;
        if (len > 4) arrow(ctx, sx, gy, sx, gy - len, THEME.stable);
        if (grow > 0.5) tag(ctx, `R_${label} = ${fmtFixed(R)} N`, sx, gy - len - 12, THEME.stable);
      }
      arrow(ctx, c.x, c.y, c.x, c.y + r.weight * k, THEME.danger);
      tag(ctx, `W = M·g = ${fmtFixed(r.weight)} N`, c.x + 10, c.y + r.weight * k - 4, THEME.danger, 'left');
      drawForceScale(ctx, size, k);

      // Equilibrio de momentos respecto al apoyo en x_min (una vez apoyado).
      if (settle === null || settle.landed) {
        const xMin = a.base.minLabel === 'A' ? xA : xB;
        const pMin = toS(xMin, 0);
        const tauW = (r.weight * (xCM - xMin)) / 100;
        const tauR = (r.Rmax * r.L) / 100;
        const drawArcArrow = (radius: number, sweepRad: number, clockwise: boolean, color: string) => {
          const a0 = -Math.PI / 2;
          const a1 = clockwise ? a0 + sweepRad : a0 - sweepRad;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pMin.x, pMin.y, radius, a0, a1, !clockwise);
          ctx.stroke();
          const ex = pMin.x + radius * Math.cos(a1);
          const ey = pMin.y + radius * Math.sin(a1);
          const tang = a1 + (clockwise ? Math.PI / 2 : -Math.PI / 2);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 8 * Math.cos(tang - 0.35), ey - 8 * Math.sin(tang - 0.35));
          ctx.lineTo(ex - 8 * Math.cos(tang + 0.35), ey - 8 * Math.sin(tang + 0.35));
          ctx.closePath();
          ctx.fill();
        };
        drawArcArrow(34, (260 * Math.PI) / 180, true, THEME.danger);
        drawArcArrow(46, (260 * Math.PI) / 180, false, THEME.stable);
        tag(ctx, `τ_W = −${fmtFixed(tauW, 2)} N·m`, pMin.x - 30, pMin.y - 60, THEME.danger, 'right');
        tag(ctx, `τ_R = +${fmtFixed(tauR, 2)} N·m`, pMin.x + 30, pMin.y - 60, THEME.stable, 'left');
        const sxT = pMin.x;
        ctx.strokeStyle = THEME.stable;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sxT - 34, pMin.y + 66);
        ctx.lineTo(sxT - 30, pMin.y + 70);
        ctx.lineTo(sxT - 22, pMin.y + 62);
        ctx.stroke();
        tag(ctx, `Στ = ${fmtFixed(tauR - tauW, 2)} N·m`, pMin.x - 26, pMin.y + 68, THEME.stable, 'left');

        // Brazos de palanca sobre el suelo (respetan el toggle de cotas).
        if (scene.showDims !== false) {
          dimension(ctx, pMin.x, c.x, gy - 8, gy - 8, gy - 22, `d_W = ${fmtFixed(Math.abs(xCM - xMin))} cm`, THEME.warn);
          const xMax = a.base.minLabel === 'A' ? xB : xA;
          dimension(ctx, pMin.x, toS(xMax, 0).x, gy - 8, gy - 8, gy - 38, `L = ${fmtFixed(r.L)} cm`, THEME.stable);
        }
      }
    }

    // Pesos por figura w_i = m_i·g (flechas finas) en ambos modos de simulación.
    if ((sim.mode === 'forces' || tipping) && a.totalMass > 0) {
      const k = FORCE_PX / (a.totalMass * a.g);
      for (const b of a.shapes) {
        const wp = rot({ x: b.cx, y: b.cy + liftCm });
        const s = toS(wp.x, wp.y);
        const len = b.m * a.g * k;
        if (len <= 6) continue;
        arrow(ctx, s.x, s.y, s.x, s.y + len, THEME.danger, 1.2, 6);
        if (len >= 18) tag(ctx, 'w_i', s.x + 6, s.y + len / 2, THEME.danger, 'left');
        if (b.id === scene.selectedId) tag(ctx, `w_i = ${fmtFixed(b.m * a.g, 2)} N`, s.x + 8, s.y + len + 12, THEME.danger, 'left');
      }
    }

    drawCentroidMarker(ctx, g);
    drawMassMarker(ctx, c);
    tag(ctx, `G (${fmtFixed(gw.x)}, ${fmtFixed(gw.y)})`, g.x - 14, g.y - 16, THEME.accent, 'right');
    tag(ctx, `CM (${fmtFixed(cw.x)}, ${fmtFixed(cw.y)})`, c.x + 14, c.y + 18, THEME.warn, 'left');
  }

  drawRulers(ctx, size, cam, toS);
}

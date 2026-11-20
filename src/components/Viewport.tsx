import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useView, useViewActions, useViewportHandle } from '../state/ViewContext';
import { useSimulation } from '../state/SimulationContext';
import { useTools, dragPayload, SHAPE_MIME } from '../state/ToolsContext';
import { cursorStore } from '../state/cursorStore';
import { createShape, defaultShapeProto } from '../lib/shapeFactory';
import { shapeGeometry } from '../lib/shapes';
import type { ModelAction } from '../state/model';
import type { ShapeKind, SupportId } from '../types';
import type { MassAnalysis } from '../lib/physics';
import {
  fitCamera,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Bounds,
  type Camera,
  type Point,
  type ViewSize,
} from '../lib/camera';
import { fmtFixed } from '../lib/format';
import { pointInPolygon } from '../lib/shapes';
import { RULER_LEFT, RULER_TOP, SUPPORT_HIT, drawCaption, drawScene, type SceneState } from '../canvas/render';
import { CanvasLegend } from './CanvasLegend';

type Drag =
  | { kind: 'block'; id: string; dx: number; dy: number }
  | { kind: 'support'; support: SupportId }
  | { kind: 'pan'; lastX: number; lastY: number };

const FIT_PADDING = { top: RULER_TOP + 50, right: 60, bottom: 130, left: RULER_LEFT + 60 };

function sceneBounds(a: MassAnalysis): Bounds {
  const xs = [a.supports.xA, a.supports.xB];
  const ys = [0];
  for (const b of a.shapes) {
    for (const p of b.polygon) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  if (a.shapes.length === 0) return { minX: bounds.minX - 40, maxX: bounds.maxX + 40, minY: 0, maxY: 80 };
  return bounds;
}

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.isContentEditable)
  );
}

/** Lienzo CAD: cuadrícula, reglas, figuras, apoyos, marcadores y plomada, con zoom/pan y arrastre. */
export function Viewport() {
  const { shapes, selectedId, snap, initial } = useModel();
  const dispatch = useModelDispatch();
  const { analysis, warnings } = useAnalysis();
  const { zoom, centerNonce, showGrid, showDims, showLegend } = useView();
  const { setZoom } = useViewActions();
  const handleRef = useViewportHandle();
  const { active: simActive, store: simStore } = useSimulation();
  const { tool, setTool, drawInfo, setDrawInfo, openDialog, toast } = useTools();
  const [legendOpen, setLegendOpen] = useState(false);
  const [hintHidden, setHintHidden] = useState(() => window.localStorage.getItem('lab-hint') === '1');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const sizeRef = useRef<ViewSize & { dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const cameraRef = useRef<Camera>({ zoom, cx: 0, cy: 30 });
  const sceneRef = useRef<SceneState>({
    analysis,
    warnings,
    selectedId,
    hoverId: null,
    hoverSupport: null,
    activeSupport: null,
    sim: simStore.getSnapshot(),
  });
  const simActiveRef = useRef(simActive);
  const dragRef = useRef<Drag | null>(null);
  const spaceRef = useRef(false);
  const snapRef = useRef(snap);
  const fitPendingRef = useRef(true);
  const dirtyRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<ModelAction | null>(null);
  const flushRafRef = useRef<number | null>(null);
  const ghostRef = useRef<{ kind: ShapeKind; pt: Point } | null>(null);
  const drawPtsRef = useRef<Point[]>([]);
  const drawCursorRef = useRef<Point | null>(null);
  const toolRef = useRef(tool);
  const snapQRef = useRef<(v: number) => number>((v) => v);
  const requestDrawRef = useRef<() => void>(() => {});

  snapRef.current = snap;
  simActiveRef.current = simActive;
  toolRef.current = tool;
  snapQRef.current = snap ? Math.round : (v: number) => Math.round(v * 100) / 100;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const { w, h, dpr } = sizeRef.current;
    if (!canvas || !ctx || w === 0 || h === 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, { w, h }, cameraRef.current, sceneRef.current);
    const toS = (x: number, y: number): Point => worldToScreen(cameraRef.current, sizeRef.current, { x, y });
    // Contorno fantasma durante el arrastre de un tipo de figura desde la paleta.
    const ghost = ghostRef.current;
    if (ghost) {
      const r = shapeGeometry(defaultShapeProto(ghost.kind));
      if (r.ok) {
        const ox = ghost.pt.x - r.geom.width / 2;
        const oy = ghost.pt.y - r.geom.height / 2;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        r.geom.polygon.forEach((p, i) => {
          const s = toS(p.x + ox, p.y + oy);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Modo dibujo de polígono: vértices, aristas y banda elástica al cursor.
    const pts = drawPtsRef.current;
    if (toolRef.current === 'drawPolygon' && pts.length > 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.fillStyle = '#F59E0B';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const s = toS(p.x, p.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      pts.forEach((p) => {
        const s = toS(p.x, p.y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      const cur = drawCursorRef.current;
      if (cur) {
        const last = pts[pts.length - 1] as Point;
        const a = toS(last.x, last.y);
        const c = toS(cur.x, cur.y);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        const first = pts[0];
        if (pts.length >= 3 && first) {
          const f = toS(first.x, first.y);
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(f.x, f.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, []);

  const requestDraw = useCallback(() => {
    dirtyRef.current = true;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      draw();
    });
  }, [draw]);
  requestDrawRef.current = requestDraw;

  const updateCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const d = dragRef.current;
    const s = sceneRef.current;
    let cursor = 'crosshair';
    if (d?.kind === 'pan') cursor = 'grabbing';
    else if (d?.kind === 'block') cursor = 'move';
    else if (d?.kind === 'support') cursor = 'ew-resize';
    else if (spaceRef.current) cursor = 'grab';
    else if (s.hoverSupport) cursor = 'ew-resize';
    else if (s.hoverId) cursor = 'move';
    canvas.style.cursor = cursor;
  }, []);

  const tryFit = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    fitPendingRef.current = false;
    cameraRef.current = fitCamera(sceneBounds(sceneRef.current.analysis), { w, h }, FIT_PADDING);
    setZoom(cameraRef.current.zoom);
    requestDraw();
  }, [requestDraw, setZoom]);

  const flushPending = useCallback(() => {
    if (flushRafRef.current !== null) cancelAnimationFrame(flushRafRef.current);
    flushRafRef.current = null;
    const action = pendingRef.current;
    pendingRef.current = null;
    if (action) dispatch(action);
  }, [dispatch]);

  const schedule = useCallback(
    (action: ModelAction) => {
      pendingRef.current = action;
      if (flushRafRef.current !== null) return;
      flushRafRef.current = requestAnimationFrame(() => {
        flushRafRef.current = null;
        const a = pendingRef.current;
        pendingRef.current = null;
        if (a) dispatch(a);
      });
    },
    [dispatch],
  );

  useEffect(() => {
    const s = sceneRef.current;
    s.analysis = analysis;
    s.warnings = warnings;
    s.selectedId = selectedId;
    s.showGrid = showGrid;
    s.showDims = showDims;
    requestDraw();
  }, [analysis, warnings, selectedId, showGrid, showDims, requestDraw]);

  useEffect(() => {
    const sync = () => {
      sceneRef.current.sim = simStore.getSnapshot();
      requestDraw();
    };
    sync();
    return simStore.subscribe(sync);
  }, [simStore, requestDraw]);

  // Anima el crecimiento de las flechas de fuerza durante ~500 ms tras entrar en modo 'forces'.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = simStore.getSnapshot();
      if (s.mode === 'forces' && s.startedAt !== undefined && performance.now() - s.startedAt < 500) {
        requestDraw();
        raf = requestAnimationFrame(tick);
        return;
      }
      raf = 0;
    };
    const unsub = simStore.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(tick);
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [simStore, requestDraw]);

  useEffect(() => {
    if (!simActive) return;
    const s = sceneRef.current;
    s.hoverId = null;
    s.hoverSupport = null;
    requestDraw();
    updateCursor();
  }, [simActive, requestDraw, updateCursor]);

  useEffect(() => {
    handleRef.current = {
      renderImage: (scale, caption) => {
        const { w, h } = sizeRef.current;
        if (w === 0 || h === 0) return null;
        const capH = caption.length > 0 ? 16 + caption.length * 18 : 0;
        const out = document.createElement('canvas');
        out.width = Math.round(w * scale);
        out.height = Math.round((h + capH) * scale);
        const ctx = out.getContext('2d');
        if (!ctx) return null;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawScene(ctx, { w, h }, cameraRef.current, { ...sceneRef.current, hoverId: null, hoverSupport: null, activeSupport: null });
        if (capH > 0) drawCaption(ctx, w, h, capH, caption);
        return out;
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  useEffect(() => {
    if (Math.abs(cameraRef.current.zoom - zoom) > 1e-9) cameraRef.current = { ...cameraRef.current, zoom };
    requestDraw();
  }, [zoom, requestDraw]);

  useEffect(() => {
    fitPendingRef.current = true;
    tryFit();
  }, [centerNonce, initial, tryFit]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = (width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { w: width, h: height, dpr };
      if (fitPendingRef.current) tryFit();
      requestDraw();
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);

    let mql: MediaQueryList | null = null;
    const onDprChange = () => {
      resize(sizeRef.current.w, sizeRef.current.h);
      bindDpr();
    };
    const bindDpr = () => {
      mql?.removeEventListener('change', onDprChange);
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mql.addEventListener('change', onDprChange);
    };
    bindDpr();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      cameraRef.current = zoomAt(cameraRef.current, sizeRef.current, pt, cameraRef.current.zoom * factor);
      setZoom(cameraRef.current.zoom);
      requestDraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) requestDraw();
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      mql?.removeEventListener('change', onDprChange);
      canvas.removeEventListener('wheel', onWheel);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flushRafRef.current !== null) cancelAnimationFrame(flushRafRef.current);
      rafRef.current = null;
      flushRafRef.current = null;
    };
  }, [requestDraw, setZoom, tryFit]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
      e.preventDefault();
      if (!spaceRef.current) {
        spaceRef.current = true;
        updateCursor();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceRef.current = false;
      updateCursor();
    };
    const blur = () => {
      spaceRef.current = false;
      updateCursor();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [updateCursor]);

  const localPoint = (el: HTMLElement, e: { clientX: number; clientY: number }): Point => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (pt: Point): Point => screenToWorld(cameraRef.current, sizeRef.current, pt);

  const hitSupport = (pt: Point): SupportId | null => {
    const { supports } = sceneRef.current.analysis;
    const gy = worldToScreen(cameraRef.current, sizeRef.current, { x: 0, y: 0 }).y;
    if (pt.y < gy - SUPPORT_HIT.above || pt.y > gy + SUPPORT_HIT.below) return null;
    for (const label of ['B', 'A'] as const) {
      const x = label === 'A' ? supports.xA : supports.xB;
      const sx = worldToScreen(cameraRef.current, sizeRef.current, { x, y: 0 }).x;
      if (Math.abs(pt.x - sx) <= SUPPORT_HIT.halfWidth) return label;
    }
    return null;
  };

  const hitBlock = (pt: Point): string | null => {
    const wp = toWorld(pt);
    const list = sceneRef.current.analysis.shapes;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const b = list[i];
      if (b && pointInPolygon(wp, b.polygon)) return b.id;
    }
    return null;
  };

  const closePolygon = useCallback(() => {
    const pts = drawPtsRef.current;
    if (pts.length >= 3) {
      const minX = Math.min(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const local = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      const probe = shapeGeometry({ id: '', name: '', kind: 'polygon', points: local, m: 10, x: 0, y: 0, flipX: false, flipY: false });
      if (!probe.ok) {
        toast(probe.error);
        return;
      }
      dispatch({
        type: 'shape/insert',
        shape: { id: '', name: 'Polígono', kind: 'polygon', points: local, m: 10, x: minX, y: minY, flipX: false, flipY: false },
      });
      drawPtsRef.current = [];
      drawCursorRef.current = null;
      setDrawInfo({ count: 0 });
      setTool('select');
      requestDrawRef.current();
    }
  }, [dispatch, setDrawInfo, setTool, toast]);

  const cancelPolygon = useCallback(() => {
    drawPtsRef.current = [];
    drawCursorRef.current = null;
    setDrawInfo({ count: 0 });
    setTool('select');
    requestDrawRef.current();
  }, [setDrawInfo, setTool]);

  // Salir del modo dibujo si se desactiva desde la cinta.
  useEffect(() => {
    if (tool !== 'drawPolygon') {
      drawPtsRef.current = [];
      drawCursorRef.current = null;
      requestDraw();
    }
  }, [tool, requestDraw]);

  // Teclas del modo dibujo (Enter/Backspace/Escape) y doble clic para cerrar.
  useEffect(() => {
    if (tool !== 'drawPolygon') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelPolygon();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closePolygon();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        drawPtsRef.current.pop();
        setDrawInfo({ count: drawPtsRef.current.length });
        requestDrawRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tool, cancelPolygon, closePolygon, setDrawInfo]);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const pt = localPoint(canvas, e);
    canvas.focus({ preventScroll: true });
    if (toolRef.current === 'drawPolygon' && e.button === 0) {
      const wp = toWorld(pt);
      const q = snapQRef.current;
      drawPtsRef.current = [...drawPtsRef.current, { x: q(wp.x), y: q(wp.y) }];
      setDrawInfo({ count: drawPtsRef.current.length });
      requestDraw();
      return;
    }
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      e.preventDefault();
      dragRef.current = { kind: 'pan', lastX: pt.x, lastY: pt.y };
    } else if (e.button === 0 && simActiveRef.current) {
      return;
    } else if (e.button === 0) {
      const support = hitSupport(pt);
      const id = support ? null : hitBlock(pt);
      const block = id ? sceneRef.current.analysis.shapes.find((b) => b.id === id) : undefined;
      if (support) {
        dragRef.current = { kind: 'support', support };
        sceneRef.current.activeSupport = support;
        requestDraw();
      } else if (block) {
        const wp = toWorld(pt);
        dragRef.current = { kind: 'block', id: block.id, dx: wp.x - block.x, dy: wp.y - block.y };
        dispatch({ type: 'shape/select', id: block.id });
      } else {
        dispatch({ type: 'shape/select', id: null });
        return;
      }
    } else {
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    updateCursor();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = localPoint(e.currentTarget, e);
    const wp = toWorld(pt);
    if (hudRef.current) hudRef.current.textContent = `x = ${fmtFixed(wp.x, 1)} cm · y = ${fmtFixed(wp.y, 1)} cm`;
    cursorStore.set(wp);

    if (toolRef.current === 'drawPolygon') {
      const q = snapQRef.current;
      drawCursorRef.current = { x: q(wp.x), y: q(wp.y) };
      requestDraw();
      return;
    }
    const d = dragRef.current;
    if (d?.kind === 'pan') {
      cameraRef.current = panBy(cameraRef.current, pt.x - d.lastX, pt.y - d.lastY);
      d.lastX = pt.x;
      d.lastY = pt.y;
      requestDraw();
      return;
    }
    const snapOn = snapRef.current && !e.shiftKey;
    const q = (v: number) => (snapOn ? Math.round(v) : Math.round(v * 100) / 100);
    if (d?.kind === 'block') {
      schedule({ type: 'shape/update', id: d.id, patch: { x: q(wp.x - d.dx), y: q(wp.y - d.dy) } });
      return;
    }
    if (d?.kind === 'support') {
      schedule({ type: 'support/set', support: d.support, x: q(wp.x) });
      return;
    }

    const s = sceneRef.current;
    const support = simActiveRef.current ? null : hitSupport(pt);
    const id = support || simActiveRef.current ? null : hitBlock(pt);
    if (support !== s.hoverSupport || id !== s.hoverId) {
      s.hoverSupport = support;
      s.hoverId = id;
      requestDraw();
    }
    updateCursor();
  };

  const endDrag = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    flushPending();
    dragRef.current = null;
    sceneRef.current.activeSupport = null;
    requestDraw();
    updateCursor();
  };

  const onPointerLeave = () => {
    if (dragRef.current) return;
    const s = sceneRef.current;
    if (s.hoverId || s.hoverSupport) {
      s.hoverId = null;
      s.hoverSupport = null;
      requestDraw();
    }
    if (hudRef.current) hudRef.current.textContent = '';
    cursorStore.set(null);
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== 'drawPolygon') return;
    e.preventDefault();
    // El doble clic añade un punto duplicado: quítalo antes de cerrar.
    drawPtsRef.current = drawPtsRef.current.slice(0, -1);
    setDrawInfo({ count: drawPtsRef.current.length });
    closePolygon();
  };

  const dropKind = (e: ReactDragEvent): ShapeKind | null => {
    if (!e.dataTransfer.types.includes(SHAPE_MIME)) return null;
    return dragPayload.kind;
  };

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    const kind = dropKind(e);
    if (!kind || simActiveRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const pt = localPoint(e.currentTarget, e);
    const wp = toWorld(pt);
    const q = snapQRef.current;
    ghostRef.current = { kind, pt: { x: q(wp.x), y: q(wp.y) } };
    requestDraw();
  };

  const onDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    ghostRef.current = null;
    requestDraw();
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const kind = dropKind(e);
    ghostRef.current = null;
    dragPayload.kind = null;
    if (!kind || simActiveRef.current) return;
    e.preventDefault();
    const pt = localPoint(e.currentTarget, e);
    const wp = toWorld(pt);
    const q = snapQRef.current;
    const center = { x: q(wp.x), y: q(wp.y) };
    requestDraw();
    if (kind === 'equation') {
      openDialog({ kind: 'equation', at: center });
      return;
    }
    dispatch({ type: 'shape/insert', shape: createShape(kind, center, '', 'Figura', snapRef.current) });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const block = shapes.find((b) => b.id === selectedId);
    if (!block || simActive) return;
    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = step;
    else if (e.key === 'ArrowDown') dy = -step;
    else return;
    e.preventDefault();
    dispatch({ type: 'shape/update', id: block.id, patch: { x: block.x + dx, y: block.y + dy } });
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Lienzo CAD. Arrastra figuras y apoyos; usa las flechas para mover la figura seleccionada (Shift: 10 cm)."
        className="block touch-none select-none focus-visible:outline-offset-[-2px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      />
      {!hintHidden && (
        <div
          className="absolute flex items-center gap-2 rounded-md border border-lab-border bg-lab-panel/90 px-2 py-1 text-[10px] text-slate-400 shadow-md"
          style={{ top: RULER_TOP + 8, left: RULER_LEFT + 8 }}
        >
          <span>
            Rueda: zoom · Botón central o Espacio + arrastre: desplazar · Shift: sin snap · Flechas: mover figura
          </span>
          <button
            type="button"
            className="btn-icon !h-4 !w-4"
            aria-label="Ocultar ayuda"
            onClick={() => {
              window.localStorage.setItem('lab-hint', '1');
              setHintHidden(true);
            }}
          >
            <X size={10} aria-hidden="true" />
          </button>
        </div>
      )}
      {tool === 'drawPolygon' && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md border border-lab-warn/60 bg-lab-elevated/95 px-3 py-1 text-[11px] font-medium text-lab-warn shadow-lg"
          style={{ top: RULER_TOP + 8 }}
        >
          Dibujando polígono: {drawInfo.count} vértices · Enter para cerrar · Esc para cancelar
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 rounded-md border border-lab-border bg-lab-panel/90 px-2 py-1 text-[11px] text-slate-400" style={{ left: RULER_LEFT + 8 }}>
        <span className="num">
          Zoom {Math.round(zoom * 100)}% · Snap {snap ? '1 cm' : 'off'}
        </span>
        <span ref={hudRef} className="num ml-2 text-slate-300" aria-hidden="true" />
      </div>
      {showLegend && (
        <div className="absolute right-3" style={{ top: RULER_TOP + 8 }}>
          {legendOpen ? (
            <div className="relative rounded-md border border-lab-border bg-lab-panel/95 shadow-lg">
              <button
                type="button"
                className="btn-icon absolute right-1 top-1 z-10 !h-5 !w-5"
                aria-label="Cerrar leyenda"
                onClick={() => setLegendOpen(false)}
              >
                <X size={11} aria-hidden="true" />
              </button>
              <CanvasLegend analysis={analysis} />
            </div>
          ) : (
            <button
              type="button"
              className="rounded-md border border-lab-border bg-lab-panel/90 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-md transition-colors hover:text-white"
              onClick={() => setLegendOpen(true)}
            >
              Leyenda
            </button>
          )}
        </div>
      )}
    </div>
  );
}

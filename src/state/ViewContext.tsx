import { createContext, useCallback, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { ZOOM_MAX, ZOOM_MIN, clamp } from '../lib/limits';

const ZOOM_FACTOR = 1.25;

export interface ViewState {
  zoom: number;
  /** Se incrementa cada vez que se solicita "Centrar plano". */
  centerNonce: number;
  showGrid: boolean;
  showDims: boolean;
  showLegend: boolean;
}

export interface ViewActions {
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  center: () => void;
  toggleGrid: () => void;
  toggleDims: () => void;
  toggleLegend: () => void;
}

const ViewStateContext = createContext<ViewState | null>(null);
const ViewActionsContext = createContext<ViewActions | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoomRaw] = useState(1);
  const [centerNonce, setCenterNonce] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const setZoom = useCallback((z: number) => setZoomRaw(clamp(z, ZOOM_MIN, ZOOM_MAX)), []);
  const actions = useMemo<ViewActions>(
    () => ({
      zoomIn: () => setZoomRaw((z) => clamp(z * ZOOM_FACTOR, ZOOM_MIN, ZOOM_MAX)),
      zoomOut: () => setZoomRaw((z) => clamp(z / ZOOM_FACTOR, ZOOM_MIN, ZOOM_MAX)),
      setZoom,
      center: () => setCenterNonce((n) => n + 1),
      toggleGrid: () => setShowGrid((v) => !v),
      toggleDims: () => setShowDims((v) => !v),
      toggleLegend: () => setShowLegend((v) => !v),
    }),
    [setZoom],
  );
  const state = useMemo<ViewState>(
    () => ({ zoom, centerNonce, showGrid, showDims, showLegend }),
    [zoom, centerNonce, showGrid, showDims, showLegend],
  );

  return (
    <ViewActionsContext.Provider value={actions}>
      <ViewStateContext.Provider value={state}>{children}</ViewStateContext.Provider>
    </ViewActionsContext.Provider>
  );
}

export function useView(): ViewState {
  const ctx = useContext(ViewStateContext);
  if (!ctx) throw new Error('useView debe usarse dentro de <ViewProvider>');
  return ctx;
}

export function useViewActions(): ViewActions {
  const ctx = useContext(ViewActionsContext);
  if (!ctx) throw new Error('useViewActions debe usarse dentro de <ViewProvider>');
  return ctx;
}

/** API imperativa que el lienzo registra para exportar imágenes. */
export interface ViewportHandle {
  /** Dibuja la escena actual a `scale`× en un canvas nuevo, con un rótulo opcional al pie. */
  renderImage: (scale: number, caption: readonly string[]) => HTMLCanvasElement | null;
}

const ViewportHandleContext = createContext<MutableRefObject<ViewportHandle | null> | null>(null);

export function ViewportHandleProvider({ children }: { children: ReactNode }) {
  const ref = useRef<ViewportHandle | null>(null);
  return <ViewportHandleContext.Provider value={ref}>{children}</ViewportHandleContext.Provider>;
}

export function useViewportHandle(): MutableRefObject<ViewportHandle | null> {
  const ctx = useContext(ViewportHandleContext);
  if (!ctx) throw new Error('useViewportHandle debe usarse dentro de <ViewportHandleProvider>');
  return ctx;
}

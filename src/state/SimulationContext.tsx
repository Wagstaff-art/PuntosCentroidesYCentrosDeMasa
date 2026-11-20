import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  IDLE_SIM,
  SETTLE_HEIGHT_CM,
  advanceTip,
  createTipSetup,
  initialTipState,
  settleOffset,
  type SimMode,
  type SimSnapshot,
  type TipSetup,
  type TipState,
} from '../lib/dynamics';
import { fmtFixed } from '../lib/format';
import { useModel } from './ModelContext';
import { useAnalysis } from './AnalysisContext';
import { useTools } from './ToolsContext';

/** Factor de cámara lenta aplicado al tiempo real antes de integrar. */
export type SimSpeed = 1 | 0.5 | 0.25 | 0.1;
/** Ángulos de vuelco menores que esto apenas se aprecian: se explican al usuario. */
const TINY_TIP_RAD = (3 * Math.PI) / 180;

/** Almacén externo para los valores por frame: solo lo leen el lienzo y la tarjeta de simulación. */
export interface SimStore {
  getSnapshot: () => SimSnapshot;
  subscribe: (listener: () => void) => () => void;
  set: (next: SimSnapshot) => void;
}

function createSimStore(): SimStore {
  let snapshot = IDLE_SIM;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      snapshot = next;
      listeners.forEach((l) => l());
    },
  };
}

export interface SimulationValue {
  mode: SimMode;
  /** true mientras hay una simulación mostrada (la edición queda bloqueada). */
  active: boolean;
  start: () => void;
  stop: () => void;
  /** Reinicia el vuelco desde θ = 0 con la velocidad actual. */
  replay: () => void;
  speed: SimSpeed;
  setSpeed: (s: SimSpeed) => void;
  store: SimStore;
}

const SimulationContext = createContext<SimulationValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { shapes } = useModel();
  const { analysis } = useAnalysis();
  const { toast } = useTools();
  const store = useMemo(createSimStore, []);
  const [mode, setMode] = useState<SimMode>('idle');
  const [speed, setSpeedState] = useState<SimSpeed>(0.25);
  const speedRef = useRef<SimSpeed>(speed);
  const rafRef = useRef<number | null>(null);

  const setSpeed = useCallback((s: SimSpeed) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cancel();
    store.set(IDLE_SIM);
    setMode('idle');
  }, [cancel, store]);

  const runLoop = useCallback(
    (setup: TipSetup, initial: TipState) => {
      let state = initial;
      let last = 0;
      const loop = (now: number) => {
        const elapsed = last === 0 ? 0 : (now - last) / 1000;
        last = now;
        state = advanceTip(state, setup, elapsed * speedRef.current);
        store.set({ mode: 'tipping', setup, state });
        rafRef.current = state.finished ? null : requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [store],
  );

  const start = useCallback(() => {
    cancel();
    if (analysis.status === 'sin_masa') return;
    if (analysis.status === 'estable') {
      let t = 0;
      let landedAt: number | null = null;
      let last = 0;
      const loop = (now: number) => {
        const elapsed = last === 0 ? 0 : (now - last) / 1000;
        last = now;
        t += elapsed * speedRef.current;
        const s = settleOffset(t, analysis.g);
        if (s.landed && landedAt === null) landedAt = performance.now();
        store.set({
          mode: 'forces',
          setup: null,
          state: null,
          startedAt: performance.now(),
          settle: { t, offsetCm: s.offsetCm, landed: s.landed, landedAt },
        });
        rafRef.current = s.landed && landedAt !== null && performance.now() - landedAt > 450 ? null : requestAnimationFrame(loop);
      };
      store.set({
        mode: 'forces',
        setup: null,
        state: null,
        startedAt: performance.now(),
        settle: { t: 0, offsetCm: SETTLE_HEIGHT_CM, landed: false, landedAt: null },
      });
      setMode('forces');
      toast('Sistema estable: no hay vuelco; se muestran las reacciones.');
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const setup = createTipSetup(shapes, analysis);
    if (!setup) return;
    const state = initialTipState(setup);
    if (setup.endReason === 'impacto' && Math.abs(setup.endAngle) < TINY_TIP_RAD) {
      toast(`El suelo detiene el giro en ${fmtFixed(Math.abs((setup.endAngle * 180) / Math.PI), 1)}° — ver detalle en Resultados.`);
    }
    store.set({ mode: 'tipping', setup, state });
    setMode('tipping');
    if (state.finished) return;
    runLoop(setup, state);
  }, [analysis, shapes, cancel, store, toast, runLoop]);

  const replay = useCallback(() => {
    const snap = store.getSnapshot();
    if (snap.mode !== 'tipping' || !snap.setup) return;
    cancel();
    const state = initialTipState(snap.setup);
    store.set({ mode: 'tipping', setup: snap.setup, state });
    setMode('tipping');
    if (state.finished) return;
    runLoop(snap.setup, state);
  }, [cancel, store, runLoop]);

  useEffect(() => cancel, [cancel]);

  const value = useMemo<SimulationValue>(
    () => ({ mode, active: mode !== 'idle', start, stop, replay, speed, setSpeed, store }),
    [mode, start, stop, replay, speed, setSpeed, store],
  );
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation debe usarse dentro de <SimulationProvider>');
  return ctx;
}

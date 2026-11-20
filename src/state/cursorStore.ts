import { useSyncExternalStore } from 'react';

/** Punto del cursor en coordenadas del mundo (cm), o null fuera del lienzo. */
export type CursorPoint = { x: number; y: number } | null;

let point: CursorPoint = null;
const listeners = new Set<() => void>();

/**
 * Almacén externo mínimo para las coordenadas del cursor: el lienzo escribe por
 * cada movimiento y solo la barra de estado se suscribe (sin re-render del resto).
 */
export const cursorStore = {
  get: (): CursorPoint => point,
  set: (p: CursorPoint): void => {
    point = p;
    listeners.forEach((l) => l());
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useCursorPoint(): CursorPoint {
  return useSyncExternalStore(cursorStore.subscribe, cursorStore.get);
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShapeKind } from '../types';

/** MIME de arrastre de tipos de figura (paleta/cinta → lienzo). */
export const SHAPE_MIME = 'application/x-lab-shape';

/** Tipo de figura en arrastre: dataTransfer no expone getData en dragover. */
export const dragPayload: { kind: ShapeKind | null } = { kind: null };

export type Tool = 'select' | 'drawPolygon';

export type DialogState =
  | { kind: 'equation'; shapeId?: string; at?: { x: number; y: number } }
  | { kind: 'polygon'; shapeId: string }
  | { kind: 'shortcuts' }
  | null;

export type LeftSection = 'biblioteca' | 'modelo' | 'apoyos';
export type RightTab = 'resultados' | 'desarrollo' | 'preset';

export interface DrawInfo {
  count: number;
}

export interface ToastMsg {
  id: number;
  text: string;
}

export interface ToolsValue {
  tool: Tool;
  setTool: (t: Tool) => void;
  drawInfo: DrawInfo;
  setDrawInfo: (d: DrawInfo) => void;
  dialog: DialogState;
  openDialog: (d: Exclude<DialogState, null>) => void;
  closeDialog: () => void;
  leftSection: LeftSection;
  setLeftSection: (s: LeftSection) => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;
  toasts: readonly ToastMsg[];
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
}

const ToolsContext = createContext<ToolsValue | null>(null);

export function ToolsProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<Tool>('select');
  const [drawInfo, setDrawInfo] = useState<DrawInfo>({ count: 0 });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [leftSection, setLeftSection] = useState<LeftSection>('biblioteca');
  const [rightTab, setRightTab] = useState<RightTab>('resultados');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seqRef = useRef(0);

  const openDialog = useCallback((d: Exclude<DialogState, null>) => setDialog(d), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((m) => m.id !== id)), []);
  const toast = useCallback(
    (text: string) => {
      seqRef.current += 1;
      const id = seqRef.current;
      setToasts((t) => [...t.slice(-3), { id, text }]);
      window.setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast],
  );

  const value = useMemo<ToolsValue>(
    () => ({
      tool,
      setTool,
      drawInfo,
      setDrawInfo,
      dialog,
      openDialog,
      closeDialog,
      leftSection,
      setLeftSection,
      rightTab,
      setRightTab,
      toasts,
      toast,
      dismissToast,
    }),
    [tool, drawInfo, dialog, leftSection, rightTab, toasts, openDialog, closeDialog, toast, dismissToast],
  );
  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools(): ToolsValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools debe usarse dentro de <ToolsProvider>');
  return ctx;
}

import { AlertTriangle, X } from 'lucide-react';
import { useTools } from '../state/ToolsContext';

/** Avisos flotantes (validación de polígonos dibujados, etc.). */
export function Toasts() {
  const { toasts, dismissToast } = useTools();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-1.5" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-lab-warn/60 bg-lab-elevated px-3 py-1.5 text-[11px] text-slate-200 shadow-xl"
        >
          <AlertTriangle size={13} className="shrink-0 text-lab-warn" aria-hidden="true" />
          {t.text}
          <button type="button" className="btn-icon !h-5 !w-5" aria-label="Cerrar aviso" onClick={() => dismissToast(t.id)}>
            <X size={11} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

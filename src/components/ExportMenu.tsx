import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Image } from 'lucide-react';
import { useReport } from '../state/ReportContext';

/** Menú "Exportar": PNG ×2 con rótulo y reporte técnico imprimible. */
export function ExportMenu() {
  const { exportPng, printReport } = useReport();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Download size={14} aria-hidden="true" />
        <span>Exportar</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="fixed right-3 top-12 z-50 mt-1 w-56 rounded-md border border-lab-border bg-lab-panel p-1 shadow-xl"
        >
          <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-lab-border" onClick={() => run(exportPng)}>
            <Image size={14} aria-hidden="true" />
            Exportar PNG (×2, con rótulo)
          </button>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-lab-border" onClick={() => run(printReport)}>
            <FileText size={14} aria-hidden="true" />
            Reporte técnico (imprimir / PDF)
          </button>
        </div>
      )}
    </div>
  );
}

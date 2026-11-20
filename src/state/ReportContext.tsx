import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useModel } from './ModelContext';
import { useAnalysis } from './AnalysisContext';
import { useSimulation } from './SimulationContext';
import { useViewportHandle } from './ViewContext';
import { captionLines } from '../lib/status';
import { PrintReport, type ReportData } from '../components/PrintReport';

export interface ReportValue {
  /** Descarga el lienzo a resolución ×2 con rótulo (preset, fecha, estado). */
  exportPng: () => void;
  /** Abre la vista imprimible del reporte técnico (window.print). */
  printReport: () => void;
}

const ReportContext = createContext<ReportValue | null>(null);

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const model = useModel();
  const { analysis } = useAnalysis();
  const { store } = useSimulation();
  const handleRef = useViewportHandle();
  const [report, setReport] = useState<ReportData | null>(null);
  const printPendingRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const render = useCallback(
    (date: Date) => handleRef.current?.renderImage(2, captionLines(model.name, analysis, store.getSnapshot(), date)) ?? null,
    [analysis, handleRef, model.name, store],
  );

  const exportPng = useCallback(() => {
    const date = new Date();
    const canvas = render(date);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estabilidad-${slug(model.name) || 'modelo'}-${stamp(date)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, [model.name, render]);

  const capture = useCallback((): ReportData => {
    const date = new Date();
    return {
      date,
      image: render(date)?.toDataURL('image/png') ?? null,
      name: model.name,
      shapes: model.shapes,
      analysis,
      sim: store.getSnapshot(),
    };
  }, [analysis, model.shapes, model.name, render, store]);

  const printReport = useCallback(() => {
    printPendingRef.current = true;
    setReport(capture());
  }, [capture]);

  useEffect(() => {
    if (!report || !printPendingRef.current) return;
    printPendingRef.current = false;
    const go = () => window.print();
    const img = imgRef.current;
    if (img && !img.complete) img.decode().then(go, go);
    else requestAnimationFrame(go);
  }, [report]);

  useEffect(() => {
    const before = () => {
      if (!printPendingRef.current && !report) flushSync(() => setReport(capture()));
    };
    const after = () => setReport(null);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [capture, report]);

  const value = useMemo<ReportValue>(() => ({ exportPng, printReport }), [exportPng, printReport]);

  return (
    <ReportContext.Provider value={value}>
      {children}
      {report && <PrintReport data={report} imgRef={imgRef} />}
    </ReportContext.Provider>
  );
}

export function useReport(): ReportValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport debe usarse dentro de <ReportProvider>');
  return ctx;
}

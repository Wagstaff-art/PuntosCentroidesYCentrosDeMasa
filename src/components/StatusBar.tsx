import { useSyncExternalStore } from 'react';
import { AlertOctagon, AlertTriangle, Ban, CheckCircle2, RotateCw, Shapes } from 'lucide-react';
import { useAnalysis } from '../state/AnalysisContext';
import { useModel } from '../state/ModelContext';
import { useSimulation } from '../state/SimulationContext';
import { useView } from '../state/ViewContext';
import { useCursorPoint } from '../state/cursorStore';
import { fmtFixed } from '../lib/format';
import { displayStatus } from '../lib/status';

/** Chip de estado con icono + texto (nunca solo color). */
function StatusChip() {
  const { analysis } = useAnalysis();
  const { store } = useSimulation();
  const sim = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const text = displayStatus(analysis, sim);
  let Icon = Ban;
  let cls = 'border-lab-warn/50 bg-lab-warn/10 text-lab-warn';
  if (text === 'ESTABLE') {
    Icon = CheckCircle2;
    cls = 'border-lab-stable/50 bg-lab-stable/10 text-lab-stable';
  } else if (text === 'VOLCADO') {
    Icon = AlertOctagon;
    cls = 'border-lab-danger/50 bg-lab-danger/15 text-lab-danger';
  } else if (text === 'CAYENDO') {
    Icon = RotateCw;
    cls = 'border-lab-warn/50 bg-lab-warn/10 text-lab-warn';
  } else if (text === 'INESTABLE · VUELCO') {
    Icon = AlertTriangle;
    cls = 'border-lab-danger/50 bg-lab-danger/10 text-lab-danger';
  }
  return (
    <span role="status" className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-bold ${cls}`}>
      <Icon size={11} aria-hidden="true" />
      {text}
    </span>
  );
}

/** Barra de estado inferior (h-7): estado, conteos y datos de vista/integración. */
export function StatusBar() {
  const { shapes, snap } = useModel();
  const { analysis } = useAnalysis();
  const { zoom } = useView();
  const cursor = useCursorPoint();
  const xCM = analysis.centerOfMass.x.value;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-lab-border bg-lab-panel px-3 text-[10.5px] text-lab-muted">
      <StatusChip />
      <span className="inline-flex items-center gap-1">
        <Shapes size={11} aria-hidden="true" />
        Figuras: <span className="num text-slate-300">{shapes.length}</span>
      </span>
      {analysis.invalid.length > 0 && (
        <span className="text-lab-danger">
          inválidas: <span className="num">{analysis.invalid.length}</span>
        </span>
      )}
      <span className="hidden sm:inline">
        M = <span className="num text-slate-300">{fmtFixed(analysis.totalMass)} kg</span>
      </span>
      <span className="hidden md:inline">
        x̄_G = <span className="num text-slate-300" data-testid="sb-xg">{analysis.centroid.x.value === null ? '—' : `${fmtFixed(analysis.centroid.x.value)} cm`}</span>
      </span>
      <span className="hidden sm:inline">
        x̄_CM = <span className="num text-slate-300">{xCM === null ? '—' : `${fmtFixed(xCM)} cm`}</span>
      </span>
      <span className="ml-auto inline-flex items-center gap-3">
        <span className="num w-[150px] truncate text-right text-slate-300" aria-hidden="true">
          {cursor ? `x = ${fmtFixed(cursor.x, 1)} · y = ${fmtFixed(cursor.y, 1)} cm` : '—'}
        </span>
        <span className="num">{Math.round(zoom * 100)}%</span>
        <span className="hidden md:inline">{snap ? 'Snap 1 cm' : 'Snap off'}</span>
        <span className="hidden xl:inline">Simpson n = 600 · dt = 1/120 s</span>
      </span>
    </footer>
  );
}

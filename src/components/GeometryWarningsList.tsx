import { AlertTriangle } from 'lucide-react';
import { useModel } from '../state/ModelContext';
import { useAnalysis } from '../state/AnalysisContext';
import { fmtTrim } from '../lib/format';

/** Avisos no bloqueantes: geometría inválida, solapamientos (área > 0) y figuras flotantes. */
export function GeometryWarningsList() {
  const { shapes, selectedId } = useModel();
  const { analysis, warnings } = useAnalysis();
  const nameOf = (id: string) => shapes.find((b) => b.id === id)?.name ?? id;

  if (warnings.overlaps.length === 0 && warnings.floatingIds.size === 0 && analysis.invalid.length === 0) return null;

  return (
    <div role="status" className="space-y-1.5 rounded-md border border-dashed border-lab-warn/60 bg-lab-warn/5 p-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-lab-warn">
        <AlertTriangle size={13} aria-hidden="true" />
        Advertencias del modelo
      </p>
      <ul className="space-y-1 text-[11px] leading-snug text-slate-300">
        {analysis.invalid.map((inv) => (
          <li key={`inv-${inv.id}`} className={inv.id === selectedId ? 'text-white' : undefined}>
            «{nameOf(inv.id)}» tiene una geometría no válida y se excluye del análisis: {inv.error}.
          </li>
        ))}
        {warnings.overlaps.map((o) => (
          <li key={`${o.a}-${o.b}`} className={o.a === selectedId || o.b === selectedId ? 'text-white' : undefined}>
            Solapamiento: «{nameOf(o.a)}» y «{nameOf(o.b)}» se solapan
            {o.area !== null && (
              <>
                {' '}
                (<span className="num">{fmtTrim(o.area, 2)} cm²</span>)
              </>
            )}
            . El cálculo continúa, pero el modelo no es físicamente realista.
          </li>
        ))}
        {[...warnings.floatingIds].map((id) => (
          <li key={id} className={id === selectedId ? 'text-white' : undefined}>
            «{nameOf(id)}» flota sin contacto con el suelo ni con otra figura.
          </li>
        ))}
      </ul>
    </div>
  );
}

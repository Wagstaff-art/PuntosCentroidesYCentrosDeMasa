import { memo } from 'react';
import { Check, RotateCw } from 'lucide-react';
import type { MassAnalysis } from '../lib/physics';
import { fmtFixed } from '../lib/format';

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="num flex items-center justify-end gap-1 text-slate-100">
        {value}
        {ok !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] ${ok ? 'text-lab-stable' : 'text-lab-danger'}`}>
            <Check size={12} aria-hidden="true" />
            {ok ? 'OK' : 'ERROR'}
          </span>
        )}
      </dd>
    </>
  );
}

export const ReactionsCard = memo(function ReactionsCard({ analysis: a, hideTitle = false }: { analysis: MassAnalysis; hideTitle?: boolean }) {
  const r = a.reactions;
  const st = a.stability;

  return (
    <section aria-labelledby="titulo-reacciones" className="space-y-2">
      <h2 id="titulo-reacciones" className={hideTitle ? 'sr-only' : 'section-title'}>
        Reacciones en los apoyos
      </h2>
      <div className="panel-card">
        {r ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <Row label="R_A (apoyo fijo)" value={`${fmtFixed(r.RA)} N`} />
            <Row label="R_B (rodillo)" value={`${fmtFixed(r.RB)} N`} />
            <Row label="W = M·g" value={`${fmtFixed(r.weight)} N`} />
            <Row label="ΣF_y" value={`${fmtFixed(r.sumFy)} N`} ok={Math.abs(r.sumFy) < 1e-6} />
            <Row label={`Στ respecto a ${a.base.minLabel}`} value={`${fmtFixed(r.sumTorque)} N·m`} ok={Math.abs(r.sumTorque) < 1e-6} />
          </dl>
        ) : st && !st.stable && a.overturningMoment !== null ? (
          <div className="space-y-2 text-xs">
            <p className="flex items-start gap-2 text-slate-300">
              <RotateCw size={14} className="mt-0.5 shrink-0 text-lab-danger" aria-hidden="true" />
              <span>
                No existe equilibrio estático: no hay reacciones R_A, R_B ≥ 0 que anulen el momento del peso. El cuerpo gira en
                torno a {st.pivot}.
              </span>
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Row label="W = M·g" value={`${fmtFixed(a.totalMass * a.g)} N`} />
              <Row label={`Momento de vuelco en ${st.pivot}`} value={`${fmtFixed(a.overturningMoment)} N·m`} />
            </dl>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sin masa no hay cargas ni reacciones.</p>
        )}
      </div>
    </section>
  );
});

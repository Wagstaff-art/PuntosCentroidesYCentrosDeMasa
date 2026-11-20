import { memo } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Lightbulb } from 'lucide-react';
import type { MassAnalysis } from '../lib/physics';
import { fmtFixed, fmtTrim } from '../lib/format';

const STATUS = {
  estable: {
    label: 'ESTABLE',
    Icon: CheckCircle2,
    cls: 'border-lab-stable/50 bg-lab-stable/10 text-lab-stable',
  },
  inestable: {
    label: 'INESTABLE · VUELCO',
    Icon: AlertTriangle,
    cls: 'border-lab-danger/50 bg-lab-danger/10 text-lab-danger',
  },
  sin_masa: {
    label: 'SIN MASA',
    Icon: Ban,
    cls: 'border-lab-warn/50 bg-lab-warn/10 text-lab-warn',
  },
} as const;

function diagnosis(a: MassAnalysis): string {
  const st = a.stability;
  const xCM = a.centerOfMass.x.value;
  if (a.status === 'sin_masa' || !st || xCM === null) {
    return 'El modelo no tiene masa ni área: añade al menos un figura para calcular el centroide y el centro de masa.';
  }
  const range = `[${fmtTrim(a.base.xmin)}, ${fmtTrim(a.base.xmax)}] cm`;
  if (st.stable) {
    return `El centro de masa (x̄_CM = ${fmtFixed(xCM)} cm) cae dentro de la base ${range}, a ${fmtFixed(st.margin)} cm del apoyo más cercano. El sistema está en equilibrio estático.`;
  }
  if (st.reason === 'base_nula') {
    return `Los apoyos A y B coinciden en x = ${fmtTrim(a.base.xmin)} cm: la base de sustentación tiene ancho 0 y no puede equilibrar el peso. El sistema vuelca en torno a ${st.pivot ?? 'P'}.`;
  }
  const side = st.reason === 'fuera_izquierda' ? 'izquierda' : 'derecha';
  return `El centro de masa (x̄_CM = ${fmtFixed(xCM)} cm) cae ${fmtFixed(Math.abs(st.margin))} cm a la ${side} del apoyo ${st.pivot ?? 'P'}, fuera de la base ${range}. El peso genera un momento de vuelco en torno a ${st.pivot ?? 'P'}.`;
}

function insight(a: MassAnalysis): string | null {
  const xG = a.centroid.x.value;
  const xCM = a.centerOfMass.x.value;
  if (xG === null || xCM === null || !a.stability) return null;
  const inside = (v: number) => v >= a.base.xmin && v <= a.base.xmax && a.base.width > 0;
  if (inside(xG) && !inside(xCM)) {
    return 'El centroide geométrico está dentro de la base, pero el centro de masa no: la forma engaña. El centroide solo depende de la geometría; el vuelco lo decide cómo se reparte la masa.';
  }
  if (!inside(xG) && inside(xCM)) {
    return 'El centroide geométrico queda fuera de la base, pero las figuras más densas llevan el centro de masa a su interior: por eso el sistema se sostiene.';
  }
  if (Math.abs(xG - xCM) < 1e-6) {
    return 'x̄_G = x̄_CM: todas las figuras tienen la misma densidad (o la distribución es simétrica), así que centroide y centro de masa coinciden.';
  }
  return null;
}

/** Banda de la base con los marcadores G y CM a escala. */
function BaseStrip({ a }: { a: MassAnalysis }) {
  const xG = a.centroid.x.value;
  const xCM = a.centerOfMass.x.value;
  if (xG === null || xCM === null) return null;
  const { xmin, xmax, minLabel, maxLabel } = a.base;
  const lo0 = Math.min(xmin, xG, xCM);
  const hi0 = Math.max(xmax, xG, xCM);
  const pad = Math.max((hi0 - lo0) * 0.12, 5);
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const stable = a.status === 'estable';

  return (
    <div
      className="relative h-14 rounded-md border border-lab-border bg-lab-bg"
      role="img"
      aria-label={`Base de ${fmtTrim(xmin)} a ${fmtTrim(xmax)} cm; centroide en ${fmtFixed(xG)} cm; centro de masa en ${fmtFixed(xCM)} cm`}
    >
      <div className="absolute inset-x-0 top-8 h-px bg-slate-600" />
      <div
        className={`absolute top-6 h-4 border-x-2 ${stable ? 'border-lab-stable bg-lab-stable/20' : 'border-lab-danger bg-lab-danger/15'}`}
        style={{ left: pos(xmin), width: `calc(${pos(xmax)} - ${pos(xmin)})`, minWidth: '2px' }}
      />
      <span className="num absolute top-10 -translate-x-1/2 text-[10px] text-slate-300" style={{ left: pos(xmin) }}>
        {minLabel}
      </span>
      <span className="num absolute top-10 -translate-x-1/2 text-[10px] text-slate-300" style={{ left: pos(xmax) }}>
        {maxLabel}
      </span>
      <span className="absolute top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(xG) }}>
        <span className="num text-[9px] leading-none text-lab-accent">G</span>
        <span className="mt-0.5 block h-3 w-3 rounded-full border-2 border-lab-accent" />
      </span>
      <span className="absolute top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(xCM) }}>
        <span className="num text-[9px] leading-none text-lab-warn">CM</span>
        <span className="mt-0.5 block h-3 w-3 rotate-45 border-2 border-lab-warn bg-lab-warn/40" />
      </span>
    </div>
  );
}

export const StabilityCard = memo(function StabilityCard({ analysis: a, hideTitle = false }: { analysis: MassAnalysis; hideTitle?: boolean }) {
  const s = STATUS[a.status];
  const st = a.stability;
  const xG = a.centroid.x.value;
  const xCM = a.centerOfMass.x.value;
  const tip = insight(a);

  return (
    <section aria-labelledby="titulo-diagnostico" className="space-y-2">
      <h2 id="titulo-diagnostico" className={hideTitle ? 'sr-only' : 'section-title'}>
        Diagnóstico de estabilidad
      </h2>
      <div className="panel-card space-y-3">
        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${s.cls}`}>
            <s.Icon size={18} aria-hidden="true" />
            <span className="text-sm font-bold tracking-wide">{s.label}</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">{diagnosis(a)}</p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-slate-400">Margen</dt>
          <dd className={`num whitespace-nowrap text-right ${st && st.margin < 0 ? 'text-lab-danger' : 'text-slate-100'}`}>
            {st ? `${fmtFixed(st.margin)} cm` : '—'}
          </dd>
          <dt className="text-slate-400">Pivote crítico</dt>
          <dd className="num whitespace-nowrap text-right text-slate-100">
            {st?.pivot && st.pivotX !== null ? `${st.pivot} (x = ${fmtTrim(st.pivotX)} cm)` : '—'}
          </dd>
          <dt className="text-slate-400">Base</dt>
          <dd className="num whitespace-nowrap text-right text-slate-100">
            [{fmtTrim(a.base.xmin)}, {fmtTrim(a.base.xmax)}] cm · L = {fmtTrim(a.base.width)} cm
          </dd>
          <dt className="text-lab-accent">x̄_G (centroide)</dt>
          <dd className="num whitespace-nowrap text-right text-slate-100">{xG === null ? '—' : `${fmtFixed(xG)} cm`}</dd>
          <dt className="text-lab-warn">x̄_CM (centro de masa)</dt>
          <dd className="num whitespace-nowrap text-right text-slate-100">{xCM === null ? '—' : `${fmtFixed(xCM)} cm`}</dd>
          <dt className="text-slate-400">Masa total M</dt>
          <dd className="num whitespace-nowrap text-right text-slate-100">{fmtTrim(a.totalMass, 2)} kg</dd>
        </dl>

        <BaseStrip a={a} />

        {tip && (
          <p className="flex gap-2 rounded-md border border-lab-accent/30 bg-lab-accent/5 p-2 text-[11px] leading-relaxed text-slate-300">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-lab-accent" aria-hidden="true" />
            <span>{tip}</span>
          </p>
        )}
      </div>
    </section>
  );
});

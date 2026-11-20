import { memo, useSyncExternalStore } from 'react';
import { AlertOctagon, AlertTriangle, Info, Pause, RotateCcw, RotateCw, Scale } from 'lucide-react';
import { useSimulation, type SimSpeed } from '../state/SimulationContext';
import { useAnalysis } from '../state/AnalysisContext';
import type { TipSetup } from '../lib/dynamics';
import { fmtFixed, fmtTrim, texNum } from '../lib/format';
import { Tex } from './Tex';

/** Fórmulas del vuelco con los valores constantes de la simulación (no cambian por frame). */
const TipFormulas = memo(function TipFormulas({ setup }: { setup: TipSetup }) {
  const alpha0 = (-setup.mass * setup.g * setup.rx) / setup.inertia;
  const tex = [
    '\\begin{aligned}',
    'I_P &= \\textstyle\\sum_i m_i\\!\\left[\\dfrac{J_{c,i}}{A_i} + d_i^2\\right] \\\\[4pt]',
    `&= ${fmtFixed(setup.inertia, 4)}\\ \\text{kg}\\cdot\\text{m}^2 \\\\[4pt]`,
    `\\vec r &= CM - P \\\\[4pt]`,
    `&= (${fmtFixed(setup.rx, 4)},\\ ${fmtFixed(setup.ry, 4)})\\ \\text{m} \\\\[4pt]`,
    '\\alpha(\\theta) &= -\\dfrac{M g\\,(r_x\\cos\\theta - r_y\\sin\\theta)}{I_P} \\\\[4pt]',
    `\\alpha(0) &= -\\dfrac{${fmtTrim(setup.mass, 2)}\\cdot ${fmtTrim(setup.g)}\\cdot ${texNum(fmtFixed(setup.rx, 4))}}{${fmtFixed(setup.inertia, 4)}} \\\\[4pt]`,
    `&= ${fmtFixed(alpha0, 2)}\\ \\text{rad/s}^2`,
    '\\end{aligned}',
  ].join('\n');
  return <Tex tex={tex} display />;
});

const SPEEDS: SimSpeed[] = [1, 0.5, 0.25, 0.1];

function SpeedControl() {
  const { speed, setSpeed } = useSimulation();
  return (
    <div>
      <div role="radiogroup" aria-label="Velocidad de simulación" className="flex overflow-hidden rounded-md border border-lab-border">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => setSpeed(s)}
            className={`num flex-1 px-2 py-1 text-[11px] transition-colors duration-150 ${
              speed === s ? 'bg-lab-accent/20 text-lab-accent' : 'bg-lab-surface-1 text-slate-400 hover:text-slate-200'
            }`}
          >
            ×{s}
          </button>
        ))}
      </div>
      {speed < 1 && <p className="mt-1 text-[10px] text-slate-500">Tiempo simulado · cámara lenta ×{speed}</p>}
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="num text-right text-slate-100">{value}</dd>
    </>
  );
}

/** Lectura en vivo de θ, ω y t. Es el único componente del panel que se actualiza por frame. */
export function SimulationCard() {
  const { mode, store, replay } = useSimulation();
  const { analysis } = useAnalysis();
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);

  if (mode === 'idle') return null;

  if (snap.mode === 'forces') {
    const r = analysis.reactions;
    return (
      <section aria-labelledby="titulo-simulacion" className="space-y-2">
        <h2 id="titulo-simulacion" className="section-title">
          Simulación de gravedad
        </h2>
        <div className="panel-card space-y-2">
          <p className="flex items-center gap-2 rounded-md border border-lab-stable/50 bg-lab-stable/10 px-3 py-2 text-sm font-bold text-lab-stable">
            <Scale size={16} aria-hidden="true" />
            EQUILIBRIO ESTÁTICO
          </p>
          <p className="text-xs leading-relaxed text-slate-300">
            El centro de masa cae dentro de la base: los apoyos generan reacciones verticales que equilibran el peso y el
            sistema no se mueve. Las flechas del lienzo son proporcionales a cada fuerza.
          </p>
          <p className="flex items-start gap-1.5 rounded-md border border-lab-accent/40 bg-lab-accent/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-300">
            <Info size={12} className="mt-0.5 shrink-0 text-lab-accent" aria-hidden="true" />
            Sistema estable: no hay movimiento. Se muestran las reacciones R_A, R_B y el peso W.
          </p>
          {r && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <Value label="W = M·g" value={`${fmtFixed(r.weight)} N`} />
              <Value label="R_A" value={`${fmtFixed(r.RA)} N`} />
              <Value label="R_B" value={`${fmtFixed(r.RB)} N`} />
              <Value label="R_A + R_B − W" value={`${fmtFixed(r.sumFy)} N`} />
            </dl>
          )}
        </div>
      </section>
    );
  }

  const { setup, state } = snap;
  if (!setup || !state) return null;
  const deg = (state.theta * 180) / Math.PI;
  const done = state.finished;
  const reason =
    setup.endReason === 'impacto' && setup.impactVertex
      ? `el vértice (${fmtTrim(setup.impactVertex.x, 2)}, ${fmtTrim(setup.impactVertex.y, 2)}) cm toca el suelo y = 0`
      : 'el giro alcanza 90°';

  return (
    <section aria-labelledby="titulo-simulacion" className="space-y-2">
      <h2 id="titulo-simulacion" className="section-title">
        Simulación de gravedad · vuelco en torno a {setup.pivotLabel}
      </h2>
      <div className="panel-card space-y-2">
        <p
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${
            done ? 'border-lab-danger/60 bg-lab-danger/15 text-lab-danger' : 'border-lab-warn/60 bg-lab-warn/10 text-lab-warn'
          }`}
        >
          {done ? <AlertOctagon size={16} aria-hidden="true" /> : <RotateCw size={16} className="animate-spin" aria-hidden="true" />}
          {done ? 'VOLCADO' : 'CAYENDO'}
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <Value label="θ (ángulo girado)" value={`${fmtFixed(deg, 2)}° (${fmtFixed(state.theta, 4)} rad)`} />
          <Value label="ω (velocidad angular)" value={`${fmtFixed(state.omega, 3)} rad/s`} />
          <Value label="t (tiempo)" value={`${fmtFixed(state.t, 3)} s`} />
          <Value label="Sentido" value={setup.direction < 0 ? 'horario' : 'antihorario'} />
        </dl>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400" aria-live="polite">
          <Pause size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {done
            ? `Impacto inelástico: ${reason}; ω = 0 y el sistema queda volcado.`
            : `El peso produce un momento respecto a ${setup.pivotLabel}; la simulación termina cuando ${reason}.`}
        </p>
        {done && setup.endReason === 'impacto' && Math.abs(setup.endAngle) < (3 * Math.PI) / 180 && setup.impactVertex && (
          <p className="flex items-start gap-1.5 rounded-md border border-lab-warn/50 bg-lab-warn/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-200">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-lab-warn" aria-hidden="true" />
            El giro máximo es de solo {fmtFixed(Math.abs((setup.endAngle * 180) / Math.PI), 1)}°: el vértice (
            {fmtTrim(setup.impactVertex.x, 2)}, {fmtTrim(setup.impactVertex.y, 2)}) cm está casi a ras de suelo más allá
            del pivote {setup.pivotLabel}, así que el suelo detiene el vuelco casi de inmediato. Eleva la figura o mueve
            los apoyos para ver un vuelco mayor.
          </p>
        )}
        <TipFormulas setup={setup} />
        <SpeedControl />
        {done && (
          <button
            type="button"
            onClick={replay}
            className="flex items-center gap-1.5 rounded-md border border-lab-accent/50 bg-lab-accent/10 px-3 py-1.5 text-xs font-medium text-lab-accent transition-colors duration-150 hover:bg-lab-accent/20"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Repetir
          </button>
        )}
        <p className="text-[10px] text-slate-500">Integración de Euler semi-implícita con dt = 1/120 s (independiente de los FPS).</p>
      </div>
    </section>
  );
}

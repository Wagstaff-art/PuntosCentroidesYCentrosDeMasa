import type { RefObject } from 'react';
import { SHAPE_LABELS, type Shape } from '../types';
import type { MassAnalysis } from '../lib/physics';
import type { SimSnapshot } from '../lib/dynamics';
import { displayStatus } from '../lib/status';
import { fmtFixed, fmtTrim } from '../lib/format';
import { Derivation } from './Derivation';

export interface ReportData {
  date: Date;
  image: string | null;
  name: string;
  shapes: Shape[];
  analysis: MassAnalysis;
  sim: SimSnapshot;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th scope="row" className="border px-2 py-1 text-left font-normal">
        {k}
      </th>
      <td className="num border px-2 py-1 text-right">{v}</td>
    </tr>
  );
}

/** Vista imprimible (solo visible en @media print) con tablas, resultados, desarrollo e imagen del lienzo. */
export function PrintReport({ data, imgRef }: { data: ReportData; imgRef: RefObject<HTMLImageElement> }) {
  const a = data.analysis;
  const st = a.stability;
  const r = a.reactions;
  const status = displayStatus(a, data.sim);
  const symbol = a.status === 'estable' ? '✔' : a.status === 'inestable' ? '✖' : '⚠';
  const val = (v: number | null, unit: string) => (v === null ? '—' : `${fmtFixed(v)} ${unit}`);

  return (
    <article className="print-report hidden space-y-4 p-2 text-[11px] print:block">
      <header className="avoid-break border-b pb-2">
        <h1 className="text-lg font-bold">Reporte técnico — Laboratorio Virtual de Estabilidad</h1>
        <p>
          Modelo: <strong>{data.name}</strong> · {data.date.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
        </p>
        <p className="mt-1 text-sm font-bold">
          Estado: {symbol} {status}
          {st && !st.stable && st.pivot ? ` (pivote crítico ${st.pivot}, margen ${fmtFixed(st.margin)} cm)` : ''}
        </p>
      </header>

      {data.image && (
        <figure className="avoid-break">
          <img ref={imgRef} src={data.image} alt={`Lienzo del modelo ${data.name}`} className="w-full border" />
          <figcaption className="mt-1 text-[10px]">Captura del lienzo CAD (resolución ×2).</figcaption>
        </figure>
      )}

      <section className="avoid-break">
        <h2 className="mb-1 text-sm font-bold">Figuras</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Figura', 'Tipo', 'm (kg)', 'x (cm)', 'y (cm)', 'A (cm²)', 'ρ (kg/cm²)', 'xᵢ (cm)', 'yᵢ (cm)'].map((h) => (
                <th key={h} scope="col" className="border px-1 py-1 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.shapes.map((b) => (
              <tr key={b.id} className="num">
                <td className="border px-1 py-0.5">{b.name}</td>
                <td className="border px-1 py-0.5">{SHAPE_LABELS[b.kind]}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.m, 2)}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.x, 2)}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.y, 2)}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.area, 2)}</td>
                <td className="border px-1 py-0.5">{fmtFixed(b.density, 4)}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.cx, 2)}</td>
                <td className="border px-1 py-0.5">{fmtTrim(b.cy, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="avoid-break grid grid-cols-2 gap-4">
        <div>
          <h2 className="mb-1 text-sm font-bold">Resultados</h2>
          <table className="w-full border-collapse">
            <tbody>
              <Row k="Área total A = ΣAᵢ" v={`${fmtTrim(a.totalArea, 2)} cm²`} />
              <Row k="Masa total M = Σmᵢ" v={`${fmtTrim(a.totalMass, 2)} kg`} />
              <Row k="x̄_G" v={val(a.centroid.x.value, 'cm')} />
              <Row k="ȳ_G" v={val(a.centroid.y.value, 'cm')} />
              <Row k="x̄_CM" v={val(a.centerOfMass.x.value, 'cm')} />
              <Row k="ȳ_CM" v={val(a.centerOfMass.y.value, 'cm')} />
              <Row k="Base [xmin, xmax]" v={`[${fmtTrim(a.base.xmin)}, ${fmtTrim(a.base.xmax)}] cm`} />
              <Row k="Margen" v={st ? `${fmtFixed(st.margin)} cm` : '—'} />
              <Row k="Pivote crítico" v={st?.pivot ?? '—'} />
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-1 text-sm font-bold">{r ? 'Reacciones' : 'Vuelco'}</h2>
          <table className="w-full border-collapse">
            <tbody>
              {r ? (
                <>
                  <Row k="W = M·g" v={`${fmtFixed(r.weight)} N`} />
                  <Row k="R_A" v={`${fmtFixed(r.RA)} N`} />
                  <Row k="R_B" v={`${fmtFixed(r.RB)} N`} />
                  <Row k="ΣF_y" v={`${fmtFixed(r.sumFy)} N`} />
                  <Row k={`Στ respecto a ${a.base.minLabel}`} v={`${fmtFixed(r.sumTorque)} N·m`} />
                </>
              ) : (
                <>
                  <Row k="W = M·g" v={`${fmtFixed(a.totalMass * a.g)} N`} />
                  <Row k="Momento de vuelco" v={a.overturningMoment === null ? '—' : `${fmtFixed(a.overturningMoment)} N·m`} />
                  {data.sim.setup && <Row k="I_P" v={`${fmtFixed(data.sim.setup.inertia, 4)} kg·m²`} />}
                  {data.sim.state && <Row k="θ final / t" v={`${fmtFixed((data.sim.state.theta * 180) / Math.PI, 2)}° / ${fmtFixed(data.sim.state.t, 3)} s`} />}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {a.status !== 'sin_masa' && (
        <section>
          <h2 className="mb-1 text-sm font-bold">Desarrollo paso a paso</h2>
          <Derivation analysis={a} />
        </section>
      )}
    </article>
  );
}

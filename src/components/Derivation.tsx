import { memo, useMemo, type ReactNode } from 'react';
import { SHAPE_LABELS } from '../types';
import type { MassAnalysis } from '../lib/physics';
import { buildDerivation } from '../lib/derivation';
import { fmtFixed, fmtTrim } from '../lib/format';
import { Tex } from './Tex';

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="panel-card space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-200">
        <span className="num flex h-5 w-5 items-center justify-center rounded-full border border-lab-accent/60 text-[10px] text-lab-accent">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ShapeTable({ a }: { a: MassAnalysis }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full border-collapse text-right text-[11px]">
        <caption className="sr-only">Propiedades de cada figura</caption>
        <thead>
          <tr className="border-b border-lab-border text-slate-400">
            <th scope="col" className="py-1 pr-2 text-left font-medium">i</th>
            <th scope="col" className="px-1 text-left font-medium">tipo</th>
            <th scope="col" className="px-1 font-medium"><Tex tex="A_i" /></th>
            <th scope="col" className="px-1 font-medium"><Tex tex="m_i" /></th>
            <th scope="col" className="px-1 font-medium"><Tex tex="\rho_i" /></th>
            <th scope="col" className="px-1 font-medium"><Tex tex="x_i" /></th>
            <th scope="col" className="pl-1 font-medium"><Tex tex="y_i" /></th>
          </tr>
        </thead>
        <tbody>
          {a.shapes.map((b, i) => (
            <tr key={b.id} className="border-b border-lab-border/50 text-slate-200">
              <th scope="row" className="max-w-[72px] truncate py-1 pr-2 text-left font-normal text-slate-300" title={b.name}>
                {i + 1}. {b.name}
              </th>
              <td className="px-1 text-left text-[10px] text-slate-400">{SHAPE_LABELS[b.kind]}</td>
              <td className="px-1">{fmtTrim(b.area, 2)}</td>
              <td className="px-1">{fmtTrim(b.m, 2)}</td>
              <td className="px-1">{fmtFixed(b.density, 4)}</td>
              <td className="px-1">{fmtTrim(b.cx, 2)}</td>
              <td className="pl-1">{fmtTrim(b.cy, 2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-slate-100">
            <th scope="row" className="py-1 pr-2 text-left font-semibold">Σ</th>
            <td className="px-1" />
            <td className="px-1 font-semibold">{fmtTrim(a.totalArea, 2)}</td>
            <td className="px-1 font-semibold">{fmtTrim(a.totalMass, 2)}</td>
            <td className="px-1" colSpan={3} />
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 text-[10px] text-slate-500">
        Unidades: A en cm², m en kg, ρ = m/A en kg/cm², (xᵢ, yᵢ) = centroide de la figura en cm.
      </p>
    </div>
  );
}

/** Desarrollo paso a paso. Solo se re-renderiza cuando cambia el resultado del motor. */
export const Derivation = memo(function Derivation({ analysis: a }: { analysis: MassAnalysis }) {
  const d = useMemo(() => buildDerivation(a), [a]);

  return (
    <div className="space-y-3">
      <Step n={1} title="Tabla de figuras">
        <ShapeTable a={a} />
        {d.shapeNotes.length > 0 && (
          <div className="space-y-1 rounded-md border border-lab-border bg-lab-panel p-2">
            {d.shapeNotes.map((note, i) => (
              <Tex key={i} tex={note} display className="!py-0.5" />
            ))}
          </div>
        )}
      </Step>

      <Step n={2} title="Centroide geométrico (solo forma)">
        <Tex tex={d.centroidX} display />
        <Tex tex={d.centroidY} display />
      </Step>

      <Step n={3} title="Centro de masa (forma + densidad)">
        <Tex tex={d.comX} display />
        <Tex tex={d.comY} display />
        <div className="rounded-md border border-lab-border bg-lab-panel p-2 text-[11px] leading-relaxed text-slate-400">
          <p className="mb-1 font-semibold text-slate-300">¿Por qué la integral se reduce a «área × centroide»?</p>
          <p>
            Cada figura es homogénea: la integral de x (o de y) sobre su región R<sub>i</sub> vale su área por la coordenada de
            su centroide, <Tex tex="\iint_{R_i} x\,dA = A_i\,x_i" />. Para el rectángulo R<sub>i</sub> = [x₀, x₀ + bᵢ] × [y₀, y₀ + hᵢ]:
          </p>
          <Tex tex={d.integralNote} display />
          <p>
            Como ρᵢ es constante, <Tex tex="\iint_{R_i} x\,\rho_i\,dA = \rho_i A_i x_i = m_i x_i" />, y la integral sobre todo el
            cuerpo se convierte en la suma de las figuras.
          </p>
        </div>
        {d.equationSteps.map((tex, i) => (
          <Tex key={i} tex={tex} display />
        ))}
      </Step>

      {d.stability && (
        <Step n={4} title="Criterio de estabilidad">
          <Tex tex={d.stability} display />
        </Step>
      )}

      {d.reactions && (
        <Step n={5} title="Reacciones y equilibrio">
          <Tex tex={d.reactions} display />
        </Step>
      )}

      {d.overturning && (
        <Step n={5} title="Momento de vuelco respecto al pivote">
          <p className="text-[11px] text-slate-400">
            No hay reacciones no negativas que equilibren el peso: el apoyo opuesto se despega y el cuerpo gira alrededor de P.
          </p>
          <Tex tex={d.overturning} display />
        </Step>
      )}
    </div>
  );
});

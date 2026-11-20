import { useEffect, useId, useState } from 'react';
import { AlertTriangle, PencilLine } from 'lucide-react';
import { useAnalysis } from '../state/AnalysisContext';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useTools } from '../state/ToolsContext';
import { numericFieldsOf } from '../state/model';
import { EQUATION_INTERVAL, SHAPE_LIMITS } from '../lib/limits';
import { compileExpr } from '../lib/expr';
import { fmtFixed } from '../lib/format';
import { SHAPE_LABELS, type Shape, type ShapeField } from '../types';
import { NumberField } from './NumberField';
import { KindIcon } from './KindIcon';

const COMMON: readonly ShapeField[] = ['m', 'x', 'y'];

/** Campo de expresión f(x)/g(x): valida en vivo y solo confirma si es válida. */
function ExprField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const r = compileExpr(draft);
  const invalid = !r.ok;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        spellCheck={false}
        className={`field-input num w-full ${invalid ? 'border-lab-danger' : ''}`}
        value={draft}
        aria-invalid={invalid}
        onChange={(e) => {
          setDraft(e.target.value);
          const c = compileExpr(e.target.value);
          if (c.ok) onCommit(e.target.value);
        }}
      />
      {invalid && <p className="text-[10px] text-lab-danger">{r.error}</p>}
    </div>
  );
}

function update(dispatch: ReturnType<typeof useModelDispatch>, shape: Shape, patch: Record<string, unknown>): void {
  dispatch({ type: 'shape/update', id: shape.id, patch: patch as never });
}

/** Inspector por tipo de figura: campos propios, reflejos y bloque derivado. */
export function ShapeInspector() {
  const { shapes, selectedId } = useModel();
  const dispatch = useModelDispatch();
  const { analysis } = useAnalysis();
  const { openDialog } = useTools();
  const nameId = useId();
  const shape = shapes.find((b) => b.id === selectedId);
  const derived = shape ? analysis.shapes.find((p) => p.id === shape.id) : undefined;
  const invalid = shape ? analysis.invalid.find((i) => i.id === shape.id) : undefined;

  if (!shape) {
    return (
      <section aria-labelledby="titulo-inspector" className="space-y-2">
        <h2 id="titulo-inspector" className="section-title">
          Inspector de figura
        </h2>
        <p className="panel-card text-xs text-slate-400">Selecciona una figura de la lista o del lienzo.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-inspector" className="space-y-2">
      <h2 id="titulo-inspector" className="section-title">
        Inspector de figura
      </h2>
      <div className="panel-card space-y-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-lab-accent">
          <KindIcon kind={shape.kind} size={14} />
          {SHAPE_LABELS[shape.kind]}
        </p>
        {invalid && (
          <p role="alert" className="flex items-start gap-1.5 rounded border border-lab-danger/50 bg-lab-danger/10 p-2 text-[11px] text-lab-danger">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {invalid.error}
          </p>
        )}
        <div className="space-y-1">
          <label htmlFor={nameId} className="text-xs text-slate-300">
            Nombre
          </label>
          <input
            id={nameId}
            type="text"
            maxLength={40}
            className="field-input w-full"
            value={shape.name}
            onChange={(e) => update(dispatch, shape, { name: e.target.value })}
          />
        </div>

        {shape.kind === 'equation' && (
          <>
            <ExprField label="f(x) — borde superior" value={shape.f} onCommit={(v) => update(dispatch, shape, { f: v })} />
            <ExprField label="g(x) — borde inferior" value={shape.g} onCommit={(v) => update(dispatch, shape, { g: v })} />
            <NumberField
              label="Extremo a"
              value={shape.a}
              min={EQUATION_INTERVAL.min}
              max={EQUATION_INTERVAL.max}
              step={1}
              unit="cm"
              onChange={(v) => update(dispatch, shape, { a: v })}
            />
            <NumberField
              label="Extremo b"
              value={shape.b}
              min={EQUATION_INTERVAL.min}
              max={EQUATION_INTERVAL.max}
              step={1}
              unit="cm"
              onChange={(v) => update(dispatch, shape, { b: v })}
            />
            <button type="button" className="btn w-full justify-center" onClick={() => openDialog({ kind: 'equation', shapeId: shape.id })}>
              <PencilLine size={13} aria-hidden="true" />
              Editar en diálogo…
            </button>
          </>
        )}

        {shape.kind === 'polygon' && (
          <>
            <p className="text-[11px] text-slate-400">Polígono de {shape.points.length} vértices.</p>
            <button type="button" className="btn w-full justify-center" onClick={() => openDialog({ kind: 'polygon', shapeId: shape.id })}>
              <PencilLine size={13} aria-hidden="true" />
              Editar vértices…
            </button>
          </>
        )}

        {[...numericFieldsOf(shape), ...COMMON].map((f) => {
          const lim = SHAPE_LIMITS[f];
          return (
            <NumberField
              key={f}
              label={lim.label}
              value={(shape as unknown as Record<string, number>)[f] ?? 0}
              min={lim.min}
              max={lim.max}
              step={lim.step}
              unit={lim.unit}
              onChange={(v) => update(dispatch, shape, { [f]: v })}
            />
          );
        })}

        {shape.kind !== 'circle' && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={shape.flipX}
                onChange={(e) => update(dispatch, shape, { flipX: e.target.checked })}
              />
              Reflejar en X
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={shape.flipY}
                onChange={(e) => update(dispatch, shape, { flipY: e.target.checked })}
              />
              Reflejar en Y
            </label>
          </div>
        )}

        {derived && (
          <dl className="num space-y-0.5 rounded border border-lab-border bg-lab-bg/60 p-2 text-[10.5px] text-slate-400">
            <div className="flex justify-between">
              <dt>A</dt>
              <dd className="text-slate-200">{fmtFixed(derived.area)} cm²</dd>
            </div>
            <div className="flex justify-between">
              <dt>ρ</dt>
              <dd className="text-slate-200">{fmtFixed(derived.density, 4)} kg/cm²</dd>
            </div>
            <div className="flex justify-between">
              <dt>Centroide</dt>
              <dd className="text-slate-200">
                ({fmtFixed(derived.cx)}, {fmtFixed(derived.cy)}) cm
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>J_c</dt>
              <dd className="text-slate-200">{fmtFixed(derived.jc)} cm⁴</dd>
            </div>
          </dl>
        )}
        <p className="text-[11px] leading-snug text-slate-500">(x, y) es la esquina inferior izquierda de la caja envolvente.</p>
      </div>
    </section>
  );
}

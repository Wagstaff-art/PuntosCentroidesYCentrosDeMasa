import { useId, useMemo, useState } from 'react';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useTools } from '../state/ToolsContext';
import { useAnalysis } from '../state/AnalysisContext';
import { compileExpr, exprToTex } from '../lib/expr';
import { equationMoments } from '../lib/shapes';
import { fmtFixed, fmtTrim } from '../lib/format';
import { Modal } from './ui/Modal';
import { Tex } from './Tex';

interface Template {
  label: string;
  f: string;
  g: string;
  a: number;
  b: number;
}

const TEMPLATES: Template[] = [
  { label: 'Parábola 20 − x²/20 en [−20, 20]', f: '20 - x^2/20', g: '0', a: -20, b: 20 },
  { label: 'Semicírculo √(100 − x²) en [−10, 10]', f: 'sqrt(100 - x^2)', g: '0', a: -10, b: 10 },
  { label: 'Seno 10 + 5·sin(x/5) en [0, 30]', f: '10 + 5 sin(x/5)', g: '0', a: 0, b: 30 },
  { label: 'Entre curvas: f = x/2 + 10, g = x²/40 en [0, 20]', f: 'x/2 + 10', g: 'x^2/40', a: 0, b: 20 },
];

const PREVIEW_N = 80;

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

/** Campo de expresión con error de parseo + marcador de posición. */
function ExprInput({ label, value, onChange }: FieldProps) {
  const id = useId();
  const r = useMemo(() => compileExpr(value), [value]);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        spellCheck={false}
        className={`field-input num w-full ${!r.ok ? 'border-lab-danger' : ''}`}
        value={value}
        aria-invalid={!r.ok}
        onChange={(e) => onChange(e.target.value)}
      />
      {!r.ok && (
        <div className="num text-[10px]">
          <pre className="whitespace-pre-wrap text-slate-500">
            {value}
            {'\n'}
            {' '.repeat(Math.max(0, r.position))}^
          </pre>
          <p className="text-lab-danger">{r.error}</p>
        </div>
      )}
    </div>
  );
}

/** Vista previa SVG de la región g(x) ≤ y ≤ f(x) con ejes. */
function RegionPreview({ f, g, a, b }: { f: string; g: string; a: number; b: number }) {
  const fc = compileExpr(f);
  const gc = compileExpr(g);
  if (!fc.ok || !gc.ok || !(b > a)) {
    return <div className="flex h-28 items-center justify-center rounded border border-lab-border bg-lab-bg/60 text-[10.5px] text-lab-muted">Vista previa no disponible</div>;
  }
  const pts: { x: number; f: number; g: number }[] = [];
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i <= PREVIEW_N; i += 1) {
    const x = a + ((b - a) * i) / PREVIEW_N;
    const fv = fc.fn(x);
    const gv = gc.fn(x);
    if (!Number.isFinite(fv) || !Number.isFinite(gv)) {
      return <div className="flex h-28 items-center justify-center rounded border border-lab-border bg-lab-bg/60 text-[10.5px] text-lab-muted">Vista previa no disponible</div>;
    }
    pts.push({ x, f: fv, g: gv });
    ymin = Math.min(ymin, fv, gv);
    ymax = Math.max(ymax, fv, gv);
  }
  const W = 320;
  const H = 112;
  const pad = 8;
  const sx = (x: number) => pad + ((x - a) / (b - a)) * (W - 2 * pad);
  const span = ymax - ymin || 1;
  const sy = (y: number) => H - pad - ((y - ymin) / span) * (H - 2 * pad);
  const path = `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.f).toFixed(1)}`).join(' ')} ${[...pts]
    .reverse()
    .map((p) => `L${sx(p.x).toFixed(1)},${sy(p.g).toFixed(1)}`)
    .join(' ')} Z`;
  const gy = sy(Math.max(ymin, Math.min(ymax, 0)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full rounded border border-lab-border bg-lab-bg/60" role="img" aria-label="Vista previa de la región">
      <line x1={pad} x2={W - pad} y1={gy} y2={gy} stroke="#475569" strokeWidth="0.8" />
      <line x1={sx(Math.max(a, Math.min(b, 0)))} x2={sx(Math.max(a, Math.min(b, 0)))} y1={pad} y2={H - pad} stroke="#475569" strokeWidth="0.8" />
      <path d={path} fill="rgba(56,189,248,0.25)" stroke="#38BDF8" strokeWidth="1.2" />
    </svg>
  );
}

/** Diálogo de región por ecuación: validación en vivo, vista previa y momentos. */
export function EquationDialog() {
  const { dialog, closeDialog } = useTools();
  const { shapes, snap } = useModel();
  const dispatch = useModelDispatch();
  const { analysis } = useAnalysis();
  const editing = dialog?.kind === 'equation' && dialog.shapeId ? shapes.find((s) => s.id === dialog.shapeId && s.kind === 'equation') : undefined;
  const at = dialog?.kind === 'equation' ? dialog.at : undefined;

  const existing = editing && editing.kind === 'equation' ? editing : null;
  const [name, setName] = useState(existing?.name ?? 'Región f–g');
  const [f, setF] = useState(existing?.f ?? TEMPLATES[0]!.f);
  const [g, setG] = useState(existing?.g ?? TEMPLATES[0]!.g);
  const [a, setA] = useState(existing?.a ?? TEMPLATES[0]!.a);
  const [b, setB] = useState(existing?.b ?? TEMPLATES[0]!.b);
  const [m, setM] = useState(existing?.m ?? 30);

  const moments = useMemo(() => equationMoments(f, g, a, b), [f, g, a, b]);
  const valid = moments.ok;

  const applyTemplate = (label: string) => {
    const t = TEMPLATES.find((x) => x.label === label);
    if (!t) return;
    setF(t.f);
    setG(t.g);
    setA(t.a);
    setB(t.b);
  };

  const create = () => {
    if (!moments.ok) return;
    let cx = 0;
    let cy: number;
    if (at) {
      cx = at.x;
      cy = at.y;
    } else {
      const top = analysis.shapes.reduce((acc, s) => Math.max(acc, ...s.polygon.map((p) => p.y)), 0);
      cy = top + (moments.m.ymax - moments.m.ymin) / 2;
    }
    const q = snap ? Math.round : (v: number) => Math.round(v * 100) / 100;
    if (existing) {
      dispatch({ type: 'shape/update', id: existing.id, patch: { name, f, g, a, b, m } as never });
    } else {
      dispatch({
        type: 'shape/insert',
        shape: {
          id: '',
          name,
          kind: 'equation',
          f,
          g,
          a,
          b,
          m,
          x: q(cx - (b - a) / 2),
          y: q(cy - (moments.m.ymax - moments.m.ymin) / 2),
          flipX: false,
          flipY: false,
        },
      });
    }
    closeDialog();
  };

  const fTex = useMemo(() => exprToTex(f), [f]);
  const gTex = useMemo(() => exprToTex(g), [g]);
  const tex = valid
    ? [
        '\\begin{aligned}',
        `A &= \\int_{${fmtTrim(a)}}^{${fmtTrim(b)}}\\!\\left[${fTex} - \\left(${gTex}\\right)\\right]dx = ${fmtFixed(moments.m.area)}\\ \\text{cm}^2 \\\\[4pt]`,
        `\\bar x &= ${fmtFixed(moments.m.xb)}\\ \\text{cm} \\qquad \\bar y = ${fmtFixed(moments.m.yb)}\\ \\text{cm}`,
        '\\end{aligned}',
      ].join('\n')
    : null;

  return (
    <Modal title={existing ? 'Editar región f–g' : 'Nueva región por ecuación'} onClose={closeDialog} widthClass="w-[640px]">
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="eq-template" className="text-xs text-slate-300">
              Plantilla
            </label>
            <select id="eq-template" className="field-input w-full" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="" disabled>
                Elegir una plantilla…
              </option>
              {TEMPLATES.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="eq-name" className="text-xs text-slate-300">
              Nombre
            </label>
            <input id="eq-name" type="text" maxLength={40} className="field-input w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <ExprInput label="f(x) — borde superior" value={f} onChange={setF} />
          <ExprInput label="g(x) — borde inferior" value={g} onChange={setG} />
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label htmlFor="eq-a" className="text-xs text-slate-300">
                a
              </label>
              <input id="eq-a" type="number" className="field-input num w-full" value={a} step="any" onChange={(e) => setA(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-b" className="text-xs text-slate-300">
                b
              </label>
              <input id="eq-b" type="number" className="field-input num w-full" value={b} step="any" onChange={(e) => setB(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-m" className="text-xs text-slate-300">
                m (kg)
              </label>
              <input id="eq-m" type="number" className="field-input num w-full" value={m} min={0.1} step="any" onChange={(e) => setM(Number(e.target.value))} />
            </div>
          </div>
          {!valid && <p role="alert" className="rounded border border-lab-danger/50 bg-lab-danger/10 p-2 text-[11px] text-lab-danger">{moments.error}</p>}
        </div>
        <div className="space-y-2">
          <RegionPreview f={f} g={g} a={a} b={b} />
          {tex && (
            <div className="overflow-x-auto rounded border border-lab-border bg-lab-bg/60 p-2 text-xs">
              <Tex tex={tex} display />
              <p className="mt-1 text-[10px] text-lab-muted">Integración por Simpson, n = 600.</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" onClick={closeDialog}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" disabled={!valid || !(m > 0)} onClick={create}>
          {existing ? 'Guardar' : 'Crear figura'}
        </button>
      </div>
    </Modal>
  );
}

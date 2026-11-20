import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useTools } from '../state/ToolsContext';
import { POLYGON_LIMITS } from '../lib/limits';
import { shapeGeometry } from '../lib/shapes';
import { Modal } from './ui/Modal';

interface Vtx {
  x: number;
  y: number;
}

/** Normaliza vértices para que el mínimo de la caja sea (0, 0). */
function normalize(pts: Vtx[]): Vtx[] {
  const mx = Math.min(...pts.map((p) => p.x));
  const my = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - mx, y: p.y - my }));
}

function previewPath(pts: Vtx[]): { d: string; vb: string } {
  const n = normalize(pts);
  const w = Math.max(...n.map((p) => p.x), 1);
  const h = Math.max(...n.map((p) => p.y), 1);
  const pad = 8;
  const W = 240;
  const H = 160;
  const k = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  const sx = (x: number) => pad + x * k;
  const sy = (y: number) => H - pad - y * k;
  return {
    d: `${n.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} Z`,
    vb: `0 0 ${W} ${H}`,
  };
}

/** Diálogo de edición de vértices de un polígono, con validación y vista previa. */
export function PolygonDialog() {
  const { dialog, closeDialog } = useTools();
  const { shapes } = useModel();
  const dispatch = useModelDispatch();
  const shape = dialog?.kind === 'polygon' ? shapes.find((s) => s.id === dialog.shapeId && s.kind === 'polygon') : undefined;
  const src = shape && shape.kind === 'polygon' ? shape : null;
  const [pts, setPts] = useState<Vtx[]>(src ? src.points.map((p) => ({ ...p })) : []);

  const validation = useMemo(() => {
    if (pts.length < POLYGON_LIMITS.minVertices) return { ok: false as const, error: `Se necesitan al menos ${POLYGON_LIMITS.minVertices} vértices` };
    if (pts.length > POLYGON_LIMITS.maxVertices) return { ok: false as const, error: `Máximo ${POLYGON_LIMITS.maxVertices} vértices` };
    if (pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { ok: false as const, error: 'Coordenada no finita' };
    const n = normalize(pts);
    if (n.some((p) => p.x > POLYGON_LIMITS.coordMax || p.y > POLYGON_LIMITS.coordMax)) {
      return { ok: false as const, error: `Las coordenadas no pueden exceder ${POLYGON_LIMITS.coordMax} cm` };
    }
    const r = shapeGeometry({
      id: 'tmp',
      name: 'tmp',
      kind: 'polygon',
      points: n,
      m: 1,
      x: 0,
      y: 0,
      flipX: false,
      flipY: false,
    });
    if (!r.ok) return { ok: false as const, error: r.error };
    return { ok: true as const };
  }, [pts]);

  if (!src) return null;

  const setPt = (i: number, key: 'x' | 'y', v: number) => {
    setPts((p) => p.map((q, j) => (j === i ? { ...q, [key]: v } : q)));
  };
  const remove = (i: number) => setPts((p) => p.filter((_, j) => j !== i));
  const add = () => {
    const last = pts[pts.length - 1] ?? { x: 0, y: 0 };
    setPts((p) => [...p, { x: last.x + 10, y: last.y + 10 }]);
  };
  const save = () => {
    if (!validation.ok) return;
    dispatch({ type: 'shape/update', id: src.id, patch: { points: normalize(pts) } });
    closeDialog();
  };

  const preview = pts.length >= 3 && pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ? previewPath(pts) : null;

  return (
    <Modal title={`Vértices de ${src.name}`} onClose={closeDialog} widthClass="w-[480px]">
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="space-y-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-lab-muted">
                <th className="pb-1 font-medium">#</th>
                <th className="pb-1 font-medium">x (cm)</th>
                <th className="pb-1 font-medium">y (cm)</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {pts.map((p, i) => (
                <tr key={i}>
                  <td className="num py-0.5 pr-1 text-lab-muted">{i + 1}</td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      step="any"
                      className="field-input num w-full"
                      value={p.x}
                      aria-label={`x del vértice ${i + 1}`}
                      onChange={(e) => setPt(i, 'x', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-0.5 pr-1">
                    <input
                      type="number"
                      step="any"
                      className="field-input num w-full"
                      value={p.y}
                      aria-label={`y del vértice ${i + 1}`}
                      onChange={(e) => setPt(i, 'y', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-0.5">
                    <button type="button" className="btn-icon" aria-label={`Eliminar vértice ${i + 1}`} onClick={() => remove(i)}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn h-7" onClick={add}>
            <Plus size={13} aria-hidden="true" />
            Añadir vértice
          </button>
          {!validation.ok && (
            <p role="alert" className="rounded border border-lab-danger/50 bg-lab-danger/10 p-2 text-[11px] text-lab-danger">
              {validation.error}
            </p>
          )}
        </div>
        <div>
          {preview ? (
            <svg viewBox={preview.vb} className="w-full rounded border border-lab-border bg-lab-bg/60" role="img" aria-label="Vista previa del polígono">
              <path d={preview.d} fill="rgba(56,189,248,0.25)" stroke="#38BDF8" strokeWidth="1.2" />
            </svg>
          ) : (
            <div className="flex h-40 items-center justify-center rounded border border-lab-border bg-lab-bg/60 text-[10.5px] text-lab-muted">
              Vista previa no disponible
            </div>
          )}
          <p className="mt-1 text-[10px] text-lab-muted">Los vértices se normalizan para que el mínimo de la caja sea (0, 0).</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" onClick={closeDialog}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" disabled={!validation.ok} onClick={save}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

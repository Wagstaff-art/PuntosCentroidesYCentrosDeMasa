import { Copy, Plus, Trash2 } from 'lucide-react';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { roundTo } from '../lib/limits';
import { SHAPE_LABELS, type Shape } from '../types';
import { KindIcon } from './KindIcon';

/** Resumen corto de dimensiones según el tipo de figura. */
function dims(s: Shape): string {
  switch (s.kind) {
    case 'rect':
    case 'triangle':
      return `${roundTo(s.b, 2)}×${roundTo(s.h, 2)} cm`;
    case 'circle':
      return `r = ${roundTo(s.r, 2)} cm`;
    case 'semicircle':
    case 'quarter':
      return `r = ${roundTo(s.r, 2)} cm`;
    case 'trapezoid':
      return `${roundTo(s.b, 2)}/${roundTo(s.a, 2)}×${roundTo(s.h, 2)} cm`;
    case 'polygon':
      return `${s.points.length} vértices`;
    case 'equation':
      return `x ∈ [${roundTo(s.a, 2)}, ${roundTo(s.b, 2)}]`;
  }
}

export function BlockList() {
  const { shapes, selectedId } = useModel();
  const dispatch = useModelDispatch();

  return (
    <section aria-labelledby="titulo-bloques" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="titulo-bloques" className="section-title">
          Figuras <span className="num text-slate-500">({shapes.length})</span>
        </h2>
        <button type="button" className="btn h-7" onClick={() => dispatch({ type: 'shape/add' })}>
          <Plus size={14} aria-hidden="true" />
          Añadir
        </button>
      </div>

      {shapes.length === 0 ? (
        <p className="panel-card text-xs text-slate-400">No hay figuras. Añade una para comenzar.</p>
      ) : (
        <ul className="space-y-1">
          {shapes.map((b) => {
            const active = b.id === selectedId;
            return (
              <li
                key={b.id}
                className={`group flex items-center gap-1 rounded-md border pr-1 transition-colors ${
                  active ? 'border-lab-accent/70 bg-lab-accent/10' : 'border-lab-border bg-lab-bg/40 hover:border-slate-600'
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  onClick={() => dispatch({ type: 'shape/select', id: b.id })}
                  aria-current={active ? 'true' : undefined}
                >
                  <KindIcon kind={b.kind} size={14} className={active ? 'text-lab-accent' : 'text-slate-500'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-100">{b.name}</span>
                    <span className="num block text-[10px] text-slate-400">
                      {SHAPE_LABELS[b.kind]} · {dims(b)} · {roundTo(b.m, 2)} kg
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => dispatch({ type: 'shape/duplicate', id: b.id })}
                  aria-label={`Duplicar ${b.name}`}
                  title="Duplicar"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-icon hover:text-lab-danger"
                  onClick={() => dispatch({ type: 'shape/delete', id: b.id })}
                  aria-label={`Eliminar ${b.name}`}
                  title="Eliminar"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

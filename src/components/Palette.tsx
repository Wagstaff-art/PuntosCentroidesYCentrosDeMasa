import type { DragEvent } from 'react';
import { SHAPE_MIME, dragPayload } from '../state/ToolsContext';
import { SHAPE_LABELS, type ShapeKind } from '../types';
import { useAddShape } from './useAddShape';
import { KindIcon } from './KindIcon';
import { PresetCards } from './PresetCards';

const KINDS: ShapeKind[] = ['rect', 'triangle', 'circle', 'semicircle', 'quarter', 'trapezoid', 'polygon', 'equation'];

/** Paleta de figuras: tiles arrastrables al lienzo (clic/Enter = añadir apilada). */
export function Palette() {
  const addShape = useAddShape();
  const onDragStart = (kind: ShapeKind) => (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(SHAPE_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
    dragPayload.kind = kind;
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="titulo-paleta" className="space-y-2">
        <h2 id="titulo-paleta" className="section-title">
          Paleta de figuras
        </h2>
        <p className="text-[10.5px] text-lab-muted">Arrastra al lienzo o haz clic para añadir sobre la figura más alta.</p>
        <ul className="grid grid-cols-2 gap-1.5">
          {KINDS.map((k) => (
            <li key={k}>
              <button
                type="button"
                draggable
                onDragStart={onDragStart(k)}
                onDragEnd={() => {
                  dragPayload.kind = null;
                }}
                onClick={() => addShape(k)}
                className="flex w-full cursor-grab items-center gap-2 rounded-md border border-lab-border bg-lab-surface-1 px-2 py-2 text-left text-[11px] text-slate-200 transition-colors duration-150 hover:border-lab-accent/50 hover:bg-lab-surface-2 active:cursor-grabbing"
              >
                <KindIcon kind={k} size={18} className="shrink-0 text-lab-accent" />
                {SHAPE_LABELS[k]}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <PresetCards />
    </div>
  );
}

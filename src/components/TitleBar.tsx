import { useEffect, useRef, useState } from 'react';
import { Keyboard, Scale } from 'lucide-react';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useTools } from '../state/ToolsContext';
import { ExportMenu } from './ExportMenu';

/** Barra de título (h-10): marca, ruta editable del modelo, unidades, exportar y atajos. */
export function TitleBar() {
  const { name } = useModel();
  const dispatch = useModelDispatch();
  const { openDialog } = useTools();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== name) dispatch({ type: 'model/rename', name: draft.trim() });
    else setDraft(name);
  };

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-lab-border bg-lab-panel px-3">
      <Scale size={16} className="shrink-0 text-lab-accent" aria-hidden="true" />
      <h1 className="whitespace-nowrap text-[13px] font-semibold text-white">
        Laboratorio Virtual de Estabilidad
        <span className="ml-2 hidden text-[11px] font-normal text-lab-muted md:inline">CAD &amp; Mass Properties</span>
      </h1>
      <div className="mx-1 h-5 w-px shrink-0 bg-lab-border" aria-hidden="true" />
      <nav aria-label="Ruta del modelo" className="flex min-w-0 items-center gap-1 text-[11px] text-lab-muted">
        <span>Proyecto</span>
        <span aria-hidden="true">/</span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="field-input num h-6 w-44"
            value={draft}
            maxLength={40}
            aria-label="Nombre del modelo"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="max-w-[240px] truncate rounded px-1 py-0.5 text-slate-200 transition-colors hover:bg-lab-border hover:text-white"
            title="Renombrar el modelo"
            onClick={() => setEditing(true)}
          >
            {name}
          </button>
        )}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="num hidden rounded border border-lab-border bg-lab-surface-1 px-2 py-0.5 text-[10px] text-lab-muted lg:inline">
          cm · kg · g = 9,81 m/s²
        </span>
        <ExportMenu />
        <button type="button" className="btn-icon" aria-label="Atajos de teclado" onClick={() => openDialog({ kind: 'shortcuts' })}>
          <Keyboard size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

import { useState, useSyncExternalStore, type DragEvent, type ReactNode } from 'react';
import {
  BookOpen,
  ChevronDown,
  Crosshair,
  FilePlus2,
  Grid3X3,
  Info,
  Magnet,
  Play,
  RotateCcw,
  Ruler,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAnalysis } from '../state/AnalysisContext';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { useSimulation } from '../state/SimulationContext';
import { useView, useViewActions } from '../state/ViewContext';
import { SHAPE_MIME, dragPayload, useTools } from '../state/ToolsContext';
import { ZOOM_MAX, ZOOM_MIN } from '../lib/limits';
import { PRESETS, presetToSnapshot } from '../data/presets';
import { SHAPE_LABELS, type ShapeKind } from '../types';
import { useAddShape } from './useAddShape';
import { Tooltip } from './ui/Tooltip';
import { KindIcon } from './KindIcon';
import { ConfirmDialog } from './ui/ConfirmDialog';

const PALETTE_KINDS: ShapeKind[] = ['rect', 'triangle', 'circle', 'semicircle', 'quarter', 'trapezoid'];
const PRESET_STATUS = { estable: 'ESTABLE', inestable: 'VUELCO' } as const;

function RibbonButton({
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  primary,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        className={`flex h-[52px] w-[52px] flex-col items-center justify-center gap-0.5 rounded-md border text-[11px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
          primary
            ? 'border-lab-accent/60 bg-lab-accent/15 text-lab-accent hover:bg-lab-accent/25'
            : pressed
              ? 'border-lab-accent/60 bg-lab-accent/10 text-lab-accent'
              : 'border-transparent text-slate-300 hover:border-lab-border hover:bg-lab-surface-2 hover:text-white'
        }`}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={pressed}
      >
        {children}
        <span className="leading-none">{label}</span>
      </button>
    </Tooltip>
  );
}

function RibbonGroup({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch px-2">
      <div className="flex items-center gap-1">{children}</div>
      <p className="pt-0.5 text-center text-[9.5px] font-medium uppercase tracking-wider text-lab-muted max-lg:hidden">{caption}</p>
    </div>
  );
}

function Divider() {
  return <div className="mx-1 w-px self-stretch bg-lab-border" aria-hidden="true" />;
}

function ShapeTileButton({ kind, onAdd }: { kind: ShapeKind; onAdd: () => void }) {
  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(SHAPE_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
    dragPayload.kind = kind;
  };
  return (
    <Tooltip label={`${SHAPE_LABELS[kind]}: clic o arrastra al lienzo`}>
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        onDragEnd={() => {
          dragPayload.kind = null;
        }}
        className="flex h-[52px] min-w-[64px] cursor-grab flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-transparent px-1.5 text-[11px] text-slate-300 transition-colors duration-150 hover:border-lab-border hover:bg-lab-surface-2 hover:text-white active:cursor-grabbing"
        onClick={onAdd}
      >
        <KindIcon kind={kind} size={18} />
        <span className="leading-none">{kind === 'quarter' ? 'Cuarto círc.' : SHAPE_LABELS[kind]}</span>
      </button>
    </Tooltip>
  );
}

/** Cinta estilo Office/Fusion: grupos Modelo · Figuras · Vista · Análisis. */
export function Ribbon() {
  const { shapes, snap, presetId } = useModel();
  const dispatch = useModelDispatch();
  const { analysis } = useAnalysis();
  const sim = useSimulation();
  const simSnap = useSyncExternalStore(sim.store.subscribe, sim.store.getSnapshot);
  const tipDone = simSnap.mode === 'tipping' && simSnap.state?.finished === true;
  const viewState = useView();
  const { zoom } = viewState;
  const view = useViewActions();
  const { openDialog, setTool, tool } = useTools();
  const addShape = useAddShape();
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  const locked = sim.active;
  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) dispatch({ type: 'model/load', snapshot: presetToSnapshot(p) });
    setPresetsOpen(false);
  };
  const newModel = () => {
    sim.stop();
    dispatch({
      type: 'model/load',
      snapshot: { presetId: null, name: 'Modelo sin título', shapes: [], supports: { xA: -20, xB: 20 } },
    });
    setConfirmNew(false);
  };

  return (
    <div className="relative shrink-0 border-b border-lab-border bg-lab-surface-1" role="toolbar" aria-label="Cinta de herramientas">
      <div className="flex h-[72px] items-stretch gap-0 overflow-x-auto px-1 py-1">
        <RibbonGroup caption="Modelo">
          <div className="relative">
            <RibbonButton label="Presets" onClick={() => setPresetsOpen((o) => !o)} disabled={locked}>
              <BookOpen size={18} aria-hidden="true" />
            </RibbonButton>
            {presetsOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setPresetsOpen(false)} />
                <div role="menu" className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-lab-border bg-lab-elevated p-1 shadow-xl">
                  {PRESETS.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-lab-surface-2 ${p.id === presetId ? 'bg-lab-accent/10' : ''}`}
                      onClick={() => loadPreset(p.id)}
                    >
                      <span className="num mt-0.5 w-4 shrink-0 text-[10px] text-lab-muted">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-100">{p.name}</span>
                        <span className="block truncate text-[10px] text-lab-muted">{p.tagline}</span>
                      </span>
                      <span
                        className={`mt-0.5 shrink-0 rounded border px-1 py-px text-[9px] font-semibold ${
                          p.expected.status === 'estable'
                            ? 'border-lab-stable/50 text-lab-stable'
                            : 'border-lab-danger/50 text-lab-danger'
                        }`}
                      >
                        {PRESET_STATUS[p.expected.status]}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <RibbonButton label="Nuevo" onClick={() => (shapes.length > 0 ? setConfirmNew(true) : newModel())} disabled={locked}>
            <FilePlus2 size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton
            label="Reiniciar"
            onClick={() => {
              sim.stop();
              dispatch({ type: 'model/reset' });
            }}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </RibbonButton>
        </RibbonGroup>

        <Divider />

        <RibbonGroup caption="Figuras">
          {PALETTE_KINDS.map((k) => (
            <ShapeTileButton key={k} kind={k} onAdd={() => addShape(k)} />
          ))}
          <div className="relative">
            <div className="flex h-[52px] items-stretch rounded-md border border-transparent transition-colors hover:border-lab-border hover:bg-lab-surface-2">
              <Tooltip label="Polígono: añade la L por defecto">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(SHAPE_MIME, 'polygon');
                    e.dataTransfer.effectAllowed = 'copy';
                    dragPayload.kind = 'polygon';
                  }}
                  onDragEnd={() => {
                    dragPayload.kind = null;
                  }}
                  className="flex cursor-grab flex-col items-center justify-center gap-0.5 rounded-l-md px-1.5 text-[11px] text-slate-300 hover:text-white active:cursor-grabbing"
                  onClick={() => addShape('polygon')}
                >
                  <KindIcon kind="polygon" size={18} />
                  <span className="leading-none">Polígono</span>
                </button>
              </Tooltip>
              <Tooltip label="Dibujar polígono en el lienzo">
                <button
                  type="button"
                  className={`flex items-center rounded-r-md px-0.5 text-slate-400 hover:text-white ${tool === 'drawPolygon' ? 'text-lab-accent' : ''}`}
                  aria-label="Dibujar polígono en el lienzo"
                  aria-pressed={tool === 'drawPolygon'}
                  onClick={() => setTool(tool === 'drawPolygon' ? 'select' : 'drawPolygon')}
                >
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>
          <Tooltip label="Región entre curvas f(x) y g(x)">
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(SHAPE_MIME, 'equation');
                e.dataTransfer.effectAllowed = 'copy';
                dragPayload.kind = 'equation';
              }}
              onDragEnd={() => {
                dragPayload.kind = null;
              }}
              className="flex h-[52px] min-w-[64px] cursor-grab flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-transparent px-1.5 text-[11px] text-slate-300 transition-colors duration-150 hover:border-lab-border hover:bg-lab-surface-2 hover:text-white active:cursor-grabbing"
              onClick={() => openDialog({ kind: 'equation' })}
            >
              <KindIcon kind="equation" size={18} />
              <span className="leading-none">Ecuación</span>
            </button>
          </Tooltip>
        </RibbonGroup>

        <Divider />

        <RibbonGroup caption="Vista">
          <RibbonButton label="Zoom −" shortcut="−" onClick={view.zoomOut} disabled={zoom <= ZOOM_MIN}>
            <ZoomOut size={18} aria-hidden="true" />
          </RibbonButton>
          <Tooltip label="Nivel de zoom">
            <span className="num flex h-[52px] w-[46px] items-center justify-center text-[12px] text-slate-200" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
          </Tooltip>
          <RibbonButton label="Zoom +" shortcut="+" onClick={view.zoomIn} disabled={zoom >= ZOOM_MAX}>
            <ZoomIn size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton label="Centrar" shortcut="F" onClick={view.center}>
            <Crosshair size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton label="Snap" pressed={snap} onClick={() => dispatch({ type: 'snap/set', value: !snap })}>
            <Magnet size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton label="Rejilla" pressed={viewState.showGrid} onClick={view.toggleGrid}>
            <Grid3X3 size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton label="Cotas" pressed={viewState.showDims} onClick={view.toggleDims}>
            <Ruler size={18} aria-hidden="true" />
          </RibbonButton>
          <RibbonButton label="Leyenda" pressed={viewState.showLegend} onClick={view.toggleLegend}>
            <Info size={18} aria-hidden="true" />
          </RibbonButton>
        </RibbonGroup>

        <Divider />

        <RibbonGroup caption="Análisis">
          {tipDone && (
            <RibbonButton label="Repetir" primary onClick={sim.replay}>
              <RotateCcw size={18} aria-hidden="true" />
            </RibbonButton>
          )}
          <RibbonButton
            label={sim.active ? 'Detener' : 'Simular'}
            shortcut={sim.active ? undefined : 'G'}
            primary={!tipDone}
            onClick={sim.active ? sim.stop : sim.start}
            disabled={!sim.active && analysis.status === 'sin_masa'}
          >
            {sim.active ? <Square size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </RibbonButton>
        </RibbonGroup>
      </div>

      {confirmNew && (
        <ConfirmDialog
          title="Nuevo modelo"
          message={`El modelo actual tiene ${shapes.length} figura(s). Crear uno nuevo las descartará. ¿Continuar?`}
          confirmLabel="Descartar y crear"
          onConfirm={newModel}
          onCancel={() => setConfirmNew(false)}
        />
      )}
    </div>
  );
}

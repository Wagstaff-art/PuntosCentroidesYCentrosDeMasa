import { useEffect, useState } from 'react';
import { Anchor, BookOpen, Layers, PanelRight, X } from 'lucide-react';
import { ModelProvider, useModel, useModelDispatch } from './state/ModelContext';
import { ViewProvider, ViewportHandleProvider, useViewActions } from './state/ViewContext';
import { AnalysisProvider, useAnalysis } from './state/AnalysisContext';
import { SimulationProvider, useSimulation } from './state/SimulationContext';
import { ReportProvider } from './state/ReportContext';
import { ToolsProvider, useTools, type LeftSection } from './state/ToolsContext';
import { TitleBar } from './components/TitleBar';
import { Ribbon } from './components/Ribbon';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { Viewport } from './components/Viewport';
import { EquationDialog } from './components/EquationDialog';
import { PolygonDialog } from './components/PolygonDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Toasts } from './components/Toasts';
import { Tooltip } from './components/ui/Tooltip';
import { DEFAULT_PRESET, presetToSnapshot } from './data/presets';

const INITIAL_SNAPSHOT = presetToSnapshot(DEFAULT_PRESET);

const RAIL_SECTIONS: { id: LeftSection; label: string; Icon: typeof Layers }[] = [
  { id: 'biblioteca', label: 'Biblioteca', Icon: BookOpen },
  { id: 'modelo', label: 'Modelo', Icon: Layers },
  { id: 'apoyos', label: 'Apoyos', Icon: Anchor },
];

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
  );
}

function Shell() {
  const { selectedId } = useModel();
  const dispatch = useModelDispatch();
  const sim = useSimulation();
  const { analysis } = useAnalysis();
  const view = useViewActions();
  const { dialog, leftSection, setLeftSection, tool } = useTools();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Atajos globales de la figura seleccionada y de la vista.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || dialog || tool === 'drawPolygon') return;
      if (e.key === 'Delete' && selectedId && !sim.active) {
        dispatch({ type: 'shape/delete', id: selectedId });
      } else if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && selectedId && !sim.active) {
        e.preventDefault();
        dispatch({ type: 'shape/duplicate', id: selectedId });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'shape/select', id: null });
        setLeftOpen(false);
        setRightOpen(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        view.center();
      } else if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (sim.active) sim.stop();
        else if (analysis.status !== 'sin_masa') sim.start();
      } else if (e.key === '+' || e.key === '=') {
        view.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        view.zoomOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, tool, selectedId, sim, analysis.status, dispatch, view]);

  const openLeft = (s: LeftSection) => {
    setLeftSection(s);
    setLeftOpen(true);
    setRightOpen(false);
  };

  return (
    <>
      <div className="flex h-full flex-col bg-lab-bg print:hidden">
        <TitleBar />
        <Ribbon />
        <div className="relative flex min-h-0 flex-1">
          {/* Rail de actividad: siempre visible; en < lg abre el panel como drawer. */}
          <nav aria-label="Secciones del panel" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-lab-border bg-lab-surface-1 py-2 lg:hidden">
            {RAIL_SECTIONS.map(({ id, label, Icon }) => (
              <Tooltip key={id} label={label}>
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={leftOpen && leftSection === id}
                  onClick={() => (leftOpen && leftSection === id ? setLeftOpen(false) : openLeft(id))}
                  className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${
                    leftOpen && leftSection === id ? 'bg-lab-accent/15 text-lab-accent' : 'text-slate-400 hover:bg-lab-surface-2 hover:text-white'
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                </button>
              </Tooltip>
            ))}
            <div className="mt-auto">
              <Tooltip label="Análisis">
                <button
                  type="button"
                  aria-label="Análisis"
                  aria-pressed={rightOpen}
                  onClick={() => {
                    setRightOpen((o) => !o);
                    setLeftOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${
                    rightOpen ? 'bg-lab-accent/15 text-lab-accent' : 'text-slate-400 hover:bg-lab-surface-2 hover:text-white'
                  }`}
                >
                  <PanelRight size={17} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </nav>

          {/* Paneles estáticos en ≥ lg. */}
          <div className="hidden min-h-0 shrink-0 lg:flex">
            <LeftPanel />
          </div>
          <main className="relative min-w-0 flex-1" aria-label="Lienzo de trabajo">
            <Viewport />
          </main>
          <div className="hidden min-h-0 shrink-0 lg:flex">
            <RightPanel />
          </div>

          {/* Drawers en < lg. */}
          {leftOpen && (
            <aside className="absolute inset-y-0 left-12 z-30 flex w-panel-left max-w-[85vw] flex-col border-r border-lab-border bg-lab-panel lg:hidden" aria-label="Panel lateral">
              <button type="button" className="btn-icon absolute -right-8 top-2 z-10 border border-lab-border bg-lab-panel" aria-label="Cerrar panel" onClick={() => setLeftOpen(false)}>
                <X size={14} aria-hidden="true" />
              </button>
              <LeftPanel hideRail />
            </aside>
          )}
          {rightOpen && (
            <aside className="absolute inset-y-0 right-0 z-30 flex w-panel-right max-w-[90vw] flex-col border-l border-lab-border bg-lab-panel lg:hidden" aria-label="Panel de análisis">
              <button type="button" className="btn-icon absolute -left-8 top-2 z-10 border border-lab-border bg-lab-panel" aria-label="Cerrar panel de análisis" onClick={() => setRightOpen(false)}>
                <X size={14} aria-hidden="true" />
              </button>
              <RightPanel />
            </aside>
          )}
          {(leftOpen || rightOpen) && (
            <div
              className="absolute inset-0 z-20 bg-black/40 lg:hidden"
              aria-hidden="true"
              onClick={() => {
                setLeftOpen(false);
                setRightOpen(false);
              }}
            />
          )}
        </div>
        <StatusBar />
      </div>

      {dialog?.kind === 'equation' && <EquationDialog />}
      {dialog?.kind === 'polygon' && <PolygonDialog />}
      {dialog?.kind === 'shortcuts' && <ShortcutsDialog />}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <ModelProvider initial={INITIAL_SNAPSHOT}>
      <AnalysisProvider>
        <ViewProvider>
          <ViewportHandleProvider>
            <ToolsProvider>
              <SimulationProvider>
                <ReportProvider>
                  <Shell />
                </ReportProvider>
              </SimulationProvider>
            </ToolsProvider>
          </ViewportHandleProvider>
        </ViewProvider>
      </AnalysisProvider>
    </ModelProvider>
  );
}

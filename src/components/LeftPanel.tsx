import { Anchor, BookOpen, Layers, Lock } from 'lucide-react';
import { useSimulation } from '../state/SimulationContext';
import { useTools, type LeftSection } from '../state/ToolsContext';
import { Tooltip } from './ui/Tooltip';
import { Palette } from './Palette';
import { BlockList } from './BlockList';
import { ShapeInspector } from './ShapeInspector';
import { SupportsInspector } from './SupportsInspector';

const SECTIONS: { id: LeftSection; label: string; Icon: typeof Layers }[] = [
  { id: 'biblioteca', label: 'Biblioteca', Icon: BookOpen },
  { id: 'modelo', label: 'Modelo', Icon: Layers },
  { id: 'apoyos', label: 'Apoyos', Icon: Anchor },
];

const TITLES: Record<LeftSection, string> = {
  biblioteca: 'Biblioteca',
  modelo: 'Modelo',
  apoyos: 'Apoyos',
};

/** Rail de actividad (w-12) + panel izquierdo (320 px) con sección activa. */
export function LeftPanel({ hideRail = false }: { hideRail?: boolean }) {
  const { leftSection, setLeftSection } = useTools();
  const { active } = useSimulation();

  return (
    <div className="flex h-full min-h-0">
      {!hideRail && (
      <nav aria-label="Secciones del panel" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-lab-border bg-lab-surface-1 py-2">
        {SECTIONS.map(({ id, label, Icon }) => (
          <Tooltip key={id} label={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={leftSection === id}
              onClick={() => setLeftSection(id)}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${
                leftSection === id ? 'bg-lab-accent/15 text-lab-accent' : 'text-slate-400 hover:bg-lab-surface-2 hover:text-white'
              }`}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          </Tooltip>
        ))}
      </nav>
      )}
      <div className="flex w-panel-left min-w-0 flex-1 flex-col border-r border-lab-border bg-lab-panel">
        <div className="flex h-9 shrink-0 items-center border-b border-lab-border px-3">
          <h2 className="section-title !text-slate-200">{TITLES[leftSection]}</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {active && (
            <p role="status" className="flex items-center gap-2 rounded-md border border-lab-warn/50 bg-lab-warn/10 p-2 text-[11px] text-lab-warn">
              <Lock size={13} aria-hidden="true" />
              Edición bloqueada durante la simulación.
            </p>
          )}
          <fieldset disabled={active} className="m-0 min-w-0 space-y-4 border-0 p-0">
            {leftSection === 'biblioteca' && <Palette />}
            {leftSection === 'modelo' && (
              <>
                <BlockList />
                <ShapeInspector />
              </>
            )}
            {leftSection === 'apoyos' && <SupportsInspector />}
          </fieldset>
        </div>
      </div>
    </div>
  );
}

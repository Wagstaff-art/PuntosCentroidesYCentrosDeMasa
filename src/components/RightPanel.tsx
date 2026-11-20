import { useDeferredValue, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useModel } from '../state/ModelContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useSimulation } from '../state/SimulationContext';
import { useTools, type RightTab } from '../state/ToolsContext';
import { PRESETS } from '../data/presets';
import { StabilityCard } from './StabilityCard';
import { ReactionsCard } from './ReactionsCard';
import { Derivation } from './Derivation';
import { SimulationCard } from './SimulationCard';
import { GeometryWarningsList } from './GeometryWarningsList';
import { Accordion } from './ui/Accordion';

const TABS: { id: RightTab; label: string }[] = [
  { id: 'resultados', label: 'Resultados' },
  { id: 'desarrollo', label: 'Desarrollo' },
  { id: 'preset', label: 'Preset' },
];

/** Panel derecho (380 px) con pestañas Resultados / Desarrollo / Preset. */
export function RightPanel() {
  const { presetId } = useModel();
  const { analysis } = useAnalysis();
  const sim = useSimulation();
  const { rightTab, setRightTab } = useTools();
  const deferredAnalysis = useDeferredValue(analysis);
  const preset = PRESETS.find((p) => p.id === presetId);

  useEffect(() => {
    if (sim.active) setRightTab('resultados');
  }, [sim.active, setRightTab]);

  return (
    <div className="flex w-panel-right min-w-0 flex-col border-l border-lab-border bg-lab-panel">
      <div role="tablist" aria-label="Secciones de análisis" className="flex h-9 shrink-0 border-b border-lab-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={rightTab === t.id}
            className={`flex-1 border-b-2 text-[11px] font-medium transition-colors duration-150 ${
              rightTab === t.id ? 'border-lab-accent text-lab-accent' : 'border-transparent text-lab-muted hover:text-slate-200'
            }`}
            onClick={() => setRightTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" role="tabpanel">
        {rightTab === 'resultados' && (
          <>
            <SimulationCard />
            <Accordion title="Diagnóstico de estabilidad">
              <StabilityCard analysis={analysis} hideTitle />
            </Accordion>
            <Accordion title="Reacciones en los apoyos">
              <ReactionsCard analysis={analysis} hideTitle />
            </Accordion>
            <GeometryWarningsList />
          </>
        )}
        {rightTab === 'desarrollo' && (
          <>
            {analysis.status === 'sin_masa' ? (
              <p className="panel-card text-xs text-lab-warn">
                Sin masa (M = 0) no se puede dividir entre ΣAᵢ ni Σmᵢ: añade una figura para ver el desarrollo.
              </p>
            ) : (
              <Derivation analysis={deferredAnalysis} />
            )}
          </>
        )}
        {rightTab === 'preset' && (
          <>
            {preset ? (
              <section className="panel-card space-y-1.5">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-lab-accent">
                  <BookOpen size={13} aria-hidden="true" />
                  {preset.name}
                </h2>
                <p className="text-[11px] leading-relaxed text-slate-400">{preset.description}</p>
              </section>
            ) : (
              <p className="panel-card text-xs text-slate-400">Modelo personalizado: no corresponde a ningún preset.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

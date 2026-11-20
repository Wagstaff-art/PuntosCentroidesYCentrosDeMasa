import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { analyzeModel, type MassAnalysis } from '../lib/physics';
import { analyzeGeometry, type GeometryWarnings } from '../lib/geometry';
import { useModel } from './ModelContext';

export interface AnalysisValue {
  analysis: MassAnalysis;
  warnings: GeometryWarnings;
}

const AnalysisContext = createContext<AnalysisValue | null>(null);

/** Calcula (memoizado) el análisis físico y geométrico solo cuando cambian figuras o apoyos. */
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { shapes, supports } = useModel();
  const analysis = useMemo(() => analyzeModel(shapes, supports), [shapes, supports]);
  const warnings = useMemo(() => analyzeGeometry(shapes), [shapes]);
  const value = useMemo<AnalysisValue>(() => ({ analysis, warnings }), [analysis, warnings]);
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis debe usarse dentro de <AnalysisProvider>');
  return ctx;
}

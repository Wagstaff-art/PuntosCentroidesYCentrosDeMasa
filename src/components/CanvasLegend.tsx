import { memo } from 'react';
import type { MassAnalysis } from '../lib/physics';
import { fmtFixed } from '../lib/format';

/** Leyenda de símbolos del lienzo y escala de densidad. */
export const CanvasLegend = memo(function CanvasLegend({ analysis }: { analysis: MassAnalysis }) {
  const range = analysis.densityRange;
  const spread = range && range.max - range.min >= 1e-12 ? range : null;

  return (
    <div className="pointer-events-none w-56 space-y-1.5 p-2 pr-7 text-[10px] text-slate-300">
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="5" fill="none" stroke="#38BDF8" strokeWidth="1.8" />
          <path d="M1 9h16M9 1v16" stroke="#38BDF8" strokeWidth="1.2" />
        </svg>
        <span>G · centroide geométrico (solo forma)</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="6" fill="#0B0F19" />
          <path d="M9 9V3A6 6 0 0 1 15 9Z M9 9v6A6 6 0 0 1 3 9Z" fill="#F59E0B" />
          <circle cx="9" cy="9" r="6" fill="none" stroke="#F59E0B" strokeWidth="1.4" />
        </svg>
        <span>CM · centro de masa (forma + densidad)</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 1v13" stroke="#F59E0B" strokeWidth="1.4" strokeDasharray="3 2" />
          <circle cx="9" cy="15" r="2.5" fill="#94A3B8" />
        </svg>
        <span>Plomada del CM hasta y = 0</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 2v11m0 0-3-3m3 3 3-3" stroke="#EF4444" strokeWidth="1.4" />
        </svg>
        <span>w_i = m_i·g (peso de cada figura)</span>
      </div>
      <div className="space-y-0.5 pt-0.5">
        <div
          className="h-2 rounded-sm border border-lab-border"
          style={{
            background: spread
              ? 'linear-gradient(90deg, rgba(56,189,248,0.25), rgba(56,189,248,0.95))'
              : 'rgba(56, 189, 248, 0.6)',
          }}
        />
        <div className="num flex justify-between text-slate-400">
          {spread ? (
            <>
              <span>ρmin {fmtFixed(spread.min, 4)}</span>
              <span>ρmax {fmtFixed(spread.max, 4)}</span>
            </>
          ) : (
            <span>ρ uniforme{range ? ` = ${fmtFixed(range.min, 4)} kg/cm²` : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
});

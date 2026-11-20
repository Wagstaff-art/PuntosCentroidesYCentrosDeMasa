import { useModel, useModelDispatch } from '../state/ModelContext';
import { SUPPORT_LIMIT } from '../lib/limits';
import { NumberField } from './NumberField';

export function SupportsInspector() {
  const { supports } = useModel();
  const dispatch = useModelDispatch();

  return (
    <section aria-labelledby="titulo-apoyos" className="space-y-2">
      <h2 id="titulo-apoyos" className="section-title">
        Apoyos (y = 0)
      </h2>
      <div className="panel-card space-y-3">
        <NumberField
          label="A · apoyo fijo, x_A"
          value={supports.xA}
          min={SUPPORT_LIMIT.min}
          max={SUPPORT_LIMIT.max}
          step={SUPPORT_LIMIT.step}
          unit={SUPPORT_LIMIT.unit}
          onChange={(x) => dispatch({ type: 'support/set', support: 'A', x })}
        />
        <NumberField
          label="B · rodillo, x_B"
          value={supports.xB}
          min={SUPPORT_LIMIT.min}
          max={SUPPORT_LIMIT.max}
          step={SUPPORT_LIMIT.step}
          unit={SUPPORT_LIMIT.unit}
          onChange={(x) => dispatch({ type: 'support/set', support: 'B', x })}
        />
        <p className="text-[11px] text-slate-500">
          Ancho de base:{' '}
          <span className="num text-slate-300">{Math.abs(supports.xB - supports.xA).toFixed(2)} cm</span>
        </p>
      </div>
    </section>
  );
}

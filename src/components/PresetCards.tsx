import { memo } from 'react';
import { CheckCircle2, RotateCw } from 'lucide-react';
import { PRESETS, presetToSnapshot, type Preset } from '../data/presets';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { densityShade } from '../lib/density';
import { shapeGeometry, worldPolygon } from '../lib/shapes';
import type { Shape } from '../types';

/** Miniatura SVG del preset: figuras sombreadas por densidad y apoyos A/B. */
const PresetThumb = memo(function PresetThumb({ preset }: { preset: Preset }) {
  const xs = [preset.supports.xA, preset.supports.xB];
  const ys = [0];
  const polys: { pts: string; rho: number }[] = [];
  preset.shapes.forEach((s, i) => {
    const shape = { ...s, id: `p${i}` } as Shape;
    const r = shapeGeometry(shape);
    if (!r.ok) return;
    const w = worldPolygon(shape, r.geom);
    for (const p of w) {
      xs.push(p.x);
      ys.push(p.y);
    }
    polys.push({ pts: w.map((p) => `${p.x},${p.y}`).join(' '), rho: s.m / r.geom.area });
  });
  const minX = Math.min(...xs) - 6;
  const maxX = Math.max(...xs) + 6;
  const maxY = Math.max(...ys) + 4;
  const minY = Math.min(...ys) - 10;
  const range = { min: Math.min(...polys.map((p) => p.rho), 1), max: Math.max(...polys.map((p) => p.rho), 1) };
  const H = maxY - minY;
  const gy = maxY; // suelo (y = 0) en coordenadas del viewBox

  return (
    <svg viewBox={`${minX} 0 ${maxX - minX} ${H}`} className="h-14 w-full" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <line x1={minX} x2={maxX} y1={gy} y2={gy} stroke="#64748B" strokeWidth={0.8} />
      {polys.map((p, i) => (
        <polygon
          key={i}
          points={p.pts
            .split(' ')
            .map((pair) => {
              const [x, y] = pair.split(',');
              return `${x},${gy - Number(y)}`;
            })
            .join(' ')}
          fill="#38BDF8"
          fillOpacity={densityShade(p.rho, range).opacity}
          stroke="#38BDF8"
          strokeWidth={0.8}
        />
      ))}
      {[preset.supports.xA, preset.supports.xB].map((x, i) => (
        <path key={i} d={`M ${x} ${gy} l -3 5 l 6 0 z`} fill="#111827" stroke="#E2E8F0" strokeWidth={0.8} />
      ))}
    </svg>
  );
});

/** Galería de presets con miniatura, resultado esperado y carga con un clic. */
export function PresetCards() {
  const { presetId } = useModel();
  const dispatch = useModelDispatch();

  return (
    <section aria-labelledby="titulo-presets" className="space-y-2">
      <h2 id="titulo-presets" className="section-title">
        Presets didácticos
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {PRESETS.map((p, i) => {
          const active = p.id === presetId;
          const stable = p.expected.status === 'estable';
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'model/load', snapshot: presetToSnapshot(p) })}
                aria-pressed={active}
                title={p.description}
                className={`flex h-full w-full flex-col gap-1 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? 'border-lab-accent/70 bg-lab-accent/10' : 'border-lab-border bg-lab-bg/40 hover:border-slate-600'
                }`}
              >
                <PresetThumb preset={p} />
                <span className="text-[11px] font-semibold leading-tight text-slate-100">
                  {i + 1}. {p.name}
                </span>
                <span className="line-clamp-2 text-[10px] leading-snug text-slate-400">{p.tagline}</span>
                <span
                  className={`mt-auto inline-flex items-center gap-1 text-[10px] font-semibold ${stable ? 'text-lab-stable' : 'text-lab-danger'}`}
                >
                  {stable ? <CheckCircle2 size={11} aria-hidden="true" /> : <RotateCw size={11} aria-hidden="true" />}
                  {stable ? 'Estable' : 'Vuelca'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

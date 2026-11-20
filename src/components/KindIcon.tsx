import type { ShapeKind } from '../types';

/** Icono SVG por tipo de figura (paleta, lista, inspector, cinta). */
export function KindIcon({ kind, size = 16, className }: { kind: ShapeKind; size?: number; className?: string }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {kind === 'rect' && <rect x="3" y="7" width="18" height="12" {...stroke} />}
      {kind === 'triangle' && <path d="M4 20 L20 20 L12 4 Z" {...stroke} />}
      {kind === 'circle' && <circle cx="12" cy="12" r="8" {...stroke} />}
      {kind === 'semicircle' && <path d="M4 17 A8 8 0 0 1 20 17 Z" {...stroke} />}
      {kind === 'quarter' && <path d="M5 20 L5 5 A15 15 0 0 1 20 20 Z" {...stroke} />}
      {kind === 'trapezoid' && <path d="M3 19 L21 19 L16 7 L9 7 Z" {...stroke} />}
      {kind === 'polygon' && <path d="M4 20 L16 20 L16 12 L9 12 L9 4 L4 4 Z" {...stroke} />}
      {kind === 'equation' && (
        <>
          <path d="M3 20 H21 M4 20 V4" {...stroke} />
          <path d="M5 17 C8 5 16 5 19 17" {...stroke} />
        </>
      )}
    </svg>
  );
}

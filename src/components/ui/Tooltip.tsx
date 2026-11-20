import type { ReactNode } from 'react';

/** Tooltip estilizado (nombre + atajo opcional), no solo `title`. */
export function Tooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-lab-border bg-lab-elevated px-2 py-1 text-[10.5px] text-slate-200 shadow-lg group-hover/tt:block group-focus-within/tt:block"
      >
        {label}
        {shortcut && <kbd className="num ml-1.5 rounded border border-lab-border bg-lab-bg px-1 text-[9px] text-slate-400">{shortcut}</kbd>}
      </span>
    </span>
  );
}

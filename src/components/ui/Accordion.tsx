import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Sección plegable con chevrón (acordeón) para los paneles laterales. */
export function Accordion({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="panel-card !p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="section-title !text-slate-300">{title}</span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="space-y-3 border-t border-lab-border px-3 py-3">
          {children}
        </div>
      )}
    </section>
  );
}

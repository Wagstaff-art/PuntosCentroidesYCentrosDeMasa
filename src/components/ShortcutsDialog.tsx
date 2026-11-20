import { useTools } from '../state/ToolsContext';
import { Modal } from './ui/Modal';

const SHORTCUTS: [string, string][] = [
  ['Rueda', 'Zoom en el cursor'],
  ['Botón central / Espacio + arrastre', 'Desplazar el plano'],
  ['Shift (al arrastrar)', 'Desactivar snap temporalmente'],
  ['Flechas', 'Mover figura seleccionada (Shift: 10 cm)'],
  ['Supr', 'Eliminar figura seleccionada'],
  ['Ctrl+D', 'Duplicar figura seleccionada'],
  ['Esc', 'Deseleccionar / cerrar paneles y diálogos'],
  ['F', 'Centrar plano'],
  ['G', 'Simular / detener'],
  ['+ / −', 'Acercar / alejar'],
  ['Enter / doble clic', 'Cerrar polígono (modo dibujo)'],
  ['Backspace', 'Quitar último vértice (modo dibujo)'],
];

/** Diálogo de atajos de teclado y ratón. */
export function ShortcutsDialog() {
  const { closeDialog } = useTools();
  return (
    <Modal title="Atajos" onClose={closeDialog} widthClass="w-[420px]">
      <table className="w-full text-xs">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k} className="border-b border-lab-border/60 last:border-0">
              <td className="py-1.5 pr-3">
                <kbd className="num rounded border border-lab-border bg-lab-bg px-1.5 py-0.5 text-[10px] text-slate-200">{k}</kbd>
              </td>
              <td className="py-1.5 text-slate-300">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

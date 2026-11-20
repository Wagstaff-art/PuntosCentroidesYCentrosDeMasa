import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmación genérica (p. ej. "Nuevo" con figuras existentes). */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} widthClass="w-[400px]">
      <p className="text-xs leading-relaxed text-slate-300">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn border-lab-danger/60 bg-lab-danger/15 text-lab-danger hover:bg-lab-danger/25"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

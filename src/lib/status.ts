import type { MassAnalysis, ModelStatus } from './physics';
import type { SimSnapshot } from './dynamics';
import { fmtFixed, fmtTrim } from './format';

/** Etiqueta textual de cada estado (el estado nunca se comunica solo con color). */
export const STATUS_TEXT: Readonly<Record<ModelStatus, string>> = {
  estable: 'ESTABLE',
  inestable: 'INESTABLE · VUELCO',
  sin_masa: 'SIN MASA',
};

/** Estado a mostrar en rótulos y reportes, teniendo en cuenta la simulación. */
export function displayStatus(a: MassAnalysis, sim: SimSnapshot): string {
  if (sim.mode === 'tipping' && sim.state?.finished) return 'VOLCADO';
  if (sim.mode === 'tipping') return 'CAYENDO';
  return STATUS_TEXT[a.status];
}

/** Líneas del rótulo para PNG y reporte: título, fecha y estado con valores clave. */
export function captionLines(modelName: string, a: MassAnalysis, sim: SimSnapshot, date: Date): string[] {
  const xCM = a.centerOfMass.x.value;
  const details = [
    `Estado: ${displayStatus(a, sim)}`,
    `M = ${fmtTrim(a.totalMass, 2)} kg`,
    xCM === null ? 'x̄_CM = —' : `x̄_CM = ${fmtFixed(xCM)} cm`,
    `Base [${fmtTrim(a.base.xmin)}, ${fmtTrim(a.base.xmax)}] cm`,
  ];
  return [
    `Laboratorio Virtual de Estabilidad — ${modelName}`,
    `${date.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })} · ${details.join(' · ')}`,
  ];
}

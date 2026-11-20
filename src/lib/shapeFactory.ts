import { shapeGeometry } from './shapes';
import type { Shape, ShapeKind } from '../types';

/**
 * Figura por defecto de cada tipo, anclada en el origen. El id puede quedar
 * vacío: el reducer `shape/insert` asigna uno si falta o está repetido.
 */
export function defaultShapeProto(kind: ShapeKind): Shape {
  const common = { id: '', name: '', m: 10, x: 0, y: 0, flipX: false, flipY: false };
  switch (kind) {
    case 'rect':
      return { ...common, kind, b: 30, h: 15 };
    case 'triangle':
      return { ...common, kind, b: 30, h: 20, apex: 0.5, m: 8 };
    case 'circle':
      return { ...common, kind, r: 10 };
    case 'semicircle':
      return { ...common, kind, r: 12, m: 8 };
    case 'quarter':
      return { ...common, kind, r: 15, m: 8 };
    case 'trapezoid':
      return { ...common, kind, b: 30, a: 15, h: 15, offset: 7.5 };
    case 'polygon':
      return {
        ...common,
        kind,
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 10 },
          { x: 10, y: 10 },
          { x: 10, y: 30 },
          { x: 0, y: 30 },
        ],
        m: 12,
      };
    case 'equation':
      return { ...common, kind, f: '20 - x^2/20', g: '0', a: -20, b: 20, m: 30 };
  }
}

/**
 * Crea la figura por defecto de `kind` con el centro de su caja envolvente en
 * `center` (cm). Con `snap` el ancla se redondea al cm entero.
 */
export function createShape(
  kind: ShapeKind,
  center: { x: number; y: number },
  id: string,
  name: string,
  snap: boolean,
): Shape {
  const proto = defaultShapeProto(kind);
  const r = shapeGeometry(proto);
  const w = r.ok ? r.geom.width : 0;
  const h = r.ok ? r.geom.height : 0;
  const q = snap ? Math.round : (v: number) => Math.round(v * 100) / 100;
  return { ...proto, id, name, x: q(center.x - w / 2), y: q(center.y - h / 2) };
}

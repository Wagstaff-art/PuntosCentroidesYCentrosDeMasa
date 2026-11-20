import { useCallback } from 'react';
import { useAnalysis } from '../state/AnalysisContext';
import { useModel, useModelDispatch } from '../state/ModelContext';
import { defaultShapeProto, createShape } from '../lib/shapeFactory';
import { shapeGeometry } from '../lib/shapes';
import { SHAPE_LABELS, type ShapeKind } from '../types';

/**
 * Inserta una figura del tipo dado. Sin `center`, se centra en x = 0 y se apila
 * sobre la figura más alta; con `center`, centrada en ese punto (solta en lienzo).
 */
export function useAddShape(): (kind: ShapeKind, center?: { x: number; y: number }) => void {
  const { snap } = useModel();
  const dispatch = useModelDispatch();
  const { analysis } = useAnalysis();

  return useCallback(
    (kind: ShapeKind, center?: { x: number; y: number }) => {
      const r = shapeGeometry(defaultShapeProto(kind));
      const h = r.ok ? r.geom.height : 10;
      let c = center;
      if (!c) {
        const top = analysis.shapes.reduce((acc, s) => Math.max(acc, ...s.polygon.map((p) => p.y)), 0);
        c = { x: 0, y: top + h / 2 };
      }
      const shape = createShape(kind, c, '', `${SHAPE_LABELS[kind]}`, snap);
      dispatch({ type: 'shape/insert', shape });
    },
    [analysis, snap, dispatch],
  );
}

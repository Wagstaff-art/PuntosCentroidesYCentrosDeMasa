import { describe, expect, it } from 'vitest';
import { clamp } from '../lib/limits';
import { DEFAULT_SNAPSHOT, createModelState, modelReducer } from './model';

describe('clamp', () => {
  it('limita al intervalo y trata valores no finitos', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-4, 1, 10)).toBe(1);
    expect(clamp(40, 1, 10)).toBe(10);
    expect(clamp(Number.NaN, 1, 10)).toBe(1);
  });
});

describe('modelReducer', () => {
  it('crea el estado inicial seleccionando el primer bloque', () => {
    const s = createModelState();
    expect(s.shapes).toHaveLength(DEFAULT_SNAPSHOT.shapes.length);
    expect(s.selectedId).toBe('b1');
  });

  it('añade un bloque apilado sobre el más alto con id único', () => {
    const s = modelReducer(createModelState(), { type: 'shape/add' });
    const added = s.shapes[s.shapes.length - 1];
    expect(s.shapes).toHaveLength(3);
    expect(added?.id).toBe('b3');
    expect(added?.y).toBe(40);
    expect(s.selectedId).toBe('b3');
  });

  it('duplica un bloque desplazado y lo inserta a continuación', () => {
    const s = modelReducer(createModelState(), { type: 'shape/duplicate', id: 'b1' });
    expect(s.shapes.map((b) => b.id)).toEqual(['b1', 'b3', 'b2']);
    expect(s.shapes[1]?.x).toBe(-20);
  });

  it('al eliminar el seleccionado selecciona el siguiente disponible', () => {
    let s = modelReducer(createModelState(), { type: 'shape/delete', id: 'b1' });
    expect(s.selectedId).toBe('b2');
    s = modelReducer(s, { type: 'shape/delete', id: 'b2' });
    expect(s.shapes).toHaveLength(0);
    expect(s.selectedId).toBeNull();
  });

  it('limita los valores al actualizar un bloque', () => {
    const s = modelReducer(createModelState(), {
      type: 'shape/update',
      id: 'b1',
      patch: { b: 0, h: 999, m: 0, x: -1000, y: 1000 },
    });
    expect(s.shapes[0]).toMatchObject({ b: 1, h: 200, m: 0.1, x: -300, y: 300 });
  });

  it('una actualización sin cambios devuelve el mismo estado (sin re-render)', () => {
    const s = createModelState();
    expect(modelReducer(s, { type: 'shape/update', id: 'b1', patch: { x: -30 } })).toBe(s);
    expect(modelReducer(s, { type: 'support/set', support: 'A', x: -30 })).toBe(s);
  });

  it('limita la posición de los apoyos', () => {
    const s = modelReducer(createModelState(), { type: 'support/set', support: 'B', x: 900 });
    expect(s.supports.xB).toBe(300);
  });

  it('reiniciar restaura la instantánea inicial y conserva el snap', () => {
    let s = createModelState();
    s = modelReducer(s, { type: 'snap/set', value: false });
    s = modelReducer(s, { type: 'shape/update', id: 'b1', patch: { m: 99 } });
    s = modelReducer(s, { type: 'model/reset' });
    expect(s.shapes[0]?.m).toBe(20);
    expect(s.snap).toBe(false);
  });
});

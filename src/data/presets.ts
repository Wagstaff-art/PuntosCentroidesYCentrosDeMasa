import type { ModelSnapshot } from '../state/model';
import type { Shape, SupportId, Supports } from '../types';

/** Figura de preset: cualquier tipo de Shape sin id (se asigna al cargar). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type PresetShape = DistributiveOmit<Shape, 'id'>;

const rect = (b: number, h: number, m: number, x: number, y: number, name: string): PresetShape => ({
  kind: 'rect',
  name,
  b,
  h,
  m,
  x,
  y,
  flipX: false,
  flipY: false,
});

/** Resultados esperados de un preset (se verifican en los tests). */
export interface PresetExpected {
  xG: number;
  xCM: number;
  M: number;
  status: 'estable' | 'inestable';
  pivot?: SupportId;
  margin?: number;
  equalReactions?: boolean;
  /** true si x̄_G cae dentro de la base de sustentación. */
  xGInsideBase?: boolean;
  /** Área total esperada en cm² (opcional). */
  A?: number;
  /** ȳ_G esperada en cm (opcional). */
  yG?: number;
}

export interface Preset {
  id: string;
  name: string;
  /** Frase corta para el selector y las tarjetas. */
  tagline: string;
  /** Tarjeta explicativa de 2–3 frases. */
  description: string;
  supports: Supports;
  shapes: readonly PresetShape[];
  expected: PresetExpected;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'torre-simetrica',
    name: 'Torre Simétrica Estable',
    tagline: 'Simetría respecto al eje y: x̄_G = x̄_CM = 0.',
    description:
      'Tres figuras centrados sobre el eje y forman una torre simétrica. Por simetría, tanto el centroide como el centro de masa caen en x = 0, justo en el centro de la base, y las dos reacciones son iguales: cada apoyo soporta la mitad del peso.',
    supports: { xA: -30, xB: 30 },
    shapes: [
      rect(60, 10, 20, -30, 0, 'Base'),
      rect(30, 30, 15, -15, 10, 'Cuerpo'),
      rect(20, 20, 8, -10, 40, 'Remate'),
    ],
    expected: { xG: 0, xCM: 0, M: 43, status: 'estable', equalReactions: true, xGInsideBase: true },
  },
  {
    id: 'voladizo-contrapeso',
    name: 'Voladizo con Contrapeso',
    tagline: 'Un contrapeso denso compensa un voladizo largo.',
    description:
      'Una viga larga y ligera sobresale hacia la derecha, mientras una figura pequeña pero muy pesado actúa como contrapeso a la izquierda. El centroide geométrico se desplaza hacia el voladizo (x̄_G ≈ 23.06 cm), pero el contrapeso arrastra el centro de masa hasta x̄_CM ≈ 5.56 cm, bien dentro de la base.',
    supports: { xA: -10, xB: 30 },
    shapes: [
      rect(40, 10, 20, -10, 0, 'Plataforma'),
      rect(50, 10, 10, 20, 10, 'Voladizo'),
      rect(15, 15, 60, -10, 10, 'Contrapeso'),
    ],
    expected: { xG: 23.0556, xCM: 5.5556, M: 90, status: 'estable', xGInsideBase: true },
  },
  {
    id: 'colapso-geometria',
    name: 'Colapso por Geometría',
    tagline: 'Densidad uniforme: la forma decide y vuelca en B.',
    description:
      'Ambas figuras tienen la misma densidad (0.1 kg/cm²), así que el centro de masa coincide con el centroide geométrico: x̄_G = x̄_CM = 19 cm. Como la base solo llega hasta x = 10 cm, el centro de masa queda 9 cm fuera y el conjunto vuelca en torno al apoyo B.',
    supports: { xA: -10, xB: 10 },
    shapes: [rect(40, 10, 40, -10, 0, 'Losa'), rect(30, 20, 60, 10, 10, 'Figura superior')],
    expected: { xG: 19, xCM: 19, M: 100, status: 'inestable', pivot: 'B', margin: -9, xGInsideBase: false },
  },
  {
    id: 'trampa-densidad',
    name: 'La Trampa de Densidad',
    tagline: 'x̄_G dentro de la base, x̄_CM fuera: ¡vuelca!',
    description:
      'A simple vista el conjunto parece seguro: su centroide geométrico está en x̄_G = 10 cm, dentro de la base [−20, 20]. Pero la figura pequeña de la derecha pesa 80 kg y desplaza el centro de masa hasta x̄_CM ≈ 25.79 cm, fuera de la base. El centroide solo depende de la forma; el centro de masa depende de cómo se reparte la masa, y es este último el que decide el vuelco en torno a B.',
    supports: { xA: -20, xB: 20 },
    shapes: [
      rect(40, 10, 10, -20, 0, 'Base ligera'),
      rect(20, 20, 5, 0, 10, 'Caja hueca'),
      rect(20, 10, 80, 20, 0, 'Lingote'),
    ],
    expected: { xG: 10, xCM: 25.7895, M: 95, status: 'inestable', pivot: 'B', xGInsideBase: true },
  },
  {
    id: 'arco-parabolico',
    name: 'Arco Parabólico',
    tagline: 'Una región bajo y = f(x): el centroide sale de la integral.',
    description:
      'La figura es la región bajo la parábola y = 20 − x²/20 en [−20, 20]. Aquí no hay tabla que valga: el área y el centroide se obtienen por integración numérica (Simpson). El resultado clásico ȳ = 2h/5 = 8 cm y la simetría en x = 0 confirman el cálculo.',
    supports: { xA: -15, xB: 15 },
    shapes: [
      {
        kind: 'equation',
        name: 'Arco parabólico',
        f: '20 - x^2/20',
        g: '0',
        a: -20,
        b: 20,
        m: 30,
        x: -20,
        y: 0,
        flipX: false,
        flipY: false,
      },
    ],
    expected: { xG: 0, xCM: 0, M: 30, status: 'estable', equalReactions: true, xGInsideBase: true, A: 533.333, yG: 8 },
  },
  {
    id: 'figuras-combinadas',
    name: 'Figuras Combinadas',
    tagline: 'Rectángulo + círculo + triángulo: cada centroide con su fórmula.',
    description:
      'Una viga rectangular soporta un círculo apoyado sobre ella y un triángulo rectángulo a la derecha. Cada figura aporta su área y su centroide con la fórmula que le corresponde; el equilibrio se decide con el promedio ponderado igual que siempre.',
    supports: { xA: -20, xB: 20 },
    shapes: [
      rect(60, 10, 30, -30, 0, 'Viga'),
      { kind: 'circle', name: 'Disco', r: 10, m: 20, x: -10, y: 10, flipX: false, flipY: false },
      {
        kind: 'triangle',
        name: 'Triángulo',
        b: 20,
        h: 15,
        apex: 1,
        m: 10,
        x: 10,
        y: 10,
        flipX: false,
        flipY: false,
      },
    ],
    expected: { xG: 3.289, xCM: 3.8889, M: 60, status: 'estable', xGInsideBase: true },
  },
];

export const DEFAULT_PRESET: Preset = PRESETS[0] as Preset;

/**
 * Convierte un preset en una instantánea del modelo con ids estables (b1, b2, …).
 * @param preset Preset de origen.
 */
export function presetToSnapshot(preset: Preset): ModelSnapshot {
  return {
    presetId: preset.id,
    name: preset.name,
    supports: { ...preset.supports },
    shapes: preset.shapes.map((s, i) => ({ ...s, id: `b${i + 1}` }) as Shape),
  };
}

import type { MassAnalysis, WeightedAverageTrace } from './physics';
import { fmtFixed, fmtTrim, texNum } from './format';
import { texNode, parseExpr } from './expr';
import { equationMoments, EQUATION_SIMPSON_N } from './shapes';
import type { ShapeKind } from '../types';

/** Cadenas TeX del desarrollo paso a paso, construidas a partir de las trazas del motor. */
export interface DerivationTex {
  centroidX: string;
  centroidY: string;
  comX: string;
  comY: string;
  stability: string | null;
  reactions: string | null;
  overturning: string | null;
  integralNote: string;
  /** Fórmula del centroide para cada tipo de figura presente en el modelo. */
  shapeNotes: string[];
  /** Bloque TeX por cada región de ecuación: A, x̄ e ȳ por integración (Simpson, n = 600). */
  equationSteps: string[];
}

/** Fórmula del centroide de cada tipo de figura (una por tipo presente). */
const SHAPE_CENTROID_TEX: Readonly<Record<ShapeKind, string>> = {
  rect: '\\text{Rectángulo:}\\; (x_i,\\,y_i) = \\left(x_0 + \\dfrac{b}{2},\\; y_0 + \\dfrac{h}{2}\\right)',
  triangle:
    '\\text{Triángulo:}\\; (x_i,\\,y_i) = \\dfrac{v_1 + v_2 + v_3}{3} \\;\\text{(media de los vértices)}',
  circle: '\\text{Círculo:}\\; (x_i,\\,y_i) = \\text{centro},\\quad A = \\pi r^2',
  semicircle:
    '\\text{Semicírculo:}\\; y_i = \\dfrac{4r}{3\\pi} \\;\\text{sobre el lado plano},\\quad A = \\dfrac{\\pi r^2}{2}',
  quarter:
    '\\text{Cuarto de círculo:}\\; x_i = y_i = \\dfrac{4r}{3\\pi} \\;\\text{desde la esquina recta},\\quad A = \\dfrac{\\pi r^2}{4}',
  trapezoid:
    '\\text{Trapecio:}\\; y_i = \\dfrac{h\\,(b + 2a)}{3\\,(a + b)} \\;\\text{sobre la base mayor}',
  polygon:
    '\\text{Polígono:}\\; x_i = \\dfrac{\\sum (x_j + x_{j+1})\\,c_j}{6A},\\; y_i = \\dfrac{\\sum (y_j + y_{j+1})\\,c_j}{6A},\\; c_j = x_j y_{j+1} - x_{j+1} y_j',
  equation:
    '\\text{Región } f-g\\text{:}\\; \\bar{x} = \\dfrac{\\int x\\,[f-g]\\,dx}{\\int [f-g]\\,dx},\\quad \\bar{y} = \\dfrac{\\int \\frac{1}{2}\\,[f^2-g^2]\\,dx}{\\int [f-g]\\,dx}',
};

const T = (s: string): string => `\\text{${s}}`;

function weightedTex(symbol: string, integral: string, sum: string, trace: WeightedAverageTrace, unit: string): string {
  const num = trace.terms.map((t) => `${texNum(fmtTrim(t.weight))}\\cdot ${texNum(fmtTrim(t.coord))}`).join(' + ');
  const den = trace.terms.map((t) => fmtTrim(t.weight)).join(' + ');
  const result = trace.value === null ? T('indefinido') : `\\boxed{${fmtFixed(trace.value)}\\ ${T(unit)}}`;
  return [
    '\\begin{aligned}',
    `${symbol} &= ${integral} = ${sum} \\\\[6pt]`,
    `&= \\dfrac{${num || '0'}}{${den || '0'}} \\\\[6pt]`,
    `&= \\dfrac{${fmtTrim(trace.numerator)}}{${fmtTrim(trace.denominator)}} = ${result}`,
    '\\end{aligned}',
  ].join('\n');
}

/**
 * Construye todas las expresiones TeX del panel de análisis sin recalcular nada:
 * solo lee las trazas y resultados del motor.
 * @param a Resultado de `analyzeModel`.
 */
export function buildDerivation(a: MassAnalysis): DerivationTex {
  const integralNote = [
    '\\begin{aligned}',
    '\\iint_{R_i} x\\,dA &= \\int_{y_0}^{y_0+h_i}\\!\\int_{x_0}^{x_0+b_i} x\\,dx\\,dy',
    '= h_i\\,\\frac{(x_0+b_i)^2 - x_0^2}{2} \\\\',
    '&= b_i h_i\\left(x_0 + \\frac{b_i}{2}\\right) = A_i\\,x_i',
    '\\end{aligned}',
  ].join('\n');

  const centroidX = weightedTex(
    '\\bar{x}_G',
    '\\dfrac{\\iint_R x\\,dA}{\\iint_R dA}',
    '\\dfrac{\\sum_i A_i\\,x_i}{\\sum_i A_i}',
    a.centroid.x,
    'cm',
  );
  const centroidY = weightedTex(
    '\\bar{y}_G',
    '\\dfrac{\\iint_R y\\,dA}{\\iint_R dA}',
    '\\dfrac{\\sum_i A_i\\,y_i}{\\sum_i A_i}',
    a.centroid.y,
    'cm',
  );
  const comX = weightedTex(
    '\\bar{x}_{CM}',
    '\\dfrac{\\iint_R x\\,\\rho\\,dA}{\\iint_R \\rho\\,dA}',
    '\\dfrac{\\sum_i m_i\\,x_i}{\\sum_i m_i}',
    a.centerOfMass.x,
    'cm',
  );
  const comY = weightedTex(
    '\\bar{y}_{CM}',
    '\\dfrac{\\iint_R y\\,\\rho\\,dA}{\\iint_R \\rho\\,dA}',
    '\\dfrac{\\sum_i m_i\\,y_i}{\\sum_i m_i}',
    a.centerOfMass.y,
    'cm',
  );

  const xCM = a.centerOfMass.x.value;
  const st = a.stability;
  const { base, supports } = a;
  const xmin = fmtTrim(base.xmin);
  const xmax = fmtTrim(base.xmax);

  let stability: string | null = null;
  let reactions: string | null = null;
  let overturning: string | null = null;

  if (xCM !== null && st) {
    const x = fmtFixed(xCM);
    const left = xCM >= base.xmin - 1e-9 ? '\\le' : '\\not\\le';
    const right = xCM <= base.xmax + 1e-9 ? '\\le' : '\\not\\le';
    const verdict = st.stable ? `\\quad\\checkmark\\ ${T('estable')}` : `\\quad\\times\\ ${T('inestable')}`;
    const lines = [
      '\\begin{aligned}',
      `x_{\\min} &= \\min(x_A,\\ x_B) = \\min(${fmtTrim(supports.xA)},\\ ${fmtTrim(supports.xB)}) = ${xmin}\\ ${T('cm')} \\quad (${base.minLabel}) \\\\`,
      `x_{\\max} &= \\max(x_A,\\ x_B) = ${xmax}\\ ${T('cm')} \\quad (${base.maxLabel}) \\\\[4pt]`,
      `x_{\\min} \\le \\bar{x}_{CM} \\le x_{\\max} &\\;\\Rightarrow\\; ${texNum(xmin)} ${left} ${x} ${right} ${texNum(xmax)} ${verdict} \\\\[4pt]`,
      `${T('margen')} &= \\min(\\bar{x}_{CM} - x_{\\min},\\ x_{\\max} - \\bar{x}_{CM}) = \\min(${fmtFixed(xCM - base.xmin)},\\ ${fmtFixed(base.xmax - xCM)}) = ${fmtFixed(st.margin)}\\ ${T('cm')}`,
    ];
    if (st.reason === 'base_nula') {
      lines.push(`\\\\[4pt] L &= x_{\\max} - x_{\\min} = 0\\ ${T('cm')} \\;\\Rightarrow\\; ${T('base de ancho nulo')}`);
    }
    if (!st.stable && st.pivot && st.pivotX !== null) {
      lines.push(`\\\\[4pt] &\\Rightarrow\\ ${T('pivote critico')}\\ P = ${st.pivot}\\ (x_P = ${fmtTrim(st.pivotX)}\\ ${T('cm')})`);
    }
    lines.push('\\end{aligned}');
    stability = lines.join('\n');

    const r = a.reactions;
    if (r) {
      const W = fmtFixed(r.weight);
      const L = fmtTrim(r.L);
      const Rmin = fmtFixed(r.Rmin);
      const Rmax = fmtFixed(r.Rmax);
      reactions = [
        '\\begin{aligned}',
        `W &= M\\,g = ${fmtTrim(a.totalMass)}\\cdot ${fmtTrim(a.g)} = ${W}\\ ${T('N')} \\\\`,
        `L &= x_{\\max} - x_{\\min} = ${xmax} - ${texNum(xmin)} = ${L}\\ ${T('cm')} \\\\[4pt]`,
        `R_${base.minLabel} &= W\\,\\dfrac{x_{\\max} - \\bar{x}_{CM}}{L} = ${W}\\cdot\\dfrac{${xmax} - ${texNum(x)}}{${L}} = \\boxed{${Rmin}\\ ${T('N')}} \\\\[6pt]`,
        `R_${base.maxLabel} &= W\\,\\dfrac{\\bar{x}_{CM} - x_{\\min}}{L} = ${W}\\cdot\\dfrac{${x} - ${texNum(xmin)}}{${L}} = \\boxed{${Rmax}\\ ${T('N')}} \\\\[6pt]`,
        `\\textstyle\\sum F_y &= R_A + R_B - W = ${fmtFixed(r.RA)} + ${fmtFixed(r.RB)} - ${W} = ${fmtFixed(r.sumFy)}\\ ${T('N')}\\ \\checkmark \\\\`,
        `\\textstyle\\sum \\tau_${base.minLabel} &= R_${base.maxLabel}\\,L - W\\,(\\bar{x}_{CM} - x_{\\min}) = ${Rmax}\\cdot ${fmtTrim(r.L / 100)} - ${W}\\cdot ${texNum(fmtTrim((xCM - base.xmin) / 100))} = ${fmtFixed(r.sumTorque)}\\ ${T('N')}\\cdot${T('m')}\\ \\checkmark`,
        '\\end{aligned}',
      ].join('\n');
    } else if (st.pivotX !== null && a.overturningMoment !== null) {
      const W = fmtFixed(a.totalMass * a.g);
      const d = fmtTrim(Math.abs(xCM - st.pivotX) / 100);
      overturning = [
        '\\begin{aligned}',
        `W &= M\\,g = ${fmtTrim(a.totalMass)}\\cdot ${fmtTrim(a.g)} = ${W}\\ ${T('N')} \\\\`,
        `\\tau_${st.pivot ?? 'P'} &= W\\,\\lvert \\bar{x}_{CM} - x_P \\rvert = ${W}\\cdot ${d} = \\boxed{${fmtFixed(a.overturningMoment)}\\ ${T('N')}\\cdot${T('m')}}`,
        '\\end{aligned}',
      ].join('\n');
    }
  }

  const kinds = new Set(a.shapes.map((s) => s.kind));
  const shapeNotes = [...kinds].map((k) => SHAPE_CENTROID_TEX[k]);

  const equationSteps = a.shapes
    .filter((s) => s.kind === 'equation')
    .map((s) => {
      if (s.kind !== 'equation') return '';
      const m = equationMoments(s.f, s.g, s.a, s.b);
      const fT = parseExpr(s.f);
      const gT = parseExpr(s.g);
      const ftex = fT.ok ? texNode(fT.node) : 'f(x)';
      const gtex = gT.ok ? texNode(gT.node) : 'g(x)';
      if (!m.ok) {
        return `\\text{${s.name}: no se pudo integrar (${m.error})}`;
      }
      const { area, xb, yb } = m.m;
      return [
        `\\text{${s.name}}\\ \\left(${T('Simpson')},\\ n = ${EQUATION_SIMPSON_N}\\right):`,
        '\\begin{aligned}',
        `A &= \\int_{${fmtTrim(s.a)}}^{${fmtTrim(s.b)}} \\left[${ftex} - \\left(${gtex}\\right)\\right] dx = ${fmtFixed(area)}\\ ${T('cm')}^2 \\\\[6pt]`,
        `\\bar{x} &= \\dfrac{1}{A}\\int_{${fmtTrim(s.a)}}^{${fmtTrim(s.b)}} x\\,\\left[${ftex} - \\left(${gtex}\\right)\\right] dx = ${fmtFixed(xb)}\\ ${T('cm')} \\\\[6pt]`,
        `\\bar{y} &= \\dfrac{1}{A}\\int_{${fmtTrim(s.a)}}^{${fmtTrim(s.b)}} \\dfrac{1}{2}\\left[\\left(${ftex}\\right)^2 - \\left(${gtex}\\right)^2\\right] dx = ${fmtFixed(yb)}\\ ${T('cm')}`,
        '\\end{aligned}',
      ].join('\n');
    });

  return { centroidX, centroidY, comX, comY, stability, reactions, overturning, integralNote, shapeNotes, equationSteps };
}

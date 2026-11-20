import { describe, expect, it } from 'vitest';
import { compileExpr, exprToTex, parseExpr } from './expr';

const at = (src: string, x: number): number => {
  const r = compileExpr(src);
  if (!r.ok) throw new Error(`no compiló «${src}»: ${r.error}@${r.position}`);
  return r.fn(x);
};

const fails = (src: string): void => {
  const r = parseExpr(src);
  expect(r.ok, `«${src}» debería fallar`).toBe(false);
};

describe('expr: evaluación', () => {
  it('2x^2 + 3x - 1 en x = 2 → 13', () => expect(at('2x^2 + 3x - 1', 2)).toBeCloseTo(13, 12));
  it('-x^2 en x = 3 → −9 (la potencia liga más que el menos)', () => expect(at('-x^2', 3)).toBe(-9));
  it('2^3^2 = 512 (^ asociativo a la derecha)', () => expect(at('2^3^2', 0)).toBe(512));
  it('sin(pi/2) = 1', () => expect(at('sin(pi/2)', 0)).toBeCloseTo(1, 12));
  it('3(x+1) en x = 1 → 6', () => expect(at('3(x+1)', 1)).toBe(6));
  it('(x+1)(x-1) en x = 3 → 8', () => expect(at('(x+1)(x-1)', 3)).toBe(8));
  it('2pi = 2π', () => expect(at('2pi', 0)).toBeCloseTo(2 * Math.PI, 12));
  it('ln(e) = 1', () => expect(at('ln(e)', 0)).toBeCloseTo(1, 12));
  it('log(1000) = 3', () => expect(at('log(1000)', 0)).toBeCloseTo(3, 12));
  it('sqrt(abs(x)) en x = −4 → 2', () => expect(at('sqrt(abs(x))', -4)).toBe(2));
  it('x**2 en x = 3 → 9', () => expect(at('x**2', 3)).toBe(9));
  it('constantes y notación científica', () => {
    expect(at('1e3', 0)).toBe(1000);
    expect(at('2.5e-1 x', 4)).toBeCloseTo(1, 12);
  });
});

describe('expr: errores con posición', () => {
  it('2+ → error', () => fails('2+'));
  it('foo(x) → función desconocida', () => {
    const r = parseExpr('foo(x)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Función desconocida');
  });
  it('(x → paréntesis sin cerrar', () => fails('(x'));
  it('x) → símbolo inesperado', () => fails('x)'));
});

describe('expr: toTex', () => {
  it('x^2/20 → contiene \\frac y x^{2}', () => {
    const tex = exprToTex('x^2/20');
    expect(tex).toContain('\\frac');
    expect(tex).toContain('x^{2}');
  });
  it('sqrt, ln, log, pi, abs', () => {
    expect(exprToTex('sqrt(x)')).toContain('\\sqrt{x}');
    expect(exprToTex('ln(x)')).toContain('\\ln');
    expect(exprToTex('log(x)')).toContain('\\log_{10}');
    expect(exprToTex('pi')).toBe('\\pi');
    expect(exprToTex('abs(x)')).toContain('\\left|');
  });
});

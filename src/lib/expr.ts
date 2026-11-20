/**
 * Parser de expresiones matemáticas en una variable `x` (sin eval).
 * Descenso recursivo → AST → función compilada o TeX.
 */

export type ExprNode =
  | { k: 'num'; v: number }
  | { k: 'var' }
  | { k: 'const'; name: 'pi' | 'e' }
  | { k: 'neg'; e: ExprNode }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; l: ExprNode; r: ExprNode }
  | { k: 'call'; fn: FnName; arg: ExprNode };

export type FnName = 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'sqrt' | 'abs' | 'exp' | 'ln' | 'log';

const FUNCS: readonly FnName[] = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'ln', 'log'];

const FN_IMPL: Readonly<Record<FnName, (v: number) => number>> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
};

export type ExprResult = { ok: true; node: ExprNode } | { ok: false; error: string; position: number };

type Tok =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'lp'; pos: number }
  | { t: 'rp'; pos: number };

function tokenize(src: string): Tok[] | { error: string; position: number } {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (c === ' ' || c === '\t' || c === '\n') {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) return { error: `Símbolo inesperado '${c}'`, position: i };
      const v = Number.parseFloat(m[0]);
      if (!Number.isFinite(v)) return { error: 'Número mal formado', position: i };
      toks.push({ t: 'num', v, pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i)) as RegExpExecArray;
      toks.push({ t: 'id', v: m[0].toLowerCase(), pos: i });
      i += m[0].length;
      continue;
    }
    if (c === '*' && src[i + 1] === '*') {
      toks.push({ t: 'op', v: '^', pos: i });
      i += 2;
      continue;
    }
    if (c === '·' || c === '×') {
      toks.push({ t: 'op', v: '*', pos: i });
      i += 1;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      toks.push({ t: 'op', v: c, pos: i });
      i += 1;
      continue;
    }
    if (c === '(') {
      toks.push({ t: 'lp', pos: i });
      i += 1;
      continue;
    }
    if (c === ')') {
      toks.push({ t: 'rp', pos: i });
      i += 1;
      continue;
    }
    return { error: `Símbolo inesperado '${c}'`, position: i };
  }
  return toks;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[], private src: string) {}

  private peek(): Tok | null {
    return this.toks[this.i] ?? null;
  }

  private fail(error: string, position: number): never {
    throw { error, position } as { error: string; position: number };
  }

  parse(): ExprNode {
    const e = this.addsub();
    const t = this.peek();
    if (t !== null) {
      if (t.t === 'rp') this.fail(`Símbolo inesperado ')'`, t.pos);
      this.fail(`Símbolo inesperado '${this.src[t.pos] ?? '?'}'`, t.pos);
    }
    return e;
  }

  private addsub(): ExprNode {
    let l = this.muldiv();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.i += 1;
        l = { k: 'bin', op: t.v, l, r: this.muldiv() };
      } else return l;
    }
  }

  private startsFactor(t: Tok | null): boolean {
    return t !== null && (t.t === 'num' || t.t === 'id' || t.t === 'lp');
  }

  private muldiv(): ExprNode {
    let l = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.i += 1;
        l = { k: 'bin', op: t.v, l, r: this.unary() };
      } else if (this.startsFactor(t)) {
        // Multiplicación implícita: 2x, 3(x+1), 2pi, (x+1)(x-1), 2sin(x)
        l = { k: 'bin', op: '*', l, r: this.unary() };
      } else return l;
    }
  }

  private unary(): ExprNode {
    const t = this.peek();
    if (t?.t === 'op' && t.v === '-') {
      this.i += 1;
      return { k: 'neg', e: this.unary() };
    }
    if (t?.t === 'op' && t.v === '+') {
      this.i += 1;
      return this.unary();
    }
    return this.power();
  }

  private power(): ExprNode {
    const base = this.atom();
    const t = this.peek();
    if (t?.t === 'op' && t.v === '^') {
      this.i += 1;
      return { k: 'bin', op: '^', l: base, r: this.unary() };
    }
    return base;
  }

  private atom(): ExprNode {
    const t = this.peek();
    if (t === null) this.fail('Se esperaba un número o \'(\'', this.src.length);
    if (t.t === 'num') {
      this.i += 1;
      return { k: 'num', v: t.v };
    }
    if (t.t === 'lp') {
      this.i += 1;
      const e = this.addsub();
      const close = this.peek();
      if (close?.t !== 'rp') this.fail('Paréntesis sin cerrar', t.pos);
      this.i += 1;
      return e;
    }
    if (t.t === 'id') {
      this.i += 1;
      if (t.v === 'x') return { k: 'var' };
      if (t.v === 'pi' || t.v === 'π') return { k: 'const', name: 'pi' };
      if (t.v === 'e') return { k: 'const', name: 'e' };
      if ((FUNCS as readonly string[]).includes(t.v)) {
        const lp = this.peek();
        if (lp?.t !== 'lp') this.fail(`Se esperaba '(' después de ${t.v}`, t.pos);
        this.i += 1;
        const arg = this.addsub();
        const close = this.peek();
        if (close?.t !== 'rp') this.fail('Paréntesis sin cerrar', lp.pos);
        this.i += 1;
        return { k: 'call', fn: t.v as FnName, arg };
      }
      this.fail(`Función desconocida: ${t.v}`, t.pos);
    }
    if (t.t === 'rp') this.fail(`Símbolo inesperado ')'`, t.pos);
    this.fail('Se esperaba un número o \'(\'', t.pos);
  }
}

/** Analiza `src` y devuelve el AST o un error con posición. */
export function parseExpr(src: string): ExprResult {
  const toks = tokenize(src);
  if (!Array.isArray(toks)) return { ok: false, error: toks.error, position: toks.position };
  if (toks.length === 0) return { ok: false, error: 'Expresión vacía', position: 0 };
  try {
    return { ok: true, node: new Parser(toks, src).parse() };
  } catch (e) {
    const err = e as { error?: string; position?: number };
    return { ok: false, error: err.error ?? 'Error de sintaxis', position: err.position ?? 0 };
  }
}

function evalNode(n: ExprNode, x: number): number {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var':
      return x;
    case 'const':
      return n.name === 'pi' ? Math.PI : Math.E;
    case 'neg':
      return -evalNode(n.e, x);
    case 'call':
      return FN_IMPL[n.fn](evalNode(n.arg, x));
    case 'bin': {
      const l = evalNode(n.l, x);
      const r = evalNode(n.r, x);
      switch (n.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '^':
          return l ** r;
      }
    }
  }
}

/** Compila `src` a una función de x, o devuelve el error de sintaxis. */
export function compileExpr(src: string): { ok: true; fn: (x: number) => number; node: ExprNode } | { ok: false; error: string; position: number } {
  const p = parseExpr(src);
  if (!p.ok) return p;
  const node = p.node;
  return { ok: true, fn: (x) => evalNode(node, x), node };
}

function needsParens(parent: ExprNode, child: ExprNode, side: 'l' | 'r'): boolean {
  if (parent.k !== 'bin' || child.k !== 'bin') return child.k === 'neg' && parent.k === 'bin' && parent.op === '^';
  const rank = (op: string) => (op === '+' || op === '-' ? 1 : op === '*' || op === '/' ? 2 : 3);
  const rp = rank(parent.op);
  const rc = rank(child.op);
  if (rc < rp) return true;
  if (rc === rp && side === 'r' && (parent.op === '-' || parent.op === '/' || parent.op === '^')) return true;
  if (rc === rp && side === 'l' && parent.op === '^') return true;
  return false;
}

function texAtom(n: ExprNode): string {
  if (n.k === 'num' || n.k === 'var' || n.k === 'const') return texNode(n);
  return `\\left(${texNode(n)}\\right)`;
}

/** Convierte el AST en una cadena TeX legible. */
export function texNode(n: ExprNode): string {
  switch (n.k) {
    case 'num': {
      const s = Number.isInteger(n.v) ? String(n.v) : String(n.v);
      return n.v < 0 ? `\\left(${s}\\right)` : s;
    }
    case 'var':
      return 'x';
    case 'const':
      return n.name === 'pi' ? '\\pi' : 'e';
    case 'neg':
      return `-${texAtom(n.e)}`;
    case 'call': {
      const arg = n.arg;
      switch (n.fn) {
        case 'sqrt':
          return `\\sqrt{${texNode(arg)}}`;
        case 'abs':
          return `\\left|${texNode(arg)}\\right|`;
        case 'ln':
          return `\\ln\\left(${texNode(arg)}\\right)`;
        case 'log':
          return `\\log_{10}\\left(${texNode(arg)}\\right)`;
        case 'exp':
          return `\\mathrm{e}^{${texAtom(arg)}}`;
        case 'asin':
          return `\\arcsin\\left(${texNode(arg)}\\right)`;
        case 'acos':
          return `\\arccos\\left(${texNode(arg)}\\right)`;
        case 'atan':
          return `\\arctan\\left(${texNode(arg)}\\right)`;
        default:
          return `\\${n.fn}\\left(${texNode(arg)}\\right)`;
      }
    }
    case 'bin': {
      const l = needsParens(n, n.l, 'l') ? `\\left(${texNode(n.l)}\\right)` : texNode(n.l);
      const r = needsParens(n, n.r, 'r') ? `\\left(${texNode(n.r)}\\right)` : texNode(n.r);
      switch (n.op) {
        case '+':
          return `${l} + ${r}`;
        case '-':
          return `${l} - ${r}`;
        case '*': {
          const juxtapose =
            n.l.k === 'num' && (n.r.k === 'var' || n.r.k === 'const' || n.r.k === 'call');
          return juxtapose ? `${l}\\,${r}` : `${l} \\cdot ${r}`;
        }
        case '/':
          return `\\frac{${texNode(n.l)}}{${texNode(n.r)}}`;
        case '^':
          return `${l}^{${texNode(n.r)}}`;
      }
    }
  }
}

/** Atajo: parsea y convierte a TeX (cadena vacía si la expresión no es válida). */
export function exprToTex(src: string): string {
  const p = parseExpr(src);
  return p.ok ? texNode(p.node) : '';
}

/** @typedef {2|8|10|16} Radix */

/**
 * Fixed-width unsigned wrap for BigInt.
 */
export function maskWord(v, bits) {
  if (bits <= 0) return 0n;
  const m = (1n << BigInt(bits)) - 1n;
  return v & m;
}

function shiftAmount(shift, bits) {
  const n = Number(shift & 0xffn);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Math.max(0, bits - 1));
}

/**
 * @param {string} str
 * @param {number} i
 * @param {Radix} radix
 * @returns {{ value: bigint, next: number } | null}
 */
function parseNumber(str, i, radix) {
  const allowed = {
    2: /^[01]+/,
    8: /^[0-7]+/,
    10: /^[0-9]+/,
    16: /^[0-9A-Fa-f]+/,
  };
  const m = str.slice(i).match(allowed[radix]);
  if (!m) return null;
  const raw = m[0];
  const next = i + raw.length;
  try {
    if (radix === 10) return { value: BigInt(raw), next };
    const prefix = { 2: "0b", 8: "0o", 16: "0x" }[radix];
    return { value: BigInt(prefix + raw), next };
  } catch {
    return null;
  }
}

/**
 * @param {string} str
 * @param {Radix} radix
 */
function tokenize(str, radix) {
  /** @type {Array<{ type: string, op?: string, value?: bigint }>} */
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (str.slice(i, i + 2) === "<<") {
      tokens.push({ type: "op", op: "<<" });
      i += 2;
      continue;
    }
    if (str.slice(i, i + 2) === ">>") {
      tokens.push({ type: "op", op: ">>" });
      i += 2;
      continue;
    }
    if (c === "~") {
      tokens.push({ type: "op", op: "~" });
      i++;
      continue;
    }
    if ("+-*/%&|^".includes(c)) {
      tokens.push({ type: "op", op: c });
      i++;
      continue;
    }
    const num = parseNumber(str, i, radix);
    if (num) {
      tokens.push({ type: "num", value: num.value });
      i = num.next;
      continue;
    }
    throw new Error(`Invalid character near position ${i + 1}`);
  }
  return tokens;
}

class Parser {
  /**
   * @param {Array<{ type: string, op?: string, value?: bigint }>} tokens
   * @param {number} bits
   */
  constructor(tokens, bits) {
    this.tokens = tokens;
    this.i = 0;
    this.bits = bits;
  }

  /** @param {bigint} v */
  mask(v) {
    return maskWord(v, this.bits);
  }

  peek() {
    return this.tokens[this.i];
  }

  parseBitOrExpr() {
    let left = this.parseBitXorExpr();
    while (this.peek()?.type === "op" && this.peek()?.op === "|") {
      this.i++;
      const right = this.parseBitXorExpr();
      left = this.mask(left | right);
    }
    return left;
  }

  parseBitXorExpr() {
    let left = this.parseBitAndExpr();
    while (this.peek()?.type === "op" && this.peek()?.op === "^") {
      this.i++;
      const right = this.parseBitAndExpr();
      left = this.mask(left ^ right);
    }
    return left;
  }

  parseBitAndExpr() {
    let left = this.parseShiftExpr();
    while (this.peek()?.type === "op" && this.peek()?.op === "&") {
      this.i++;
      const right = this.parseShiftExpr();
      left = this.mask(left & right);
    }
    return left;
  }

  parseShiftExpr() {
    let left = this.parseAdditiveExpr();
    while (
      this.peek()?.type === "op" &&
      (this.peek()?.op === "<<" || this.peek()?.op === ">>")
    ) {
      const op = /** @type {'<<' | '>>'} */ (this.peek()?.op ?? "<<");
      this.i++;
      const right = this.parseAdditiveExpr();
      const sa = shiftAmount(right, this.bits);
      if (op === "<<") left = this.mask(left << BigInt(sa));
      else left = this.mask(left >> BigInt(sa));
    }
    return left;
  }

  parseAdditiveExpr() {
    let left = this.parseMultExpr();
    while (
      this.peek()?.type === "op" &&
      (this.peek()?.op === "+" || this.peek()?.op === "-")
    ) {
      const op = this.peek()?.op;
      this.i++;
      const right = this.parseMultExpr();
      left =
        op === "+"
          ? this.mask(left + right)
          : this.mask(left - right);
    }
    return left;
  }

  parseMultExpr() {
    let left = this.parseUnaryExpr();
    while (
      this.peek()?.type === "op" &&
      (this.peek()?.op === "*" ||
        this.peek()?.op === "/" ||
        this.peek()?.op === "%")
    ) {
      const op = this.peek()?.op;
      this.i++;
      const right = this.parseUnaryExpr();
      if (op === "*") left = this.mask(left * right);
      else if (op === "/") {
        if (right === 0n) throw new Error("Division by zero");
        left = this.mask(left / right);
      } else {
        if (right === 0n) throw new Error("Division by zero");
        left = this.mask(left % right);
      }
    }
    return left;
  }

  parseUnaryExpr() {
    if (this.peek()?.type === "op" && this.peek()?.op === "-") {
      this.i++;
      return this.mask(-this.parseUnaryExpr());
    }
    if (this.peek()?.type === "op" && this.peek()?.op === "+") {
      this.i++;
      return this.parseUnaryExpr();
    }
    if (this.peek()?.type === "op" && this.peek()?.op === "~") {
      this.i++;
      return this.mask(~this.parseUnaryExpr());
    }
    return this.parsePrimaryExpr();
  }

  parsePrimaryExpr() {
    const tok = this.peek();
    if (!tok) throw new Error("Incomplete expression");

    if (tok.type === "num") {
      this.i++;
      return this.mask(tok.value ?? 0n);
    }
    if (tok.type === "lparen") {
      this.i++;
      const inner = this.parseBitOrExpr();
      if (this.peek()?.type !== "rparen") throw new Error("Missing )");
      this.i++;
      return this.mask(inner);
    }

    throw new Error("Expected number or (");
  }
}

/**
 * @param {string} expr
 * @param {Radix} radix
 * @param {number} bits
 * @returns {{ ok: true, value: bigint } | { ok: false, message: string }}
 */
export function evaluateProgrammer(expr, radix, bits) {
  const trimmed = expr.trim();
  if (!trimmed) return { ok: false, message: "Empty expression" };

  try {
    const tokens = tokenize(trimmed, radix);
    const parser = new Parser(tokens, bits);
    const value = parser.parseBitOrExpr();
    if (parser.peek()) throw new Error("Extra input after expression");
    return { ok: true, value: maskWord(value, bits) };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid expression",
    };
  }
}

/**
 * @param {bigint} value
 * @param {Radix} radix
 * @returns {string}
 */
export function formatProgrammerBigInt(value, radix) {
  if (radix === 10) return value.toString(10);
  if (radix === 16) return value.toString(16).toUpperCase();
  return value.toString(radix);
}

// ============================================================
// Tokenizer for SEL relay logic equations
//
// Supported tokens:
//   IDENTIFIER  – alphanumeric strings incl. those starting with digits
//                 (SEL names like 50P1T, 87T, 52A are valid identifiers)
//   EQUALS      – =
//   AND         – *
//   OR          – +
//   NOT         – !
//   LPAREN      – (
//   RPAREN      – )
//   NEWLINE     – statement separator
//   EOF         – end of input
//   UNKNOWN     – anything else (used for error recovery)
//
// Comments:
//   ; to end-of-line
//   // to end-of-line
//   -- to end-of-line
// ============================================================

export type TokenType =
  | 'IDENTIFIER'
  | 'EQUALS'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'NEWLINE'
  | 'EOF'
  | 'UNKNOWN';

export interface Token {
  type: TokenType;
  value: string;
  /** 1-indexed line number. */
  line: number;
  /** 1-indexed column number. */
  col: number;
}

/** Tokenize the full source text into a flat Token array. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  const col = () => i - lineStart + 1;

  while (i < source.length) {
    const ch = source[i];

    // ── Whitespace (not newlines) ───────────────────────────
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }

    // ── Newline ─────────────────────────────────────────────
    if (ch === '\n') {
      tokens.push({ type: 'NEWLINE', value: '\n', line, col: col() });
      line++;
      lineStart = i + 1;
      i++;
      continue;
    }

    // ── Line comments ───────────────────────────────────────
    // ;  // or --
    if (
      ch === ';' ||
      (ch === '/' && i + 1 < source.length && source[i + 1] === '/') ||
      (ch === '-' && i + 1 < source.length && source[i + 1] === '-')
    ) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // ── Single-character operators ──────────────────────────
    if (ch === '=') { tokens.push({ type: 'EQUALS',  value: '=', line, col: col() }); i++; continue; }
    if (ch === '*') { tokens.push({ type: 'AND',     value: '*', line, col: col() }); i++; continue; }
    if (ch === '+') { tokens.push({ type: 'OR',      value: '+', line, col: col() }); i++; continue; }
    if (ch === '!') { tokens.push({ type: 'NOT',     value: '!', line, col: col() }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN',  value: '(', line, col: col() }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN',  value: ')', line, col: col() }); i++; continue; }

    // ── Identifiers ─────────────────────────────────────────
    // SEL element names may start with a digit (50P1T, 87T, etc.)
    // We treat any contiguous run of [A-Za-z0-9_] as an identifier.
    if (/[A-Za-z0-9_]/.test(ch)) {
      const start = i;
      const startCol = col();
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++;
      tokens.push({ type: 'IDENTIFIER', value: source.slice(start, i), line, col: startCol });
      continue;
    }

    // ── Unknown character ───────────────────────────────────
    tokens.push({ type: 'UNKNOWN', value: ch, line, col: col() });
    i++;
  }

  tokens.push({ type: 'EOF', value: '', line, col: col() });
  return tokens;
}

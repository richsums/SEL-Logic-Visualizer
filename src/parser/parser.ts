// ============================================================
// Recursive-descent parser for SEL relay logic equations
//
// Grammar (precedence from lowest to highest):
//
//   document   = equation* EOF
//   equation   = IDENTIFIER EQUALS expr NEWLINE
//   expr       = orExpr
//   orExpr     = andExpr (OR andExpr)*
//   andExpr    = notExpr (AND notExpr)*
//   notExpr    = NOT notExpr | primary
//   primary    = IDENTIFIER | LPAREN expr RPAREN
//
// Error recovery: on a parse error within an equation, the parser
// skips tokens until it finds the next NEWLINE or EOF, then continues.
// ============================================================

import { tokenize, type Token, type TokenType } from './tokenizer';
import type {
  Equation,
  ExprNode,
  ParseResult,
  Diagnostic,
  SourceLocation,
} from '../domain/models';

// ------------------------------------------------------------------
// Internal parser state
// ------------------------------------------------------------------

class Parser {
  private readonly tokens: Token[];
  private readonly lines: string[];
  private pos = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(tokens: Token[], lines: string[]) {
    this.tokens = tokens;
    this.lines = lines;
  }

  // ── Token helpers ──────────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.type !== 'EOF') this.pos++;
    return t;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): Token | null {
    if (this.check(type)) return this.advance();
    return null;
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) this.advance();
  }

  /** Advance to the next NEWLINE or EOF for error recovery. */
  private recoverToLineEnd(): void {
    while (!this.check('NEWLINE') && !this.check('EOF')) this.advance();
  }

  private loc(token: Token): SourceLocation {
    return {
      line: token.line,
      rawSource: this.lines[token.line - 1] ?? '',
    };
  }

  private emitError(message: string, token: Token): void {
    this.diagnostics.push({
      severity: 'error',
      code: 'PARSE_ERROR',
      message,
      loc: this.loc(token),
    });
  }

  // ── Grammar rules ──────────────────────────────────────────

  parse(): ParseResult {
    const equations: Equation[] = [];

    while (true) {
      this.skipNewlines();
      if (this.check('EOF')) break;

      const t = this.peek();

      if (t.type === 'IDENTIFIER') {
        const eq = this.parseEquation();
        if (eq) equations.push(eq);
      } else {
        this.emitError(
          `Unexpected token '${t.value}' — expected an identifier to start an equation`,
          t
        );
        this.recoverToLineEnd();
      }
    }

    return { equations, diagnostics: this.diagnostics };
  }

  private parseEquation(): Equation | null {
    const lhsTok = this.advance(); // consumes IDENTIFIER
    const lineLoc = this.loc(lhsTok);

    // Consume '='
    const eqTok = this.peek();
    if (eqTok.type !== 'EQUALS') {
      this.emitError(
        `Expected '=' after '${lhsTok.value}', found '${eqTok.value}'`,
        eqTok
      );
      this.recoverToLineEnd();
      return null;
    }
    this.advance(); // consume '='

    // Parse RHS expression
    const expr = this.parseOr();
    if (expr === null) {
      this.recoverToLineEnd();
      return null;
    }

    // Expect NEWLINE or EOF after expression
    const next = this.peek();
    if (next.type !== 'NEWLINE' && next.type !== 'EOF') {
      this.emitError(
        `Unexpected token '${next.value}' after expression — did you forget a newline?`,
        next
      );
      this.recoverToLineEnd();
    }

    return {
      target: lhsTok.value,
      expr,
      loc: lineLoc,
    };
  }

  // orExpr = andExpr (OR andExpr)*
  private parseOr(): ExprNode | null {
    let left = this.parseAnd();
    if (left === null) return null;

    while (this.check('OR')) {
      const opTok = this.advance(); // consume '+'
      const right = this.parseAnd();
      if (right === null) return null;
      left = { tag: 'or', left, right, loc: this.loc(opTok) };
    }

    return left;
  }

  // andExpr = notExpr (AND notExpr)*
  private parseAnd(): ExprNode | null {
    let left = this.parseNot();
    if (left === null) return null;

    while (this.check('AND')) {
      const opTok = this.advance(); // consume '*'
      const right = this.parseNot();
      if (right === null) return null;
      left = { tag: 'and', left, right, loc: this.loc(opTok) };
    }

    return left;
  }

  // notExpr = NOT notExpr | primary
  private parseNot(): ExprNode | null {
    if (this.check('NOT')) {
      const notTok = this.advance(); // consume '!'
      const operand = this.parseNot(); // right-associative
      if (operand === null) return null;
      return { tag: 'not', operand, loc: this.loc(notTok) };
    }
    return this.parsePrimary();
  }

  // primary = IDENTIFIER | LPAREN expr RPAREN
  private parsePrimary(): ExprNode | null {
    const t = this.peek();

    if (t.type === 'IDENTIFIER') {
      this.advance();
      return { tag: 'identifier', name: t.value, loc: this.loc(t) };
    }

    if (t.type === 'LPAREN') {
      this.advance(); // consume '('
      const expr = this.parseOr();
      if (expr === null) return null;

      const rp = this.peek();
      if (rp.type !== 'RPAREN') {
        this.emitError(`Expected ')' but found '${rp.value}'`, rp);
        // Don't consume — let caller recover
      } else {
        this.advance(); // consume ')'
      }
      return expr;
    }

    // Nothing matched — error
    this.emitError(
      `Expected an identifier or '(' in expression, found '${t.value}'`,
      t
    );
    return null;
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Parse a full SEL logic source string into a list of equations
 * plus any diagnostics produced during parsing.
 */
export function parseSource(source: string): ParseResult {
  const lines = source.split('\n');
  const tokens = tokenize(source);
  const parser = new Parser(tokens, lines);
  return parser.parse();
}

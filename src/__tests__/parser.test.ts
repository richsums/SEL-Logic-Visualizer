// ============================================================
// Unit tests: parser (tokenizer + recursive descent)
// ============================================================

import { describe, it, expect } from 'vitest';
import { tokenize } from '../parser/tokenizer';
import { parseSource } from '../parser/parser';

// ------------------------------------------------------------------
// Tokenizer
// ------------------------------------------------------------------

describe('tokenizer', () => {
  it('tokenizes basic assignment', () => {
    const tokens = tokenize('TRIP = 87T + 50P\n');
    const types = tokens.map(t => t.type);
    expect(types).toEqual([
      'IDENTIFIER', 'EQUALS', 'IDENTIFIER', 'OR', 'IDENTIFIER', 'NEWLINE', 'EOF'
    ]);
  });

  it('tokenizes identifiers starting with digits (SEL element names)', () => {
    const tokens = tokenize('SV01 = 50P1T * !52A\n');
    const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
    expect(identifiers).toContain('50P1T');
    expect(identifiers).toContain('52A');
    expect(identifiers).toContain('SV01');
  });

  it('strips ; line comments', () => {
    const tokens = tokenize('; this is a comment\nTRIP = 87T\n');
    const types = tokens.map(t => t.type);
    expect(types).not.toContain('UNKNOWN');
    expect(types).toContain('IDENTIFIER');
  });

  it('strips // line comments', () => {
    const tokens = tokenize('// comment\nA = B\n');
    const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
    expect(identifiers).toEqual(['A', 'B']);
  });

  it('strips -- line comments', () => {
    const tokens = tokenize('-- comment\nA = B\n');
    const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
    expect(identifiers).toEqual(['A', 'B']);
  });

  it('tracks line numbers correctly', () => {
    const tokens = tokenize('A = B\nC = D\n');
    const cToken = tokens.find(t => t.value === 'C');
    expect(cToken?.line).toBe(2);
  });

  it('handles all operators', () => {
    const tokens = tokenize('A = B * !C + (D)');
    const types = tokens.map(t => t.type);
    expect(types).toContain('EQUALS');
    expect(types).toContain('AND');
    expect(types).toContain('OR');
    expect(types).toContain('NOT');
    expect(types).toContain('LPAREN');
    expect(types).toContain('RPAREN');
  });
});

// ------------------------------------------------------------------
// Parser
// ------------------------------------------------------------------

describe('parser', () => {
  it('parses a simple assignment', () => {
    const result = parseSource('TRIP = 87T\n');
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(result.equations).toHaveLength(1);
    expect(result.equations[0].target).toBe('TRIP');
  });

  it('parses AND expression', () => {
    const result = parseSource('X = A * B\n');
    expect(result.equations[0].expr.tag).toBe('and');
  });

  it('parses OR expression', () => {
    const result = parseSource('X = A + B\n');
    expect(result.equations[0].expr.tag).toBe('or');
  });

  it('parses NOT expression', () => {
    const result = parseSource('X = !A\n');
    expect(result.equations[0].expr.tag).toBe('not');
    const notExpr = result.equations[0].expr;
    if (notExpr.tag === 'not') {
      expect(notExpr.operand.tag).toBe('identifier');
    }
  });

  it('parses multiple equations', () => {
    const src = 'TRIP = SV01 + 87T\nSV01 = 50P1T * !52A\n';
    const result = parseSource(src);
    expect(result.equations).toHaveLength(2);
    expect(result.equations[0].target).toBe('TRIP');
    expect(result.equations[1].target).toBe('SV01');
  });

  it('handles SEL element names starting with digits', () => {
    const result = parseSource('X = 50P1T * 87T\n');
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(result.equations).toHaveLength(1);
  });

  it('handles comments', () => {
    const src = `; Trip logic\nTRIP = 87T + 50P\n; End\n`;
    const result = parseSource(src);
    expect(result.equations).toHaveLength(1);
    expect(result.equations[0].target).toBe('TRIP');
  });

  it('preserves source line number in equation', () => {
    const src = `A = X\nB = Y\nC = Z\n`;
    const result = parseSource(src);
    expect(result.equations[2].loc.line).toBe(3);
  });
});

// ------------------------------------------------------------------
// Operator precedence
// ------------------------------------------------------------------

describe('operator precedence', () => {
  it('AND binds tighter than OR: A + B * C parses as A + (B * C)', () => {
    const result = parseSource('X = A + B * C\n');
    const expr = result.equations[0].expr;
    // Top level should be OR
    expect(expr.tag).toBe('or');
    if (expr.tag === 'or') {
      expect(expr.left.tag).toBe('identifier');  // A
      expect(expr.right.tag).toBe('and');         // B * C
    }
  });

  it('NOT binds tighter than AND: A * !B parses as A * (!B)', () => {
    const result = parseSource('X = A * !B\n');
    const expr = result.equations[0].expr;
    expect(expr.tag).toBe('and');
    if (expr.tag === 'and') {
      expect(expr.left.tag).toBe('identifier');   // A
      expect(expr.right.tag).toBe('not');          // !B
    }
  });

  it('parentheses override precedence: A * (B + C)', () => {
    const result = parseSource('X = A * (B + C)\n');
    const expr = result.equations[0].expr;
    expect(expr.tag).toBe('and');
    if (expr.tag === 'and') {
      expect(expr.left.tag).toBe('identifier');   // A
      expect(expr.right.tag).toBe('or');           // B + C
    }
  });

  it('(A + B) * C — AND applied to parenthesized OR', () => {
    const result = parseSource('X = (A + B) * C\n');
    const expr = result.equations[0].expr;
    expect(expr.tag).toBe('and');
    if (expr.tag === 'and') {
      expect(expr.left.tag).toBe('or');            // A + B
      expect(expr.right.tag).toBe('identifier');   // C
    }
  });

  it('double NOT: !!A', () => {
    const result = parseSource('X = !!A\n');
    const expr = result.equations[0].expr;
    expect(expr.tag).toBe('not');
    if (expr.tag === 'not') {
      expect(expr.operand.tag).toBe('not');
    }
  });

  it('complex: A + B * C + D parses as (A + (B*C) + D) — left-associative OR', () => {
    const result = parseSource('X = A + B * C + D\n');
    const expr = result.equations[0].expr;
    // Parser is left-recursive: ((A + (B*C)) + D)
    expect(expr.tag).toBe('or');
    if (expr.tag === 'or') {
      expect(expr.right.tag).toBe('identifier'); // D
      expect(expr.left.tag).toBe('or');          // A + (B*C)
    }
  });
});

// ------------------------------------------------------------------
// Error recovery
// ------------------------------------------------------------------

describe('parser error recovery', () => {
  it('reports error for missing = sign', () => {
    const result = parseSource('TRIP 87T\n');
    expect(result.diagnostics.some(d => d.severity === 'error')).toBe(true);
  });

  it('continues parsing after an error', () => {
    // First line has an error, second should parse fine
    const result = parseSource('BAD LINE\nGOOD = 87T\n');
    // Should still get GOOD equation despite the error on line 1
    const goodEq = result.equations.find(eq => eq.target === 'GOOD');
    expect(goodEq).toBeDefined();
  });

  it('reports error for unmatched parenthesis', () => {
    const result = parseSource('X = (A + B\n');
    expect(result.diagnostics.some(d => d.severity === 'error')).toBe(true);
  });
});

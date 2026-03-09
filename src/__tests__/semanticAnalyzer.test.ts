// ============================================================
// Unit tests: semantic analyzer
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { analyzeSemantics } from '../analysis/semanticAnalyzer';
import {
  SAMPLE_3,
  DUPLICATE_FIXTURE,
  EMPTY_FIXTURE,
} from '../fixtures/sample3';

function parse(src: string) {
  return parseSource(src).equations;
}

// ------------------------------------------------------------------
// Undefined reference detection
// ------------------------------------------------------------------

describe('undefined reference detection', () => {
  it('identifies external inputs (used but not defined)', () => {
    const eqs = parse(SAMPLE_3);
    const result = analyzeSemantics(eqs);
    // 87T, LOCKOUT, 50P1T, 52A, 51PT, DC_OK, FAIL are all external inputs
    expect(result.undefinedReferences).toContain('87T');
    expect(result.undefinedReferences).toContain('52A');
    expect(result.undefinedReferences).toContain('DC_OK');
  });

  it('does NOT flag defined variables as undefined', () => {
    // SV01 is defined in SAMPLE_3
    const eqs = parse(SAMPLE_3);
    const result = analyzeSemantics(eqs);
    expect(result.undefinedReferences).not.toContain('SV01');
  });

  it('emits UNDEFINED_REF diagnostics', () => {
    const eqs = parse('X = UNDEFINED_VAR\n');
    const result = analyzeSemantics(eqs);
    const diag = result.diagnostics.find(d => d.code === 'UNDEFINED_REF');
    expect(diag).toBeDefined();
    expect(diag?.message).toContain('UNDEFINED_VAR');
  });

  it('handles empty equations array gracefully', () => {
    const eqs = parse(EMPTY_FIXTURE);
    const result = analyzeSemantics(eqs);
    expect(result.symbols.size).toBe(0);
    expect(result.undefinedReferences).toHaveLength(0);
  });
});

// ------------------------------------------------------------------
// Unused variable detection
// ------------------------------------------------------------------

describe('unused variable detection', () => {
  it('flags variables defined but never referenced', () => {
    // TRIP, SV01, ALARM are all defined.
    // TRIP and ALARM are top-level outputs (unreferenced by other equations).
    // SV01 is referenced by TRIP, so it's NOT unused.
    const eqs = parse(SAMPLE_3);
    const result = analyzeSemantics(eqs);

    // SV01 is referenced in the TRIP equation → should NOT be in unusedVariables
    expect(result.unusedVariables).not.toContain('SV01');

    // TRIP and ALARM are defined but never referenced by other equations
    expect(result.unusedVariables).toContain('TRIP');
    expect(result.unusedVariables).toContain('ALARM');
  });

  it('emits UNUSED_VAR info diagnostics', () => {
    const eqs = parse('UNUSED = X + Y\n');
    const result = analyzeSemantics(eqs);
    const diag = result.diagnostics.find(d => d.code === 'UNUSED_VAR');
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe('info');
  });

  it('does not flag intermediate variables as unused', () => {
    // A is referenced by B; B references A
    const eqs = parse('B = A + C\nA = X * Y\n');
    const result = analyzeSemantics(eqs);
    expect(result.unusedVariables).not.toContain('A');
    expect(result.unusedVariables).toContain('B'); // B is never referenced
  });
});

// ------------------------------------------------------------------
// Duplicate target detection
// ------------------------------------------------------------------

describe('duplicate target detection', () => {
  it('flags duplicate target assignments', () => {
    const eqs = parse(DUPLICATE_FIXTURE);
    const result = analyzeSemantics(eqs);
    const dupDiag = result.diagnostics.find(d => d.code === 'DUPLICATE_TARGET');
    expect(dupDiag).toBeDefined();
    expect(dupDiag?.message).toContain('TRIP');
  });

  it('does not flag unique targets', () => {
    const eqs = parse('A = X\nB = Y\nC = Z\n');
    const result = analyzeSemantics(eqs);
    expect(result.diagnostics.some(d => d.code === 'DUPLICATE_TARGET')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Symbol table construction
// ------------------------------------------------------------------

describe('symbol table', () => {
  it('contains all defined symbols', () => {
    const eqs = parse('TRIP = A\nSV01 = B * C\n');
    const result = analyzeSemantics(eqs);
    expect(result.symbols.has('TRIP')).toBe(true);
    expect(result.symbols.has('SV01')).toBe(true);
  });

  it('contains external input symbols', () => {
    const eqs = parse('TRIP = 87T\n');
    const result = analyzeSemantics(eqs);
    expect(result.symbols.has('87T')).toBe(true);
    expect(result.symbols.get('87T')?.isExternalInput).toBe(true);
  });

  it('marks defined symbols as non-external', () => {
    const eqs = parse('TRIP = 87T\n87T = X\n');
    const result = analyzeSemantics(eqs);
    expect(result.symbols.get('87T')?.isExternalInput).toBe(false);
  });
});

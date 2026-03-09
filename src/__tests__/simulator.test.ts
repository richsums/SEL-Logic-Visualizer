// ============================================================
// Unit tests: boolean circuit simulator
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { simulate, evalExpression } from '../analysis/simulator';
import type { SimulationState } from '../domain/models';

function mkState(inputs: Record<string, boolean>): SimulationState {
  return { enabled: true, inputValues: new Map(Object.entries(inputs)) };
}

function runSim(src: string, inputs: Record<string, boolean>) {
  const eqs   = parseSource(src).equations;
  const state = mkState(inputs);
  return simulate(eqs, state);
}

// ------------------------------------------------------------------
// Basic evaluation
// ------------------------------------------------------------------

describe('simulator — basic evaluation', () => {
  it('evaluates a simple OR: true OR false = true', () => {
    const r = runSim('OUT = A + B\n', { A: true, B: false });
    expect(r.values.get('OUT')).toBe(true);
  });

  it('evaluates a simple OR: false OR false = false', () => {
    const r = runSim('OUT = A + B\n', { A: false, B: false });
    expect(r.values.get('OUT')).toBe(false);
  });

  it('evaluates a simple AND: true AND true = true', () => {
    const r = runSim('OUT = A * B\n', { A: true, B: true });
    expect(r.values.get('OUT')).toBe(true);
  });

  it('evaluates a simple AND: true AND false = false', () => {
    const r = runSim('OUT = A * B\n', { A: true, B: false });
    expect(r.values.get('OUT')).toBe(false);
  });

  it('evaluates NOT: !true = false', () => {
    const r = runSim('OUT = !A\n', { A: true });
    expect(r.values.get('OUT')).toBe(false);
  });

  it('evaluates NOT: !false = true', () => {
    const r = runSim('OUT = !A\n', { A: false });
    expect(r.values.get('OUT')).toBe(true);
  });
});

// ------------------------------------------------------------------
// Chained / intermediate signals
// ------------------------------------------------------------------

describe('simulator — chained signals', () => {
  it('propagates through intermediate: TRIP=SV01, SV01=A', () => {
    const r = runSim('TRIP = SV01\nSV01 = A\n', { A: true });
    expect(r.values.get('SV01')).toBe(true);
    expect(r.values.get('TRIP')).toBe(true);
  });

  it('SV01 = 50P1T * !52A; with 50P1T=T, 52A=F → SV01=T', () => {
    const r = runSim('SV01 = 50P1T * !52A\n', { '50P1T': true, '52A': false });
    expect(r.values.get('SV01')).toBe(true);
  });

  it('SV01 = 50P1T * !52A; with 52A=T → SV01=F (blocked)', () => {
    const r = runSim('SV01 = 50P1T * !52A\n', { '50P1T': true, '52A': true });
    expect(r.values.get('SV01')).toBe(false);
  });

  it('complex: TRIP = SV01 + 87T; SV01 = 50P1T * !52A + 51PT', () => {
    // Scenario: 51PT=T triggers SV01 → TRIP
    const r = runSim(
      'TRIP = SV01 + 87T\nSV01 = 50P1T * !52A + 51PT\n',
      { '51PT': true, '87T': false, '50P1T': false, '52A': false }
    );
    expect(r.values.get('SV01')).toBe(true);
    expect(r.values.get('TRIP')).toBe(true);
  });
});

// ------------------------------------------------------------------
// Default values for undefined signals
// ------------------------------------------------------------------

describe('simulator — undefined signals default false', () => {
  it('undefined external input defaults to false', () => {
    const r = runSim('OUT = UNDEFINED_SIG\n', {});
    expect(r.values.get('OUT')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Cycle detection
// ------------------------------------------------------------------

describe('simulator — cycle handling', () => {
  it('signals in a cycle return null', () => {
    const r = runSim('A = B\nB = A\n', {});
    // Both A and B participate in a cycle
    const aVal = r.values.get('A');
    const bVal = r.values.get('B');
    expect(aVal === null || bVal === null).toBe(true);
  });
});

// ------------------------------------------------------------------
// Short-circuit evaluation
// ------------------------------------------------------------------

describe('simulator — short-circuit', () => {
  it('AND: false short-circuits without needing other operand', () => {
    // B is in a cycle but AND short-circuits on false A
    const r = runSim('OUT = A * B\nB = B\n', { A: false });
    expect(r.values.get('OUT')).toBe(false);
  });

  it('OR: true short-circuits without needing other operand', () => {
    const r = runSim('OUT = A + B\nB = B\n', { A: true });
    expect(r.values.get('OUT')).toBe(true);
  });
});

// ------------------------------------------------------------------
// evalExpression helper
// ------------------------------------------------------------------

describe('evalExpression', () => {
  it('evaluates a standalone expression', () => {
    const eqs = parseSource('DUMMY = A * !B\n').equations;
    const expr = eqs[0].expr;
    expect(evalExpression(expr, new Map([['A', true], ['B', false]]))).toBe(true);
    expect(evalExpression(expr, new Map([['A', true], ['B', true]]))).toBe(false);
  });
});

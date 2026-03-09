// ============================================================
// Unit tests: asserting path finder
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { analyzeSemantics } from '../analysis/semanticAnalyzer';
import {
  findAssertingPaths, deriveBlockingConditions, generateTruthPathExplanation,
} from '../analysis/pathFinder';
import type { SimulationResult } from '../domain/models';

function setup(src: string) {
  const eqs = parseSource(src).equations;
  const { symbols } = analyzeSemantics(eqs);
  return { eqs, symbols };
}

// ------------------------------------------------------------------
// Path enumeration
// ------------------------------------------------------------------

describe('findAssertingPaths', () => {
  it('returns one path for a single identifier', () => {
    const { eqs, symbols } = setup('OUT = A\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    expect(paths).toHaveLength(1);
    expect(paths[0].conditions.asserted).toContain('A');
  });

  it('returns two paths for an OR expression', () => {
    const { eqs, symbols } = setup('OUT = A + B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    expect(paths).toHaveLength(2);
    const allAsserted = paths.flatMap(p => p.conditions.asserted);
    expect(allAsserted).toContain('A');
    expect(allAsserted).toContain('B');
  });

  it('returns one path for an AND expression with both inputs', () => {
    const { eqs, symbols } = setup('OUT = A * B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    expect(paths).toHaveLength(1);
    expect(paths[0].conditions.asserted).toContain('A');
    expect(paths[0].conditions.asserted).toContain('B');
  });

  it('captures negated signals from NOT operators', () => {
    const { eqs, symbols } = setup('OUT = A * !B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    expect(paths).toHaveLength(1);
    expect(paths[0].conditions.asserted).toContain('A');
    expect(paths[0].conditions.negated).toContain('B');
  });

  it('expands intermediate variables inline', () => {
    const { eqs, symbols } = setup('TRIP = SV01\nSV01 = 50P1T * !52A\n');
    const paths = findAssertingPaths('TRIP', eqs, symbols);
    // SV01 is expanded: should see 50P1T and 52A in paths
    const allAsserted = paths.flatMap(p => p.conditions.asserted);
    const allNegated  = paths.flatMap(p => p.conditions.negated);
    expect(allAsserted).toContain('50P1T');
    expect(allNegated).toContain('52A');
  });

  it('handles three-way OR producing three paths', () => {
    const { eqs, symbols } = setup('TRIP = SV01 + 87T + LOCKOUT\n');
    const paths = findAssertingPaths('TRIP', eqs, symbols);
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array for external inputs (no definition)', () => {
    const { eqs, symbols } = setup('TRIP = 87T\n');
    // 87T itself is an external input — no paths can be found for it
    const paths = findAssertingPaths('87T', eqs, symbols);
    expect(paths).toHaveLength(0);
  });

  it('annotates isActive when simulationResult provided', () => {
    const { eqs, symbols } = setup('OUT = A + B\n');
    const simResult: SimulationResult = {
      values: new Map([['A', true], ['B', false], ['OUT', true]]),
    };
    const paths = findAssertingPaths('OUT', eqs, symbols, simResult);
    const activePaths = paths.filter(p => p.isActive === true);
    expect(activePaths.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------
// Blocking conditions
// ------------------------------------------------------------------

describe('deriveBlockingConditions', () => {
  it('identifies negated signals as blocking conditions', () => {
    const { eqs, symbols } = setup('OUT = A * !B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    const bcs   = deriveBlockingConditions(paths);
    expect(bcs.map(bc => bc.signal)).toContain('B');
  });

  it('returns empty array when no NOT operators exist', () => {
    const { eqs, symbols } = setup('OUT = A + B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    const bcs   = deriveBlockingConditions(paths);
    expect(bcs).toHaveLength(0);
  });

  it('groups multiple paths that share the same blocking signal', () => {
    const { eqs, symbols } = setup('OUT = A * !Z + B * !Z\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    const bcs   = deriveBlockingConditions(paths);
    const zbc   = bcs.find(bc => bc.signal === 'Z');
    expect(zbc).toBeDefined();
    // Z should block multiple paths
    expect(zbc!.pathIndices.length).toBeGreaterThanOrEqual(2);
  });
});

// ------------------------------------------------------------------
// Truth-path explanation
// ------------------------------------------------------------------

describe('generateTruthPathExplanation', () => {
  it('produces a non-empty string', () => {
    const { eqs, symbols } = setup('TRIP = 87T + 50P\n');
    const paths = findAssertingPaths('TRIP', eqs, symbols);
    const text  = generateTruthPathExplanation('TRIP', paths);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('mentions the target symbol', () => {
    const { eqs, symbols } = setup('TRIP = 87T + 50P\n');
    const paths = findAssertingPaths('TRIP', eqs, symbols);
    const text  = generateTruthPathExplanation('TRIP', paths);
    expect(text).toContain('TRIP');
  });

  it('mentions blocking conditions when present', () => {
    const { eqs, symbols } = setup('OUT = A * !B\n');
    const paths = findAssertingPaths('OUT', eqs, symbols);
    const text  = generateTruthPathExplanation('OUT', paths);
    expect(text.toLowerCase()).toContain('block');
  });
});

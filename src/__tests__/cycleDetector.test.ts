// ============================================================
// Unit tests: cycle detector
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { buildDependencyGraph, detectCycles } from '../analysis/cycleDetector';
import { CYCLE_FIXTURE, SAMPLE_3 } from '../fixtures/sample3';

function analyze(src: string) {
  const eqs = parseSource(src).equations;
  const graph = buildDependencyGraph(eqs);
  return detectCycles(graph);
}

// ------------------------------------------------------------------
// Cycle detection
// ------------------------------------------------------------------

describe('cycle detection', () => {
  it('detects a direct two-node cycle: A = B, B = A', () => {
    const result = analyze('A = B\nB = A\n');
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('detects cycle in fixture: A = B + C, B = A * D', () => {
    const result = analyze(CYCLE_FIXTURE);
    expect(result.cycles.length).toBeGreaterThan(0);
    // A and B must both appear in a cycle
    const allCycleNodes = result.cycles.flat();
    expect(allCycleNodes).toContain('A');
    expect(allCycleNodes).toContain('B');
  });

  it('emits CYCLE_DETECTED diagnostics', () => {
    const result = analyze('A = B\nB = A\n');
    const diag = result.diagnostics.find(d => d.code === 'CYCLE_DETECTED');
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe('error');
  });

  it('returns no cycles for acyclic logic', () => {
    const result = analyze(SAMPLE_3);
    expect(result.cycles).toHaveLength(0);
  });

  it('returns no cycles for single equation', () => {
    const result = analyze('TRIP = 87T + 50P\n');
    expect(result.cycles).toHaveLength(0);
  });

  it('does not report self-reference as a false cycle when absent', () => {
    const result = analyze('A = B\nB = C\nC = D\n');
    expect(result.cycles).toHaveLength(0);
  });

  it('detects three-node cycle: A = B, B = C, C = A', () => {
    const result = analyze('A = B\nB = C\nC = A\n');
    expect(result.cycles.length).toBeGreaterThan(0);
    const flat = result.cycles.flat();
    expect(flat).toContain('A');
    expect(flat).toContain('B');
    expect(flat).toContain('C');
  });
});

// ------------------------------------------------------------------
// Dependency graph construction
// ------------------------------------------------------------------

describe('dependency graph', () => {
  it('builds edges from target to its dependencies', () => {
    const eqs = parseSource('TRIP = SV01 + 87T\n').equations;
    const graph = buildDependencyGraph(eqs);
    const tripNode = graph.nodes.get('TRIP');
    expect(tripNode).toBeDefined();
    expect(tripNode?.dependsOn).toContain('SV01');
    expect(tripNode?.dependsOn).toContain('87T');
  });

  it('records reverse dependencies', () => {
    const eqs = parseSource('TRIP = SV01\nSV01 = 87T\n').equations;
    const graph = buildDependencyGraph(eqs);
    const sv01Node = graph.nodes.get('SV01');
    expect(sv01Node?.dependedOnBy).toContain('TRIP');
  });

  it('does not duplicate edges for same reference', () => {
    // A references B twice (would be unusual but shouldn't duplicate edges)
    const eqs = parseSource('A = B + B\n').equations;
    const graph = buildDependencyGraph(eqs);
    const aNode = graph.nodes.get('A');
    const bCount = aNode?.dependsOn.filter(d => d === 'B').length ?? 0;
    expect(bCount).toBe(1);
  });
});

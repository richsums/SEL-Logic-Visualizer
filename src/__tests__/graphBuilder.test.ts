// ============================================================
// Unit tests: gate graph builder
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseSource } from '../parser/parser';
import { analyzeSemantics } from '../analysis/semanticAnalyzer';
import { buildGateGraph, traceUpstream } from '../analysis/graphBuilder';
import { SAMPLE_3 } from '../fixtures/sample3';

function build(src: string) {
  const eqs = parseSource(src).equations;
  const { symbols } = analyzeSemantics(eqs);
  return { graph: buildGateGraph(eqs, symbols), symbols };
}

// ------------------------------------------------------------------
// Gate graph construction
// ------------------------------------------------------------------

describe('gate graph builder', () => {
  it('creates signal nodes for all symbols', () => {
    const { graph } = build('TRIP = 87T\n');
    // Both TRIP and 87T should have signal nodes
    const nodeIds = Array.from(graph.nodes.keys());
    expect(nodeIds.some(id => id.includes('TRIP'))).toBe(true);
    expect(nodeIds.some(id => id.includes('87T'))).toBe(true);
  });

  it('creates a NOT gate node for negated operand', () => {
    const { graph } = build('X = !A\n');
    const gateNodes = Array.from(graph.nodes.values()).filter(n => n.gateType === 'NOT');
    expect(gateNodes.length).toBeGreaterThan(0);
  });

  it('creates an AND gate node for AND expression', () => {
    const { graph } = build('X = A * B\n');
    const andNodes = Array.from(graph.nodes.values()).filter(n => n.gateType === 'AND');
    expect(andNodes.length).toBeGreaterThan(0);
  });

  it('creates an OR gate node for OR expression', () => {
    const { graph } = build('X = A + B\n');
    const orNodes = Array.from(graph.nodes.values()).filter(n => n.gateType === 'OR');
    expect(orNodes.length).toBeGreaterThan(0);
  });

  it('wire the expression output into the target signal node', () => {
    const { graph } = build('TRIP = 87T + 50P\n');
    const tripSigNode = graph.nodes.get('sig_TRIP');
    expect(tripSigNode).toBeDefined();
    // Its inputs should include the OR gate
    expect(tripSigNode!.inputs.length).toBeGreaterThan(0);
  });

  it('shares signal nodes across equations', () => {
    // SV01 is defined in eq 1 and referenced in eq 2 — should be the same signal node
    const { graph } = build('TRIP = SV01 + 87T\nSV01 = X * Y\n');
    const sv01NodeCount = Array.from(graph.nodes.values()).filter(
      n => n.gateType === 'SIGNAL' && n.symbolName === 'SV01'
    ).length;
    expect(sv01NodeCount).toBe(1);
  });

  it('classifies external inputs correctly', () => {
    const { graph } = build('TRIP = 87T + 50P\n');
    expect(graph.inputSignalIds.some(id => id.includes('87T'))).toBe(true);
    expect(graph.inputSignalIds.some(id => id.includes('50P'))).toBe(true);
  });

  it('classifies unreferenced outputs correctly', () => {
    const { graph } = build(SAMPLE_3);
    // TRIP and ALARM are top-level outputs (defined but not referenced by other equations)
    expect(graph.outputSignalIds.some(id => id.includes('TRIP'))).toBe(true);
    expect(graph.outputSignalIds.some(id => id.includes('ALARM'))).toBe(true);
  });
});

// ------------------------------------------------------------------
// Upstream tracing
// ------------------------------------------------------------------

describe('traceUpstream', () => {
  it('includes the starting node itself', () => {
    const { graph } = build('TRIP = 87T\n');
    const upstream = traceUpstream('sig_TRIP', graph);
    expect(upstream.has('sig_TRIP')).toBe(true);
  });

  it('includes immediate upstream nodes', () => {
    const { graph } = build('TRIP = 87T + 50P\n');
    const upstream = traceUpstream('sig_TRIP', graph);
    // The OR gate and both inputs should be reachable
    expect(upstream.has('sig_87T')).toBe(true);
    expect(upstream.has('sig_50P')).toBe(true);
  });

  it('traces through multiple levels', () => {
    const { graph } = build('TRIP = SV01\nSV01 = 87T\n');
    const upstream = traceUpstream('sig_TRIP', graph);
    // Should reach all the way back to 87T
    expect(upstream.has('sig_87T')).toBe(true);
    expect(upstream.has('sig_SV01')).toBe(true);
  });

  it('returns only the start node for a leaf signal node', () => {
    const { graph } = build('TRIP = 87T\n');
    const upstream = traceUpstream('sig_87T', graph);
    expect(upstream.size).toBe(1);
    expect(upstream.has('sig_87T')).toBe(true);
  });

  it('handles missing start node gracefully', () => {
    const { graph } = build('TRIP = 87T\n');
    const upstream = traceUpstream('nonexistent_node', graph);
    expect(upstream.has('nonexistent_node')).toBe(true);
    expect(upstream.size).toBe(1);
  });
});

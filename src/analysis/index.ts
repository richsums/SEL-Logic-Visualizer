// ============================================================
// Analysis module public API
// ============================================================

export { analyzeSemantics } from './semanticAnalyzer';
export type { SemanticAnalysisResult } from './semanticAnalyzer';

export { buildDependencyGraph, detectCycles } from './cycleDetector';
export type { CycleDetectionResult } from './cycleDetector';

export { buildGateGraph, traceUpstream } from './graphBuilder';

export { generateExplanation } from './explanationGenerator';
export type { EnglishExplanationResult } from './explanationGenerator';

// ── Convenience: run the full analysis pipeline ─────────────

import type { Equation, AnalysisResult } from '../domain/models';
import { analyzeSemantics } from './semanticAnalyzer';
import { buildDependencyGraph, detectCycles } from './cycleDetector';

/**
 * Run the complete analysis pipeline on a list of parsed equations.
 * Returns the unified AnalysisResult.
 */
export function runAnalysis(equations: Equation[]): AnalysisResult {
  const semantic = analyzeSemantics(equations);
  const depGraph = buildDependencyGraph(equations);
  const { cycles, diagnostics: cycleDiags } = detectCycles(depGraph);

  const allDiagnostics = [
    ...semantic.diagnostics,
    ...cycleDiags,
  ];

  return {
    symbols: semantic.symbols,
    undefinedReferences: semantic.undefinedReferences,
    unusedVariables: semantic.unusedVariables,
    cycles,
    diagnostics: allDiagnostics,
  };
}

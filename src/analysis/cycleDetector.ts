// ============================================================
// Cycle detector for the symbol dependency graph
//
// Builds a directed graph where each node is a symbol name and each
// directed edge A → B means "A's definition references B".
// Then runs iterative DFS to find all strongly-connected components
// that form cycles.
// ============================================================

import type { Equation, ExprNode, DependencyGraph, Diagnostic } from '../domain/models';

// ------------------------------------------------------------------
// Build dependency graph from equations
// ------------------------------------------------------------------

function collectIdentifiers(expr: ExprNode, out: Set<string>): void {
  switch (expr.tag) {
    case 'identifier': out.add(expr.name); break;
    case 'not': collectIdentifiers(expr.operand, out); break;
    case 'and':
    case 'or':
      collectIdentifiers(expr.left, out);
      collectIdentifiers(expr.right, out);
      break;
  }
}

export function buildDependencyGraph(equations: Equation[]): DependencyGraph {
  const nodes = new Map<string, { name: string; dependsOn: string[]; dependedOnBy: string[] }>();

  // Register all defined symbols
  for (const eq of equations) {
    if (!nodes.has(eq.target)) {
      nodes.set(eq.target, { name: eq.target, dependsOn: [], dependedOnBy: [] });
    }
  }

  // Register all referenced symbols and build edges
  for (const eq of equations) {
    const deps = new Set<string>();
    collectIdentifiers(eq.expr, deps);

    const targetNode = nodes.get(eq.target)!;

    for (const dep of deps) {
      if (!nodes.has(dep)) {
        nodes.set(dep, { name: dep, dependsOn: [], dependedOnBy: [] });
      }
      if (!targetNode.dependsOn.includes(dep)) {
        targetNode.dependsOn.push(dep);
        nodes.get(dep)!.dependedOnBy.push(eq.target);
      }
    }
  }

  return { nodes };
}

// ------------------------------------------------------------------
// Cycle detection via iterative DFS (finding all back edges)
// ------------------------------------------------------------------

export interface CycleDetectionResult {
  /** Each inner array represents one cycle as a sequence of symbol names. */
  cycles: string[][];
  diagnostics: Diagnostic[];
}

/**
 * Detect cycles in the dependency graph using DFS.
 * Returns all detected cycles and associated diagnostics.
 */
export function detectCycles(graph: DependencyGraph): CycleDetectionResult {
  const cycles: string[][] = [];
  const diagnostics: Diagnostic[] = [];

  type State = 'unvisited' | 'in-stack' | 'done';
  const state = new Map<string, State>();
  const parent = new Map<string, string | null>();

  for (const name of graph.nodes.keys()) {
    state.set(name, 'unvisited');
  }

  // We use an explicit stack to avoid recursion limits on large graphs.
  for (const startName of graph.nodes.keys()) {
    if (state.get(startName) !== 'unvisited') continue;

    // Stack entries: [nodeName, iteratorIndex]
    const callStack: Array<{ name: string; depIndex: number }> = [];
    const pathSet = new Set<string>();

    callStack.push({ name: startName, depIndex: 0 });
    state.set(startName, 'in-stack');
    pathSet.add(startName);
    parent.set(startName, null);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const node = graph.nodes.get(frame.name)!;
      const deps = node.dependsOn;

      if (frame.depIndex < deps.length) {
        const dep = deps[frame.depIndex];
        frame.depIndex++;

        const depState = state.get(dep) ?? 'unvisited';

        if (depState === 'in-stack') {
          // Back edge found — extract the cycle
          const cycle: string[] = [dep];
          for (let i = callStack.length - 1; i >= 0; i--) {
            cycle.unshift(callStack[i].name);
            if (callStack[i].name === dep) break;
          }

          const cycleKey = [...cycle].sort().join(',');
          const alreadyRecorded = cycles.some(
            c => [...c].sort().join(',') === cycleKey
          );

          if (!alreadyRecorded) {
            cycles.push(cycle);
            const cycleStr = cycle.join(' → ');
            diagnostics.push({
              severity: 'error',
              code: 'CYCLE_DETECTED',
              message: `Circular dependency detected: ${cycleStr}`,
              detail: cycleStr,
            });
          }
        } else if (depState === 'unvisited') {
          state.set(dep, 'in-stack');
          pathSet.add(dep);
          parent.set(dep, frame.name);
          callStack.push({ name: dep, depIndex: 0 });
        }
        // 'done' → already fully explored, skip
      } else {
        // All dependencies of this node explored — pop it
        state.set(frame.name, 'done');
        pathSet.delete(frame.name);
        callStack.pop();
      }
    }
  }

  return { cycles, diagnostics };
}

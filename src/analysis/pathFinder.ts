// ============================================================
// Asserting path enumeration
//
// Finds all minimal sets of signal values (one per OR branch)
// that would assert a given output signal.
//
// Each "path" is a PathCondition:
//   asserted[] = signals that must be TRUE  (AND/IDENTIFIER branches)
//   negated[]  = signals that must be FALSE (NOT branches → blocking conditions)
//
// Algorithm: recursive symbolic evaluation of the expression tree.
// OR nodes fork into separate paths; AND nodes merge (intersection).
// NOT<identifier> nodes append to the negated list.
// Intermediate signals are expanded inline up to MAX_DEPTH.
// ============================================================

import type {
  Equation,
  ExprNode,
  SymbolEntry,
  AssertingPath,
  PathCondition,
  BlockingCondition,
  SimulationResult,
} from '../domain/models';

const MAX_DEPTH = 6;
const MAX_PATHS = 24;

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function mergeConditions(a: PathCondition, b: PathCondition): PathCondition {
  return {
    asserted: [...new Set([...a.asserted, ...b.asserted])],
    negated:  [...new Set([...a.negated,  ...b.negated])],
  };
}

function emptyCondition(): PathCondition {
  return { asserted: [], negated: [] };
}

/**
 * Recursively enumerate all PathConditions that can assert `expr`.
 * Returns an empty array on error / overflow.
 */
function enumerate(
  expr: ExprNode,
  eqMap: Map<string, Equation>,
  symbols: Map<string, SymbolEntry>,
  accumulated: PathCondition,
  depth: number
): PathCondition[] {
  if (depth > MAX_DEPTH) return [accumulated];

  switch (expr.tag) {
    case 'identifier': {
      const name = expr.name;
      const entry = symbols.get(name);

      if (!entry || entry.isExternalInput || !entry.definedBy) {
        // Leaf input — add to asserted set
        return [mergeConditions(accumulated, { asserted: [name], negated: [] })];
      }

      // Intermediate: expand inline
      return enumerate(entry.definedBy.expr, eqMap, symbols, accumulated, depth + 1);
    }

    case 'not': {
      if (expr.operand.tag === 'identifier') {
        const name = expr.operand.name;
        return [mergeConditions(accumulated, { asserted: [], negated: [name] })];
      }
      // Complex NOT — treat the whole operand as a blocking black-box
      // We represent it by noting the NOT node exists but not expanding further.
      return [accumulated];
    }

    case 'or': {
      // Each branch is a separate path
      const left  = enumerate(expr.left,  eqMap, symbols, accumulated, depth);
      const right = enumerate(expr.right, eqMap, symbols, accumulated, depth);
      return [...left, ...right];
    }

    case 'and': {
      // Conditions from left and right must both hold: merge them
      const leftPaths = enumerate(expr.left, eqMap, symbols, accumulated, depth);
      const merged: PathCondition[] = [];
      for (const lp of leftPaths) {
        const rightPaths = enumerate(expr.right, eqMap, symbols, lp, depth);
        merged.push(...rightPaths);
      }
      return merged;
    }
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Enumerate all asserting paths for `targetSymbol`.
 * If `simulationResult` is provided, each path is annotated with
 * whether it is currently active.
 */
export function findAssertingPaths(
  targetSymbol: string,
  equations: Equation[],
  symbols: Map<string, SymbolEntry>,
  simulationResult?: SimulationResult
): AssertingPath[] {
  const eqMap = new Map<string, Equation>();
  for (const eq of equations) eqMap.set(eq.target, eq);

  const entry = symbols.get(targetSymbol);
  if (!entry?.definedBy) return [];

  const rawConditions = enumerate(
    entry.definedBy.expr,
    eqMap,
    symbols,
    emptyCondition(),
    0
  );

  // Deduplicate by canonicalized string key
  const seen = new Set<string>();
  const unique: PathCondition[] = [];
  for (const cond of rawConditions) {
    const key = [
      [...cond.asserted].sort().join(','),
      [...cond.negated].sort().join(','),
    ].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cond);
    }
    if (unique.length >= MAX_PATHS) break;
  }

  return unique.map((cond, i) => {
    let isActive: boolean | undefined;
    if (simulationResult) {
      // A path is active when every asserted signal is true and every negated
      // signal is false in the simulation result.
      const assertedOk = cond.asserted.every(
        s => simulationResult.values.get(s) === true
      );
      const negatedOk = cond.negated.every(
        s => simulationResult.values.get(s) === false || simulationResult.values.get(s) == null
      );
      isActive = assertedOk && negatedOk;
    }
    return { index: i + 1, conditions: cond, isActive };
  });
}

/**
 * Derive blocking conditions from a list of asserting paths.
 * A blocking condition is a signal in the `negated` list of at least one path.
 */
export function deriveBlockingConditions(
  paths: AssertingPath[]
): BlockingCondition[] {
  const map = new Map<string, number[]>();

  for (const path of paths) {
    for (const signal of path.conditions.negated) {
      if (!map.has(signal)) map.set(signal, []);
      map.get(signal)!.push(path.index);
    }
  }

  return Array.from(map.entries()).map(([signal, pathIndices]) => ({
    signal,
    pathIndices,
  }));
}

/**
 * Generate a structured English explanation of all asserting paths,
 * including blocking conditions.
 */
export function generateTruthPathExplanation(
  targetSymbol: string,
  paths: AssertingPath[],
  simulationResult?: SimulationResult
): string {
  if (paths.length === 0) {
    return `${targetSymbol} has no resolvable asserting paths.`;
  }

  const lines: string[] = [`${targetSymbol} can assert via ${paths.length} path(s):\n`];

  for (const path of paths) {
    const { asserted, negated } = path.conditions;
    const activeLabel = simulationResult
      ? path.isActive ? ' ✓ [ACTIVE]' : ' ✗ [inactive]'
      : '';

    const parts: string[] = [];
    if (asserted.length > 0) parts.push(`${asserted.join(' AND ')} is true`);
    if (negated.length > 0)  parts.push(`${negated.join(' AND ')} is false`);

    lines.push(`  Path ${path.index}${activeLabel}: ${parts.join(', and ')}`);
  }

  const blocking = deriveBlockingConditions(paths);
  if (blocking.length > 0) {
    lines.push('\nBlocking conditions (signals whose assertion inhibits a path):');
    for (const bc of blocking) {
      const pathNums = bc.pathIndices.join(', ');
      lines.push(`  • ${bc.signal} blocks path(s): ${pathNums}`);
    }
  }

  return lines.join('\n');
}

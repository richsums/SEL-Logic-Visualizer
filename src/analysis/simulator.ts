// ============================================================
// Boolean circuit simulator
//
// Given a set of equations and user-controlled input values,
// evaluates every signal in the circuit using memoized recursive
// descent.  Handles cycles gracefully by returning null for any
// signal that participates in a circular dependency.
// ============================================================

import type { Equation, ExprNode, SimulationState, SimulationResult } from '../domain/models';

/**
 * Evaluate all signals in the circuit given the current input state.
 *
 * Short-circuit evaluation is used for AND / OR so that one branch
 * being definitively false / true does not require the other branch
 * (which may be in a cycle) to be evaluated.
 */
export function simulate(
  equations: Equation[],
  state: SimulationState
): SimulationResult {
  // Build equation lookup map (last writer wins for duplicates)
  const eqMap = new Map<string, Equation>();
  for (const eq of equations) {
    eqMap.set(eq.target, eq);
  }

  // Memoised values
  const cache = new Map<string, boolean | null>();

  // Tracks which signals are currently on the call stack (for cycle detection)
  const inProgress = new Set<string>();

  function evalSignal(name: string): boolean | null {
    // User override / external input value
    if (state.inputValues.has(name)) {
      return state.inputValues.get(name)!;
    }

    if (cache.has(name)) return cache.get(name)!;

    // Cycle detection
    if (inProgress.has(name)) {
      return null;
    }

    const eq = eqMap.get(name);
    if (!eq) {
      // Undefined external input defaults to false
      cache.set(name, false);
      return false;
    }

    inProgress.add(name);
    const value = evalExpr(eq.expr);
    inProgress.delete(name);
    cache.set(name, value);
    return value;
  }

  function evalExpr(expr: ExprNode): boolean | null {
    switch (expr.tag) {
      case 'identifier':
        return evalSignal(expr.name);

      case 'not': {
        const v = evalExpr(expr.operand);
        return v === null ? null : !v;
      }

      case 'and': {
        const l = evalExpr(expr.left);
        if (l === false) return false;       // short-circuit
        const r = evalExpr(expr.right);
        if (r === false) return false;
        if (l === null || r === null) return null;
        return true;
      }

      case 'or': {
        const l = evalExpr(expr.left);
        if (l === true) return true;         // short-circuit
        const r = evalExpr(expr.right);
        if (r === true) return true;
        if (l === null || r === null) return null;
        return false;
      }
    }
  }

  // Evaluate all defined signals
  const values = new Map<string, boolean | null>();

  for (const eq of equations) {
    values.set(eq.target, evalSignal(eq.target));
  }

  // Also record user-set input values
  for (const [name, val] of state.inputValues) {
    if (!values.has(name)) values.set(name, val);
  }

  return { values };
}

/**
 * Evaluate a single expression subtree in isolation (useful for testing).
 */
export function evalExpression(
  expr: ExprNode,
  inputs: Map<string, boolean>
): boolean | null {
  const dummyEq: Equation = {
    target: '__eval__',
    expr,
    loc: { line: 0, rawSource: '' },
  };
  const result = simulate([dummyEq], { enabled: true, inputValues: inputs });
  return result.values.get('__eval__') ?? null;
}

// ============================================================
// Gate-level graph builder
//
// Converts a list of parsed Equations into a GateGraph IR.
//
// Approach:
//   1. Create one SIGNAL node per unique symbol (both defined and
//      external inputs).
//   2. For each equation, recursively build gate nodes for its
//      expression tree.
//   3. The top-level gate/signal node of the expression feeds the
//      target's SIGNAL node.
//
// Node ID scheme:
//   Signal nodes : "sig_<SYMBOLNAME>"   (stable across equations)
//   Gate nodes   : "gate_<EQTARGET>_<TYPE>_<COUNTER>"
// ============================================================

import type {
  Equation,
  ExprNode,
  GateGraph,
  GateIRNode,
  GateType,
  SymbolEntry,
} from '../domain/models';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function signalId(name: string): string {
  // Sanitise: replace chars that are problematic in CSS / React keys
  return `sig_${name.replace(/[^A-Za-z0-9_]/g, '_')}`;
}

interface BuildContext {
  nodes: Map<string, GateIRNode>;
  counter: number;
}

function freshGateId(ctx: BuildContext, equationTarget: string, type: GateType): string {
  return `gate_${equationTarget}_${type}_${ctx.counter++}`;
}

/**
 * Recursively build gate nodes for an expression subtree.
 * Returns the ID of the node that represents the OUTPUT of this subtree.
 */
function buildExprNode(
  expr: ExprNode,
  equationTarget: string,
  ctx: BuildContext
): string {
  switch (expr.tag) {
    case 'identifier': {
      // Return the signal node for this identifier.
      // The signal node itself was already created in the first pass.
      return signalId(expr.name);
    }

    case 'not': {
      const operandId = buildExprNode(expr.operand, equationTarget, ctx);
      const id = freshGateId(ctx, equationTarget, 'NOT');
      ctx.nodes.set(id, {
        id,
        gateType: 'NOT',
        label: 'NOT',
        loc: expr.loc,
        inputs: [operandId],
      });
      return id;
    }

    case 'and': {
      const leftId  = buildExprNode(expr.left,  equationTarget, ctx);
      const rightId = buildExprNode(expr.right, equationTarget, ctx);
      const id = freshGateId(ctx, equationTarget, 'AND');
      ctx.nodes.set(id, {
        id,
        gateType: 'AND',
        label: 'AND',
        loc: expr.loc,
        inputs: [leftId, rightId],
      });
      return id;
    }

    case 'or': {
      const leftId  = buildExprNode(expr.left,  equationTarget, ctx);
      const rightId = buildExprNode(expr.right, equationTarget, ctx);
      const id = freshGateId(ctx, equationTarget, 'OR');
      ctx.nodes.set(id, {
        id,
        gateType: 'OR',
        label: 'OR',
        loc: expr.loc,
        inputs: [leftId, rightId],
      });
      return id;
    }
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Build a gate-level IR graph from a list of parsed equations and
 * the symbol table produced by semantic analysis.
 */
export function buildGateGraph(
  equations: Equation[],
  symbols: Map<string, SymbolEntry>
): GateGraph {
  const nodes = new Map<string, GateIRNode>();
  const ctx: BuildContext = { nodes, counter: 0 };

  // ── Pass 1: create SIGNAL nodes for every known symbol ──────

  for (const entry of symbols.values()) {
    const id = signalId(entry.name);
    nodes.set(id, {
      id,
      gateType: 'SIGNAL',
      label: entry.name,
      symbolName: entry.name,
      loc: entry.definedBy?.loc,
      inputs: [], // filled in pass 2
    });
  }

  // ── Pass 2: build expression trees for each equation ────────

  for (const eq of equations) {
    const targetSigId = signalId(eq.target);

    // Build the gate tree rooted at the expression
    const exprOutputId = buildExprNode(eq.expr, eq.target, ctx);

    // Wire the top-level gate output into the target signal node
    const targetSig = nodes.get(targetSigId);
    if (targetSig) {
      // Avoid duplicate inputs (in case of duplicate target equations)
      if (!targetSig.inputs.includes(exprOutputId)) {
        targetSig.inputs.push(exprOutputId);
      }
    }
  }

  // ── Pass 3: classify input and output signal IDs ─────────────

  const inputSignalIds: string[] = [];
  const outputSignalIds: string[] = [];

  for (const entry of symbols.values()) {
    if (entry.isExternalInput) {
      inputSignalIds.push(signalId(entry.name));
    }
    if (entry.isUnreferenced && !entry.isExternalInput) {
      outputSignalIds.push(signalId(entry.name));
    }
  }

  return { nodes, inputSignalIds, outputSignalIds };
}

/** Return all gate-graph node IDs reachable upstream from `startId`. */
export function traceUpstream(startId: string, graph: GateGraph): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = graph.nodes.get(id);
    if (node) {
      for (const inputId of node.inputs) {
        queue.push(inputId);
      }
    }
  }

  return visited;
}

// ============================================================
// Revision diff engine
//
// Compares two sets of equations (Revision A vs Revision B) and
// produces a structured diff report: added, removed, modified,
// and unchanged symbols.
//
// Expressions are compared by their canonical string representation.
// ============================================================

import type { Equation, ExprNode, RevisionDiff, EquationDiff } from '../domain/models';

// ------------------------------------------------------------------
// Canonical expression serialiser
// ------------------------------------------------------------------

export function exprToCanonical(expr: ExprNode): string {
  switch (expr.tag) {
    case 'identifier': return expr.name;
    case 'not':        return `!${exprToCanonical(expr.operand)}`;
    case 'and': {
      const l = exprToCanonical(expr.left);
      const r = exprToCanonical(expr.right);
      return `(${l}*${r})`;
    }
    case 'or': {
      const l = exprToCanonical(expr.left);
      const r = exprToCanonical(expr.right);
      return `(${l}+${r})`;
    }
  }
}

// Reconstruct a pretty-printed equation string (used for detail messages)
function prettyExpr(expr: ExprNode): string {
  switch (expr.tag) {
    case 'identifier': return expr.name;
    case 'not': return `!${prettyExpr(expr.operand)}`;
    case 'and': {
      const needsParens = (e: ExprNode) => e.tag === 'or';
      const l = needsParens(expr.left)  ? `(${prettyExpr(expr.left)})`  : prettyExpr(expr.left);
      const r = needsParens(expr.right) ? `(${prettyExpr(expr.right)})` : prettyExpr(expr.right);
      return `${l} * ${r}`;
    }
    case 'or': {
      return `${prettyExpr(expr.left)} + ${prettyExpr(expr.right)}`;
    }
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Compare two lists of equations and return a full diff report.
 *
 * @param equationsA  The "before" revision (Revision A).
 * @param equationsB  The "after"  revision (Revision B).
 */
export function diffRevisions(
  equationsA: Equation[],
  equationsB: Equation[]
): RevisionDiff {
  const mapA = new Map<string, Equation>();
  const mapB = new Map<string, Equation>();

  // Last assignment wins for duplicate targets within each revision
  for (const eq of equationsA) mapA.set(eq.target, eq);
  for (const eq of equationsB) mapB.set(eq.target, eq);

  const allTargets = new Set([...mapA.keys(), ...mapB.keys()]);

  const diffs: EquationDiff[] = [];
  const addedSymbols:    string[] = [];
  const removedSymbols:  string[] = [];
  const modifiedSymbols: string[] = [];
  const unchangedSymbols: string[] = [];

  for (const target of allTargets) {
    const inA = mapA.has(target);
    const inB = mapB.has(target);

    if (inA && !inB) {
      diffs.push({ target, status: 'removed', before: mapA.get(target) });
      removedSymbols.push(target);
    } else if (!inA && inB) {
      diffs.push({ target, status: 'added', after: mapB.get(target) });
      addedSymbols.push(target);
    } else {
      const a = mapA.get(target)!;
      const b = mapB.get(target)!;
      const canonA = exprToCanonical(a.expr);
      const canonB = exprToCanonical(b.expr);

      if (canonA === canonB) {
        diffs.push({ target, status: 'unchanged', before: a, after: b });
        unchangedSymbols.push(target);
      } else {
        diffs.push({
          target,
          status: 'modified',
          before: a,
          after:  b,
          detail: `Was:  ${target} = ${prettyExpr(a.expr)}\nNow:  ${target} = ${prettyExpr(b.expr)}`,
        });
        modifiedSymbols.push(target);
      }
    }
  }

  // Sort diffs for consistent display: modified first, then added, removed, unchanged
  const order: Record<string, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 };
  diffs.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return { equations: diffs, addedSymbols, removedSymbols, modifiedSymbols, unchangedSymbols };
}

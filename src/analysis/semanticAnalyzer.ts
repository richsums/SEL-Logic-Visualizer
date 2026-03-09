// ============================================================
// Semantic analyzer
//
// Responsibilities:
//   1. Build a symbol table from all parsed equations.
//   2. Identify external inputs (referenced but never defined).
//   3. Identify unused variables (defined but never referenced).
//   4. Detect duplicate target assignments.
//   5. Produce Diagnostic entries for all anomalies.
// ============================================================

import type {
  Equation,
  ExprNode,
  SymbolEntry,
  Diagnostic,
} from '../domain/models';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Collect every identifier name that appears in the expression tree. */
function collectIdentifiers(expr: ExprNode, out: Set<string>): void {
  switch (expr.tag) {
    case 'identifier':
      out.add(expr.name);
      break;
    case 'not':
      collectIdentifiers(expr.operand, out);
      break;
    case 'and':
    case 'or':
      collectIdentifiers(expr.left, out);
      collectIdentifiers(expr.right, out);
      break;
  }
}

// ------------------------------------------------------------------
// Main analysis function
// ------------------------------------------------------------------

export interface SemanticAnalysisResult {
  symbols: Map<string, SymbolEntry>;
  undefinedReferences: string[];
  unusedVariables: string[];
  diagnostics: Diagnostic[];
}

/**
 * Analyse a list of parsed equations and produce a symbol table plus
 * any semantic diagnostics.
 */
export function analyzeSemantics(equations: Equation[]): SemanticAnalysisResult {
  const symbols = new Map<string, SymbolEntry>();
  const diagnostics: Diagnostic[] = [];

  // ── Pass 1: register all definitions (LHS targets) ─────────

  for (const eq of equations) {
    const existing = symbols.get(eq.target);
    if (existing) {
      // Duplicate assignment target
      diagnostics.push({
        severity: 'warning',
        code: 'DUPLICATE_TARGET',
        message: `'${eq.target}' is assigned more than once. First definition is at line ${existing.definedBy?.loc.line ?? '?'}.`,
        loc: eq.loc,
      });
      // Keep the first definition; additional ones are still recorded.
    } else {
      symbols.set(eq.target, {
        name: eq.target,
        definedBy: eq,
        referencedBy: [],
        isExternalInput: false,
        isUnreferenced: true, // presumed unused until we see a reference
      });
    }
  }

  // ── Pass 2: record all RHS references ──────────────────────

  for (const eq of equations) {
    const referencedNames = new Set<string>();
    collectIdentifiers(eq.expr, referencedNames);

    for (const name of referencedNames) {
      let entry = symbols.get(name);
      if (!entry) {
        // First time we see this symbol — create an entry for an external input.
        entry = {
          name,
          definedBy: null,
          referencedBy: [],
          isExternalInput: true,
          isUnreferenced: false,
        };
        symbols.set(name, entry);
      }
      entry.referencedBy.push(eq);
    }
  }

  // ── Pass 3: mark which defined symbols are referenced ──────

  for (const entry of symbols.values()) {
    if (!entry.isExternalInput) {
      // A defined symbol is "unreferenced" if no equation uses it in its RHS.
      entry.isUnreferenced = entry.referencedBy.length === 0;
    }
  }

  // ── Pass 4: emit diagnostics ────────────────────────────────

  const undefinedReferences: string[] = [];
  const unusedVariables: string[] = [];

  for (const entry of symbols.values()) {
    if (entry.isExternalInput) {
      undefinedReferences.push(entry.name);
      diagnostics.push({
        severity: 'warning',
        code: 'UNDEFINED_REF',
        message: `'${entry.name}' is used but never defined in this document. It will be treated as an external input.`,
      });
    }

    if (entry.isUnreferenced && !entry.isExternalInput) {
      unusedVariables.push(entry.name);
      diagnostics.push({
        severity: 'info',
        code: 'UNUSED_VAR',
        message: `'${entry.name}' is defined but never referenced by another equation. It may be a top-level output or an unused variable.`,
        loc: entry.definedBy?.loc,
      });
    }
  }

  return { symbols, undefinedReferences, unusedVariables, diagnostics };
}

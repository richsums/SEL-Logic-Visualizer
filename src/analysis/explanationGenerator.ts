// ============================================================
// English explanation generator
//
// Produces a human-readable English description of the logic
// for a selected output variable, recursively expanding
// intermediate variables up to a configurable depth limit.
// ============================================================

import type { ExprNode, SymbolEntry } from '../domain/models';

const MAX_EXPANSION_DEPTH = 4;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Convert an expression node into an English phrase.
 * When `symbols` is provided and `depth` allows, intermediate
 * identifiers are recursively expanded inline.
 */
function exprToEnglish(
  expr: ExprNode,
  symbols: Map<string, SymbolEntry>,
  depth: number
): string {
  switch (expr.tag) {
    case 'identifier': {
      const entry = symbols.get(expr.name);
      if (
        entry &&
        !entry.isExternalInput &&
        entry.definedBy &&
        depth < MAX_EXPANSION_DEPTH
      ) {
        // Expand inline with parentheses
        const inner = exprToEnglish(entry.definedBy.expr, symbols, depth + 1);
        return `${expr.name} (${inner})`;
      }
      return expr.name;
    }

    case 'not': {
      if (expr.operand.tag === 'identifier') {
        return `${expr.operand.name} is false`;
      }
      return `NOT (${exprToEnglish(expr.operand, symbols, depth)})`;
    }

    case 'and': {
      const terms = flattenAnd(expr).map(t => exprToEnglish(t, symbols, depth));
      return terms.join(' AND ');
    }

    case 'or': {
      const terms = flattenOr(expr).map(t => exprToEnglish(t, symbols, depth));
      return terms.join(' OR ');
    }
  }
}

/** Flatten a nested binary AND tree into a flat list of operands. */
function flattenAnd(expr: ExprNode): ExprNode[] {
  if (expr.tag === 'and') {
    return [...flattenAnd(expr.left), ...flattenAnd(expr.right)];
  }
  return [expr];
}

/** Flatten a nested binary OR tree into a flat list of operands. */
function flattenOr(expr: ExprNode): ExprNode[] {
  if (expr.tag === 'or') {
    return [...flattenOr(expr.left), ...flattenOr(expr.right)];
  }
  return [expr];
}

// ------------------------------------------------------------------
// Top-level clause builder
// ------------------------------------------------------------------

/**
 * Describe a single equation in plain English, then append a sentence
 * for each directly-referenced intermediate variable (one level deep).
 */
function describeEquation(
  symbolName: string,
  symbols: Map<string, SymbolEntry>
): string {
  const entry = symbols.get(symbolName);
  if (!entry || !entry.definedBy) {
    return `${symbolName} is an external input with no definition in this document.`;
  }

  const eq = entry.definedBy;
  const sentences: string[] = [];

  // Main sentence
  const topClause = exprToEnglish(eq.expr, symbols, 0);
  sentences.push(`${symbolName} asserts when: ${topClause}.`);

  // Expand any directly-referenced intermediate variables by one more level
  const directRefs = new Set<string>();
  collectDirectIdentifiers(eq.expr, directRefs);

  for (const ref of directRefs) {
    const refEntry = symbols.get(ref);
    if (refEntry && !refEntry.isExternalInput && refEntry.definedBy) {
      const refClause = exprToEnglish(refEntry.definedBy.expr, symbols, 1);
      sentences.push(`${ref} asserts when: ${refClause}.`);
    }
  }

  return sentences.join('\n');
}

function collectDirectIdentifiers(expr: ExprNode, out: Set<string>): void {
  switch (expr.tag) {
    case 'identifier': out.add(expr.name); break;
    case 'not': collectDirectIdentifiers(expr.operand, out); break;
    case 'and':
    case 'or':
      collectDirectIdentifiers(expr.left, out);
      collectDirectIdentifiers(expr.right, out);
      break;
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export interface EnglishExplanationResult {
  target: string;
  text: string;
}

/**
 * Generate a plain-English explanation for the given symbol.
 */
export function generateExplanation(
  symbolName: string,
  symbols: Map<string, SymbolEntry>
): EnglishExplanationResult {
  const text = describeEquation(symbolName, symbols);
  return { target: symbolName, text };
}

// ============================================================
// React Flow graph builder
//
// Converts the GateGraph IR + layout positions into the
// React Flow Node and Edge arrays used for rendering.
//
// This module is the ONLY place that knows about React Flow
// data structures; all upstream code is framework-agnostic.
// ============================================================

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { GateGraph, SymbolEntry } from '../domain/models';
import { computeLayout } from './layoutEngine';

// ------------------------------------------------------------------
// Custom node data shapes
// ------------------------------------------------------------------

export interface SignalNodeData extends Record<string, unknown> {
  label: string;
  symbolName: string;
  isExternalInput: boolean;
  isOutput: boolean;
  equationText?: string;
  lineNumber?: number;
  rawSource?: string;
  highlighted: boolean;
}

export interface GateNodeData extends Record<string, unknown> {
  gateType: 'AND' | 'OR' | 'NOT';
  equationTarget?: string;
  lineNumber?: number;
  rawSource?: string;
  highlighted: boolean;
}

export type FlowNodeData = SignalNodeData | GateNodeData;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function edgeId(sourceId: string, targetId: string): string {
  return `edge_${sourceId}__${targetId}`;
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export interface FlowGraph {
  nodes: RFNode[];
  edges: RFEdge[];
}

/**
 * Build React Flow nodes and edges from the gate graph.
 *
 * @param highlightedNodeIds  Optional set of node IDs to render highlighted.
 *                            Pass `undefined` for no highlighting.
 */
export function buildFlowGraph(
  graph: GateGraph,
  symbols: Map<string, SymbolEntry>,
  highlightedNodeIds?: Set<string>
): FlowGraph {
  const layout = computeLayout(graph);
  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  // ── Build React Flow nodes ─────────────────────────────────

  for (const irNode of graph.nodes.values()) {
    const pos = layout.get(irNode.id) ?? { x: 0, y: 0, width: 150, height: 44 };
    const highlighted = highlightedNodeIds ? highlightedNodeIds.has(irNode.id) : false;

    if (irNode.gateType === 'SIGNAL') {
      const symbolName = irNode.symbolName ?? irNode.label;
      const entry = symbols.get(symbolName);
      const isExternalInput = entry?.isExternalInput ?? false;
      const isOutput = entry ? (entry.isUnreferenced && !entry.isExternalInput) : false;
      const eq = entry?.definedBy;

      const data: SignalNodeData = {
        label: symbolName,
        symbolName,
        isExternalInput,
        isOutput,
        equationText: eq ? `${eq.target} = ${rawExprText(eq.expr)}` : undefined,
        lineNumber: eq?.loc.line,
        rawSource: eq?.loc.rawSource,
        highlighted,
      };

      rfNodes.push({
        id: irNode.id,
        type: 'signalNode',
        position: { x: pos.x, y: pos.y },
        data,
        style: { width: pos.width, height: pos.height },
      });
    } else {
      const data: GateNodeData = {
        gateType: irNode.gateType as 'AND' | 'OR' | 'NOT',
        equationTarget: irNode.id.split('_')[1], // extract equation target from ID
        lineNumber: irNode.loc?.line,
        rawSource: irNode.loc?.rawSource,
        highlighted,
      };

      rfNodes.push({
        id: irNode.id,
        type: 'gateNode',
        position: { x: pos.x, y: pos.y },
        data,
        style: { width: pos.width, height: pos.height },
      });
    }
  }

  // ── Build React Flow edges ─────────────────────────────────

  for (const irNode of graph.nodes.values()) {
    for (const inputId of irNode.inputs) {
      const id = edgeId(inputId, irNode.id);
      const isHighlighted =
        highlightedNodeIds
          ? highlightedNodeIds.has(inputId) && highlightedNodeIds.has(irNode.id)
          : false;

      rfEdges.push({
        id,
        source: inputId,
        target: irNode.id,
        type: 'smoothstep',
        animated: isHighlighted,
        style: {
          stroke: isHighlighted ? '#f97316' : '#94a3b8',
          strokeWidth: isHighlighted ? 2.5 : 1.5,
        },
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

// ------------------------------------------------------------------
// Utility: reconstruct a compact expression string from an AST
// (used for the equationText field in node data)
// ------------------------------------------------------------------

import type { ExprNode } from '../domain/models';

function rawExprText(expr: ExprNode): string {
  switch (expr.tag) {
    case 'identifier': return expr.name;
    case 'not': return `!${rawExprText(expr.operand)}`;
    case 'and': {
      const l = needsParens(expr.left,  'and') ? `(${rawExprText(expr.left)})`  : rawExprText(expr.left);
      const r = needsParens(expr.right, 'and') ? `(${rawExprText(expr.right)})` : rawExprText(expr.right);
      return `${l} * ${r}`;
    }
    case 'or': {
      const l = rawExprText(expr.left);
      const r = rawExprText(expr.right);
      return `${l} + ${r}`;
    }
  }
}

function needsParens(expr: ExprNode, parentOp: 'and' | 'or'): boolean {
  if (parentOp === 'and' && expr.tag === 'or') return true;
  return false;
}

// ============================================================
// React Flow graph builder — supports simulation, diff, and tags
// ============================================================
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type {
  GateGraph, SymbolEntry, SimulationResult, NodeTags, DiffStatus, ExprNode,
} from '../domain/models';
import { computeLayout } from './layoutEngine';

export interface SignalNodeData extends Record<string, unknown> {
  label: string; symbolName: string; isExternalInput: boolean; isOutput: boolean;
  equationText?: string; lineNumber?: number; rawSource?: string; highlighted: boolean;
  simulationValue?: boolean | null; diffStatus?: DiffStatus; tags?: string[];
}
export interface GateNodeData extends Record<string, unknown> {
  gateType: 'AND' | 'OR' | 'NOT'; equationTarget?: string; lineNumber?: number;
  rawSource?: string; highlighted: boolean; simulationValue?: boolean | null;
}
export type FlowNodeData = SignalNodeData | GateNodeData;

export interface FlowGraphOptions {
  highlightedNodeIds?: Set<string>;
  simulationResult?: SimulationResult;
  diffStatusMap?: Map<string, DiffStatus>;
  nodeTags?: NodeTags;
}
export interface FlowGraph { nodes: RFNode[]; edges: RFEdge[]; }

function edgeId(src: string, tgt: string) { return `edge_${src}__${tgt}`; }

function rawExprText(expr: ExprNode): string {
  switch (expr.tag) {
    case 'identifier': return expr.name;
    case 'not': return `!${rawExprText(expr.operand)}`;
    case 'and': {
      const l = expr.left.tag  === 'or' ? `(${rawExprText(expr.left)})`  : rawExprText(expr.left);
      const r = expr.right.tag === 'or' ? `(${rawExprText(expr.right)})` : rawExprText(expr.right);
      return `${l} * ${r}`;
    }
    case 'or': return `${rawExprText(expr.left)} + ${rawExprText(expr.right)}`;
  }
}

function inferGateValue(gateId: string, graph: GateGraph, sim: SimulationResult): boolean | null | undefined {
  const node = graph.nodes.get(gateId);
  if (!node) return undefined;
  const inputVals = node.inputs.map(id => getNodeSimValue(id, graph, sim));
  switch (node.gateType) {
    case 'NOT': { const v = inputVals[0]; return v == null ? null : (v === undefined ? undefined : !v); }
    case 'AND': {
      if (inputVals.some(v => v === false)) return false;
      if (inputVals.some(v => v == null))  return null;
      if (inputVals.some(v => v === undefined)) return undefined;
      return true;
    }
    case 'OR': {
      if (inputVals.some(v => v === true))  return true;
      if (inputVals.some(v => v == null))   return null;
      if (inputVals.some(v => v === undefined)) return undefined;
      return false;
    }
    default: return undefined;
  }
}

function getNodeSimValue(nodeId: string, graph: GateGraph, sim: SimulationResult): boolean | null | undefined {
  const node = graph.nodes.get(nodeId);
  if (!node) return undefined;
  if (node.gateType === 'SIGNAL' && node.symbolName) return sim.values.get(node.symbolName) ?? false;
  return inferGateValue(nodeId, graph, sim);
}

export function buildFlowGraph(
  graph: GateGraph, symbols: Map<string, SymbolEntry>, options: FlowGraphOptions = {}
): FlowGraph {
  const { highlightedNodeIds, simulationResult, diffStatusMap, nodeTags } = options;
  const layout = computeLayout(graph);
  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  for (const irNode of graph.nodes.values()) {
    const pos = layout.get(irNode.id) ?? { x: 0, y: 0, width: 150, height: 44 };
    const highlighted = highlightedNodeIds?.has(irNode.id) ?? false;

    if (irNode.gateType === 'SIGNAL') {
      const symName = irNode.symbolName ?? irNode.label;
      const entry = symbols.get(symName);
      const eq = entry?.definedBy;
      const data: SignalNodeData = {
        label: symName, symbolName: symName,
        isExternalInput: entry?.isExternalInput ?? false,
        isOutput: !!(entry?.isUnreferenced && !entry.isExternalInput),
        equationText: eq ? `${eq.target} = ${rawExprText(eq.expr)}` : undefined,
        lineNumber: eq?.loc.line, rawSource: eq?.loc.rawSource,
        highlighted,
        simulationValue: simulationResult ? (simulationResult.values.get(symName) ?? false) : undefined,
        diffStatus: diffStatusMap?.get(symName),
        tags: nodeTags?.get(symName)?.map(t => t as string),
      };
      rfNodes.push({ id: irNode.id, type: 'signalNode', position: { x: pos.x, y: pos.y }, data, style: { width: pos.width, height: pos.height } });
    } else {
      const data: GateNodeData = {
        gateType: irNode.gateType as 'AND' | 'OR' | 'NOT',
        equationTarget: irNode.id.split('_')[1],
        lineNumber: irNode.loc?.line, rawSource: irNode.loc?.rawSource,
        highlighted,
        simulationValue: simulationResult ? inferGateValue(irNode.id, graph, simulationResult) : undefined,
      };
      rfNodes.push({ id: irNode.id, type: 'gateNode', position: { x: pos.x, y: pos.y }, data, style: { width: pos.width, height: pos.height } });
    }
  }

  for (const irNode of graph.nodes.values()) {
    for (const inputId of irNode.inputs) {
      const isHl = !!(highlightedNodeIds?.has(inputId) && highlightedNodeIds?.has(irNode.id));
      let strokeColor = isHl ? '#f97316' : '#94a3b8';
      let strokeWidth = isHl ? 2.5 : 1.5;
      if (simulationResult) {
        const v = getNodeSimValue(inputId, graph, simulationResult);
        if (v === true)  { strokeColor = '#16a34a'; strokeWidth = 2; }
        if (v === false) { strokeColor = '#ef4444'; strokeWidth = 1.5; }
        if (v === null)  { strokeColor = '#94a3b8'; }
      }
      rfEdges.push({
        id: edgeId(inputId, irNode.id), source: inputId, target: irNode.id,
        type: 'smoothstep', animated: isHl && !simulationResult,
        style: { stroke: strokeColor, strokeWidth },
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

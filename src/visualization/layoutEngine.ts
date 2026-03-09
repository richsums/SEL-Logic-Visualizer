// ============================================================
// Layout engine: assign (x, y) positions to gate-graph nodes
//
// Algorithm: longest-path rank assignment (left-to-right)
//
//   Rank 0 = sources (nodes with no inputs)
//   Rank N = max(rank of all inputs) + 1
//
// Within each rank, nodes are ordered by the median rank of their
// outputs (parents in the graph) to reduce edge crossings.
// Positions are then assigned left-to-right, top-to-bottom.
// ============================================================

import type { GateGraph } from '../domain/models';

// ------------------------------------------------------------------
// Layout constants
// ------------------------------------------------------------------

export const SIGNAL_NODE_WIDTH  = 150;
export const SIGNAL_NODE_HEIGHT = 44;
export const GATE_NODE_WIDTH    = 80;
export const GATE_NODE_HEIGHT   = 44;
export const H_GAP = 80;   // horizontal gap between ranks
export const V_GAP = 24;   // vertical gap between nodes in same rank

/** The x-width of a node (used to compute column x positions). */
function nodeWidth(gateType: string): number {
  return gateType === 'SIGNAL' ? SIGNAL_NODE_WIDTH : GATE_NODE_WIDTH;
}

// ------------------------------------------------------------------
// Rank assignment
// ------------------------------------------------------------------

function assignRanks(graph: GateGraph): Map<string, number> {
  const ranks = new Map<string, number>();

  // Iterative longest-path: process nodes in topological order.
  // We use a simple Kahn-style approach: repeatedly pick nodes whose
  // all inputs have been ranked.

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // node → nodes that have it as input

  for (const node of graph.nodes.values()) {
    inDegree.set(node.id, node.inputs.length);
    for (const inputId of node.inputs) {
      if (!dependents.has(inputId)) dependents.set(inputId, []);
      dependents.get(inputId)!.push(node.id);
    }
  }

  // Seeds: nodes with no inputs
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      ranks.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const rank = ranks.get(id) ?? 0;

    for (const depId of dependents.get(id) ?? []) {
      const current = ranks.get(depId) ?? 0;
      ranks.set(depId, Math.max(current, rank + 1));

      // Decrement in-degree; schedule when all inputs processed
      const deg = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, deg);
      if (deg === 0) queue.push(depId);
    }
  }

  // Any nodes not yet ranked (e.g. in a cycle) get rank 0
  for (const id of graph.nodes.keys()) {
    if (!ranks.has(id)) ranks.set(id, 0);
  }

  return ranks;
}

// ------------------------------------------------------------------
// Public: compute layout positions
// ------------------------------------------------------------------

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeLayout(graph: GateGraph): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();
  if (graph.nodes.size === 0) return positions;

  // 1. Assign ranks
  const ranks = assignRanks(graph);

  // 2. Group nodes by rank
  const rankGroups = new Map<number, string[]>();
  for (const [id, rank] of ranks) {
    if (!rankGroups.has(rank)) rankGroups.set(rank, []);
    rankGroups.get(rank)!.push(id);
  }

  // 3. Order nodes within each rank by median output rank
  //    This reduces edge crossings in a single pass.
  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);

  // Build reverse map: id → ids of nodes that depend on it
  const consumers = new Map<string, string[]>();
  for (const node of graph.nodes.values()) {
    for (const inputId of node.inputs) {
      if (!consumers.has(inputId)) consumers.set(inputId, []);
      consumers.get(inputId)!.push(node.id);
    }
  }

  const medianOutputRank = (id: string): number => {
    const consumerIds = consumers.get(id) ?? [];
    if (consumerIds.length === 0) return Infinity;
    const consumerRanks = consumerIds.map(cid => ranks.get(cid) ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(consumerRanks.length / 2);
    return consumerRanks[mid];
  };

  for (const rank of sortedRanks) {
    rankGroups.get(rank)!.sort((a, b) => medianOutputRank(a) - medianOutputRank(b));
  }

  // 4. Compute x positions per rank (accounting for node widths)
  //    x_rank = sum of (maxNodeWidth + H_GAP) for all previous ranks
  const rankX = new Map<number, number>();
  let xCursor = 0;
  for (const rank of sortedRanks) {
    rankX.set(rank, xCursor);
    const maxW = Math.max(
      ...rankGroups.get(rank)!.map(id => nodeWidth(graph.nodes.get(id)!.gateType))
    );
    xCursor += maxW + H_GAP;
  }

  // 5. Assign y positions within each rank
  for (const rank of sortedRanks) {
    const nodesInRank = rankGroups.get(rank)!;
    const totalHeight =
      nodesInRank.length * SIGNAL_NODE_HEIGHT +
      (nodesInRank.length - 1) * V_GAP;
    const startY = -totalHeight / 2;

    nodesInRank.forEach((id, idx) => {
      const node = graph.nodes.get(id)!;
      const w = nodeWidth(node.gateType);
      const h = SIGNAL_NODE_HEIGHT;
      const x = rankX.get(rank)!;
      const y = startY + idx * (SIGNAL_NODE_HEIGHT + V_GAP);
      positions.set(id, { x, y, width: w, height: h });
    });
  }

  return positions;
}

// ============================================================
// DiagramPane: renders the interactive React Flow gate diagram
// ============================================================

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SignalNode from './nodeTypes/SignalNode';
import GateNode   from './nodeTypes/GateNode';

import type { GateGraph, SymbolEntry }   from '../../domain/models';
import { buildFlowGraph }                from '../../visualization/flowBuilder';
import { traceUpstream }                 from '../../analysis/graphBuilder';
import type { SignalNodeData, GateNodeData } from '../../visualization/flowBuilder';

// ------------------------------------------------------------------
// Register custom node types (stable reference — defined outside component)
// ------------------------------------------------------------------

const NODE_TYPES = {
  signalNode: SignalNode,
  gateNode:   GateNode,
} as const;

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface DiagramPaneProps {
  gateGraph:   GateGraph | null;
  symbols:     Map<string, SymbolEntry>;
  onNodeClick: (nodeId: string) => void;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function DiagramPane({
  gateGraph,
  symbols,
  onNodeClick,
}: DiagramPaneProps) {
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | undefined>(undefined);

  // Build base flow data whenever the graph changes
  const baseFlow = useMemo(() => {
    if (!gateGraph) return { nodes: [], edges: [] };
    return buildFlowGraph(gateGraph, symbols, highlightedIds);
  }, [gateGraph, symbols, highlightedIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseFlow.edges);

  // Sync nodes/edges when base flow changes
  useEffect(() => {
    setNodes(baseFlow.nodes);
    setEdges(baseFlow.edges);
  }, [baseFlow, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      onNodeClick(node.id);

      if (!gateGraph) return;

      // Highlight all upstream nodes from clicked node
      const upstream = traceUpstream(node.id, gateGraph);
      setHighlightedIds(upstream);
    },
    [gateGraph, onNodeClick]
  );

  const handlePaneClick = useCallback(() => {
    setHighlightedIds(undefined);
    onNodeClick('');
  }, [onNodeClick]);

  if (!gateGraph || gateGraph.nodes.size === 0) {
    return (
      <div style={emptyStyle}>
        <div style={emptyInner}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          <p style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>
            Paste SEL logic in the left panel to see the diagram.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={miniMapColor}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
      </ReactFlow>

      {/* Legend */}
      <div style={legendStyle}>
        <LegendItem color="#16a34a" label="External input" />
        <LegendItem color="#2563eb" label="Intermediate" />
        <LegendItem color="#ea580c" label="Output" />
        <LegendItem color="#ca8a04" label="AND" />
        <LegendItem color="#db2777" label="OR" />
        <LegendItem color="#9333ea" label="NOT" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// MiniMap color helper
// ------------------------------------------------------------------

function miniMapColor(node: RFNode): string {
  const d = node.data as Partial<SignalNodeData & GateNodeData>;
  if (d.gateType === 'AND') return '#ca8a04';
  if (d.gateType === 'OR')  return '#db2777';
  if (d.gateType === 'NOT') return '#9333ea';
  if ((d as SignalNodeData).isExternalInput) return '#16a34a';
  if ((d as SignalNodeData).isOutput)        return '#ea580c';
  return '#2563eb';
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const emptyStyle: React.CSSProperties = {
  width:          '100%',
  height:         '100%',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     '#f8fafc',
};

const emptyInner: React.CSSProperties = {
  textAlign: 'center',
  maxWidth:  300,
};

const legendStyle: React.CSSProperties = {
  position:       'absolute',
  bottom:         16,
  left:           16,
  display:        'flex',
  flexWrap:       'wrap',
  gap:            10,
  background:     'rgba(255,255,255,0.9)',
  border:         '1px solid #e2e8f0',
  borderRadius:   8,
  padding:        '8px 12px',
  backdropFilter: 'blur(4px)',
  zIndex:         10,
};

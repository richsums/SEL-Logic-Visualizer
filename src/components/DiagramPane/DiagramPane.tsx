// ============================================================
// DiagramPane — interactive React Flow gate diagram
// Supports: visualize / simulate / compare modes, PNG/SVG export,
//           upstream & downstream tracing, node click callbacks.
// ============================================================
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Controls, MiniMap, Background, BackgroundVariant,
  useNodesState, useEdgesState, useReactFlow, getNodesBounds, getViewportForBounds,
  type Node as RFNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';

import SignalNode from './nodeTypes/SignalNode';
import GateNode   from './nodeTypes/GateNode';

import type {
  GateGraph, SymbolEntry, SimulationResult, NodeTags, RevisionDiff, AppMode,
} from '../../domain/models';
import { buildFlowGraph, type SignalNodeData, type GateNodeData } from '../../visualization/flowBuilder';
import { traceUpstream } from '../../analysis/graphBuilder';
import type { DiffStatus } from '../../domain/models';

// ── Stable node types reference ───────────────────────────────
const NODE_TYPES = { signalNode: SignalNode, gateNode: GateNode } as const;

interface Props {
  gateGraph:        GateGraph | null;
  symbols:          Map<string, SymbolEntry>;
  mode:             AppMode;
  simulationResult: SimulationResult | null;
  revisionDiff:     RevisionDiff | null;
  nodeTags:         NodeTags;
  onNodeClick:      (nodeId: string) => void;
}

// ── Export dimensions ─────────────────────────────────────────
const EXP_W = 2400, EXP_H = 1600;

function Exporter({ gateGraph }: { gateGraph: GateGraph | null }) {
  const { getNodes } = useReactFlow();

  const exportPng = useCallback(async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return;
    const bounds = getNodesBounds(getNodes());
    const transform = getViewportForBounds(bounds, EXP_W, EXP_H, 0.5, 2, 0.1);
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#f8fafc', width: EXP_W, height: EXP_H,
        style: { width: `${EXP_W}px`, height: `${EXP_H}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` },
      });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'sel-logic-diagram.png'; a.click();
    } catch (e) { console.error('PNG export failed', e); }
  }, [getNodes]);

  const exportSvg = useCallback(async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return;
    const bounds = getNodesBounds(getNodes());
    const transform = getViewportForBounds(bounds, EXP_W, EXP_H, 0.5, 2, 0.1);
    try {
      const dataUrl = await toSvg(viewport, {
        backgroundColor: '#f8fafc', width: EXP_W, height: EXP_H,
        style: { width: `${EXP_W}px`, height: `${EXP_H}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` },
      });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'sel-logic-diagram.svg'; a.click();
    } catch (e) { console.error('SVG export failed', e); }
  }, [getNodes]);

  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6 }}>
      <button onClick={exportPng} style={exportBtnStyle} title="Export PNG">↓ PNG</button>
      <button onClick={exportSvg} style={exportBtnStyle} title="Export SVG">↓ SVG</button>
    </div>
  );
}

export default function DiagramPane({ gateGraph, symbols, mode, simulationResult, revisionDiff, nodeTags, onNodeClick }: Props) {
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | undefined>(undefined);

  // Build diffStatusMap from revisionDiff
  const diffStatusMap = useMemo<Map<string, DiffStatus> | undefined>(() => {
    if (!revisionDiff) return undefined;
    const m = new Map<string, DiffStatus>();
    for (const d of revisionDiff.equations) m.set(d.target, d.status);
    return m;
  }, [revisionDiff]);

  const baseFlow = useMemo(() => {
    if (!gateGraph) return { nodes: [], edges: [] };
    return buildFlowGraph(gateGraph, symbols, {
      highlightedNodeIds: highlightedIds,
      simulationResult:   simulationResult ?? undefined,
      diffStatusMap,
      nodeTags,
    });
  }, [gateGraph, symbols, highlightedIds, simulationResult, diffStatusMap, nodeTags]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseFlow.edges);

  useEffect(() => { setNodes(baseFlow.nodes); }, [baseFlow.nodes, setNodes]);
  useEffect(() => { setEdges(baseFlow.edges); }, [baseFlow.edges, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    onNodeClick(node.id);
    if (!gateGraph) return;
    const upstream = traceUpstream(node.id, gateGraph);
    setHighlightedIds(upstream);
  }, [gateGraph, onNodeClick]);

  const handlePaneClick = useCallback(() => {
    setHighlightedIds(undefined); onNodeClick('');
  }, [onNodeClick]);

  if (!gateGraph || gateGraph.nodes.size === 0) {
    return (
      <div style={emptyStyle}>
        <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', maxWidth: 280 }}>
          Paste SEL logic in the left panel to see the diagram.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick} onPaneClick={handlePaneClick}
        fitView fitViewOptions={{ padding: 0.2 }}
        minZoom={0.08} maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap nodeColor={miniMapColor} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Exporter gateGraph={gateGraph} />
      </ReactFlow>

      {/* Mode badge */}
      {mode !== 'visualize' && (
        <div style={{ ...modeBadge, background: mode === 'simulate' ? '#16a34a' : '#7c3aed' }}>
          {mode === 'simulate' ? '▶ Simulate' : '⇄ Compare'}
        </div>
      )}

      {/* Legend */}
      <div style={legendStyle}>
        {mode === 'compare' ? (
          <>
            <LegendItem color="#16a34a" label="Added" />
            <LegendItem color="#dc2626" label="Removed" />
            <LegendItem color="#d97706" label="Modified" />
            <LegendItem color="#94a3b8" label="Unchanged" />
          </>
        ) : (
          <>
            <LegendItem color="#16a34a" label="Input" />
            <LegendItem color="#2563eb" label="Intermediate" />
            <LegendItem color="#ea580c" label="Output" />
            <LegendItem color="#ca8a04" label="AND" />
            <LegendItem color="#db2777" label="OR" />
            <LegendItem color="#9333ea" label="NOT" />
            {mode === 'simulate' && <>
              <LegendItem color="#16a34a" label="TRUE edge" />
              <LegendItem color="#ef4444" label="FALSE edge" />
            </>}
          </>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
    </div>
  );
}

function miniMapColor(node: RFNode) {
  const d = node.data as Partial<SignalNodeData & GateNodeData>;
  if (d.gateType === 'AND') return '#ca8a04';
  if (d.gateType === 'OR')  return '#db2777';
  if (d.gateType === 'NOT') return '#9333ea';
  if ((d as SignalNodeData).isExternalInput) return '#16a34a';
  if ((d as SignalNodeData).isOutput)        return '#ea580c';
  return '#2563eb';
}

const emptyStyle: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: '#f8fafc',
};
const exportBtnStyle: React.CSSProperties = {
  fontSize: 11, padding: '4px 10px', background: '#fff',
  border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer',
  color: '#475569', fontWeight: 500, boxShadow: '0 1px 2px #0001',
};
const modeBadge: React.CSSProperties = {
  position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
  padding: '4px 14px', borderRadius: 20, color: '#fff',
  fontSize: 12, fontWeight: 600, zIndex: 10, pointerEvents: 'none',
};
const legendStyle: React.CSSProperties = {
  position: 'absolute', bottom: 16, left: 16,
  display: 'flex', flexWrap: 'wrap', gap: 10,
  background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '7px 12px', zIndex: 10,
};

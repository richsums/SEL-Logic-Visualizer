// ============================================================
// App: root component — three-panel layout
//
//   Left   : InputPane   (source text)
//   Center : DiagramPane (React Flow gate diagram)
//   Right  : DiagnosticsPane (errors, node detail, explanation)
//
// All analysis runs synchronously on every source change.
// For large documents this could be moved to a Web Worker.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import InputPane       from './InputPane/InputPane';
import DiagramPane     from './DiagramPane/DiagramPane';
import DiagnosticsPane from './DiagnosticsPane/DiagnosticsPane';

import { parseSource }  from '../parser';
import { runAnalysis }  from '../analysis';
import { buildGateGraph } from '../analysis/graphBuilder';

import type { AnalysisResult, GateGraph, SymbolEntry } from '../domain/models';

// ------------------------------------------------------------------
// Pipeline
// ------------------------------------------------------------------

interface PipelineResult {
  analysisResult: AnalysisResult;
  gateGraph:      GateGraph;
  symbols:        Map<string, SymbolEntry>;
}

function runPipeline(source: string): PipelineResult | null {
  if (!source.trim()) return null;

  const parseResult    = parseSource(source);
  const analysisResult = runAnalysis(parseResult.equations);

  // Merge parse diagnostics into analysis result
  const mergedDiags = [...parseResult.diagnostics, ...analysisResult.diagnostics];
  const merged: AnalysisResult = { ...analysisResult, diagnostics: mergedDiags };

  const gateGraph = buildGateGraph(parseResult.equations, analysisResult.symbols);

  return {
    analysisResult: merged,
    gateGraph,
    symbols: analysisResult.symbols,
  };
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function App() {
  const [source, setSource] = useState<string>(DEFAULT_SOURCE);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const pipeline = useMemo(() => runPipeline(source), [source]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  return (
    <div style={appStyle}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={topBarStyle}>
        <span style={logoStyle}>⚡ SEL Logic Visualizer</span>
        <span style={subtitleStyle}>
          Paste SEL relay logic equations to generate an interactive gate diagram
        </span>
        {pipeline && (
          <div style={statsStyle}>
            <StatBadge label="Equations" value={pipeline.analysisResult.symbols.size} />
            <StatBadge label="Errors" value={pipeline.analysisResult.diagnostics.filter(d => d.severity === 'error').length} color="#dc2626" />
          </div>
        )}
      </div>

      {/* ── Three-panel body ─────────────────────────────────── */}
      <div style={bodyStyle}>
        {/* Left: source */}
        <div style={leftPanelStyle}>
          <InputPane value={source} onChange={setSource} />
        </div>

        {/* Center: diagram */}
        <div style={centerPanelStyle}>
          <ReactFlowProvider>
            <DiagramPane
              gateGraph={pipeline?.gateGraph ?? null}
              symbols={pipeline?.symbols ?? new Map()}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        </div>

        {/* Right: diagnostics */}
        <div style={rightPanelStyle}>
          <DiagnosticsPane
            analysisResult={pipeline?.analysisResult ?? null}
            gateGraph={pipeline?.gateGraph ?? null}
            symbols={pipeline?.symbols ?? new Map()}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function StatBadge({
  label,
  value,
  color = '#475569',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const appStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  height:        '100vh',
  background:    '#f1f5f9',
  fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  overflow:      'hidden',
};

const topBarStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          12,
  padding:      '0 18px',
  height:       44,
  background:   '#0f172a',
  flexShrink:   0,
  borderBottom: '1px solid #1e293b',
};

const logoStyle: React.CSSProperties = {
  fontWeight:  700,
  fontSize:    15,
  color:       '#f8fafc',
  marginRight: 6,
  whiteSpace:  'nowrap',
};

const subtitleStyle: React.CSSProperties = {
  fontSize:    12,
  color:       '#64748b',
  flex:        1,
  overflow:    'hidden',
  textOverflow: 'ellipsis',
  whiteSpace:  'nowrap',
};

const statsStyle: React.CSSProperties = {
  display:     'flex',
  gap:         14,
  marginLeft:  'auto',
};

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flex:    1,
  overflow: 'hidden',
};

const leftPanelStyle: React.CSSProperties = {
  width:    '25%',
  minWidth: 220,
  maxWidth: 420,
  display:  'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const centerPanelStyle: React.CSSProperties = {
  flex:     1,
  position: 'relative',
  overflow: 'hidden',
};

const rightPanelStyle: React.CSSProperties = {
  width:    '26%',
  minWidth: 240,
  maxWidth: 440,
  display:  'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

// ------------------------------------------------------------------
// Default source
// ------------------------------------------------------------------

const DEFAULT_SOURCE = `; SEL Relay Logic — Protection Example
; Assignments: LHS = RHS
; Operators: * AND, + OR, ! NOT, () grouping

; Trip output
TRIP = SV01 + 87T + LOCKOUT

; Supervision element
SV01 = 50P1T * !52A + 51PT

; Alarm output
ALARM = !DC_OK + TRIP_FAIL + COMM_FAIL

; Lockout latch (set by 87T or 50H)
LOCKOUT = 87T + 50H1

; Block re-close
BLK_79 = LOCKOUT + !52A * 27PT
`;

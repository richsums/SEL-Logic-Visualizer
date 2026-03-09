// ============================================================
// App — root component
//
// Three panels: InputPane | DiagramPane | DiagnosticsPane
// Three modes:
//   visualize  – normal diagram + trace + explanation
//   simulate   – toggle inputs, watch live values propagate
//   compare    – diff two revisions side-by-side
//
// State:
//   source            primary logic text
//   compareSource     revision B for compare mode
//   mode              AppMode
//   nodeTags          Map<symbol, ProtectionTag[]>, persisted to localStorage
//   simulationInputs  Map<symbol, boolean>
//   selectedNodeId    currently clicked node
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import InputPane       from './InputPane/InputPane';
import DiagramPane     from './DiagramPane/DiagramPane';
import DiagnosticsPane from './DiagnosticsPane/DiagnosticsPane';

import { parseSource }    from '../parser';
import { runAnalysis }    from '../analysis';
import { buildGateGraph } from '../analysis/graphBuilder';
import { simulate }       from '../analysis/simulator';
import { diffRevisions }  from '../analysis/diffEngine';

import type {
  AnalysisResult, GateGraph, SymbolEntry, AppMode,
  NodeTags, ProtectionTag, SimulationResult, RevisionDiff,
} from '../domain/models';

// ── Pipeline helper ───────────────────────────────────────────
interface PipelineResult {
  analysisResult: AnalysisResult;
  gateGraph:      GateGraph;
  symbols:        Map<string, SymbolEntry>;
}

function runPipeline(source: string): PipelineResult | null {
  if (!source.trim()) return null;
  const parseResult    = parseSource(source);
  const analysisResult = runAnalysis(parseResult.equations);
  const merged: AnalysisResult = {
    ...analysisResult,
    diagnostics: [...parseResult.diagnostics, ...analysisResult.diagnostics],
  };
  const gateGraph = buildGateGraph(parseResult.equations, analysisResult.symbols);
  return { analysisResult: merged, gateGraph, symbols: analysisResult.symbols };
}

// ── localStorage helpers ──────────────────────────────────────
const TAGS_KEY = 'sel-lv:node-tags';

function loadTags(): NodeTags {
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, ProtectionTag[]][]);
  } catch { return new Map(); }
}

function saveTags(tags: NodeTags) {
  try { localStorage.setItem(TAGS_KEY, JSON.stringify([...tags.entries()])); } catch {}
}

// ── Component ─────────────────────────────────────────────────
export default function App() {
  const [source,          setSource]          = useState(DEFAULT_SOURCE);
  const [compareSource,   setCompareSource]   = useState('');
  const [mode,            setMode]            = useState<AppMode>('visualize');
  const [nodeTags,        setNodeTags]        = useState<NodeTags>(loadTags);
  const [simInputs,       setSimInputs]       = useState<Map<string, boolean>>(new Map());
  const [selectedNodeId,  setSelectedNodeId]  = useState('');

  // ── Primary pipeline ──────────────────────────────────────
  const primary = useMemo(() => runPipeline(source), [source]);

  // ── Simulate pipeline ─────────────────────────────────────
  const simResult = useMemo<SimulationResult | null>(() => {
    if (mode !== 'simulate' || !primary) return null;
    const eqs = [...primary.symbols.values()].filter(s => s.definedBy).map(s => s.definedBy!);
    return simulate(eqs, { enabled: true, inputValues: simInputs });
  }, [mode, primary, simInputs]);

  // ── Compare pipeline ─────────────────────────────────────
  const compareResult = useMemo(() => {
    if (mode !== 'compare' || !compareSource.trim()) return null;
    return runPipeline(compareSource);
  }, [mode, compareSource]);

  const revisionDiff = useMemo<RevisionDiff | null>(() => {
    if (mode !== 'compare' || !primary || !compareResult) return null;
    const eqsA = [...primary.symbols.values()].filter(s => s.definedBy).map(s => s.definedBy!);
    const eqsB = [...compareResult.symbols.values()].filter(s => s.definedBy).map(s => s.definedBy!);
    return diffRevisions(eqsA, eqsB);
  }, [mode, primary, compareResult]);

  // Use compare graph for diagram in compare mode
  const activeGraph   = (mode === 'compare' && compareResult) ? compareResult.gateGraph   : primary?.gateGraph   ?? null;
  const activeSymbols = (mode === 'compare' && compareResult) ? compareResult.symbols      : primary?.symbols     ?? new Map();
  const activeAnalysis = primary?.analysisResult ?? null;

  // ── Callbacks ─────────────────────────────────────────────
  const handleNodeClick = useCallback((id: string) => setSelectedNodeId(id), []);

  const handleTagChange = useCallback((sym: string, tags: ProtectionTag[]) => {
    setNodeTags(prev => {
      const next = new Map(prev);
      if (tags.length === 0) next.delete(sym); else next.set(sym, tags);
      saveTags(next);
      return next;
    });
  }, []);

  const handleToggleInput = useCallback((name: string, value: boolean) => {
    setSimInputs(prev => {
      const next = new Map(prev);
      next.set(name, value);
      return next;
    });
  }, []);

  const handleResetSim = useCallback(() => setSimInputs(new Map()), []);

  // ── Mode switch: clear sim inputs on leaving simulate ─────
  const switchMode = useCallback((m: AppMode) => {
    setMode(m);
    setSelectedNodeId('');
    if (m !== 'simulate') setSimInputs(new Map());
  }, []);

  // ── Stats bar ─────────────────────────────────────────────
  const errorCount   = activeAnalysis?.diagnostics.filter(d => d.severity === 'error').length ?? 0;
  const symbolCount  = activeAnalysis?.symbols.size ?? 0;

  return (
    <div style={appStyle}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={topBarStyle}>
        <span style={logoStyle}>⚡ SEL Logic Visualizer</span>

        {/* Mode switcher */}
        <div style={modeBarStyle}>
          {(['visualize', 'simulate', 'compare'] as AppMode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              ...modeBtnBase,
              background: mode === m ? '#2563eb' : 'transparent',
              color:      mode === m ? '#fff'    : '#94a3b8',
            }}>
              {m === 'visualize' ? '◉ Visualize' : m === 'simulate' ? '▶ Simulate' : '⇄ Compare'}
            </button>
          ))}
        </div>

        <div style={statsStyle}>
          {symbolCount > 0 && <StatBadge label="Symbols" value={symbolCount} />}
          {errorCount  > 0 && <StatBadge label="Errors" value={errorCount} color="#dc2626" />}
          {mode === 'compare' && revisionDiff && (
            <>
              <StatBadge label="Added"    value={revisionDiff.addedSymbols.length}    color="#16a34a" />
              <StatBadge label="Modified" value={revisionDiff.modifiedSymbols.length} color="#d97706" />
              <StatBadge label="Removed"  value={revisionDiff.removedSymbols.length}  color="#dc2626" />
            </>
          )}
          {mode === 'simulate' && simResult && (
            <StatBadge
              label="Asserted"
              value={[...simResult.values.values()].filter(v => v === true).length}
              color="#16a34a"
            />
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div style={bodyStyle}>

        {/* Left: source input */}
        <div style={leftPanelStyle}>
          {mode === 'compare' ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={revLabelStyle}>Revision A (current)</div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <InputPane value={source} onChange={setSource} />
                </div>
              </div>
              <div style={{ height: 1, background: '#334155' }} />
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={revLabelStyle}>Revision B (compare against)</div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <InputPane value={compareSource} onChange={setCompareSource} />
                </div>
              </div>
            </div>
          ) : (
            <InputPane value={source} onChange={setSource} />
          )}
        </div>

        {/* Center: diagram */}
        <div style={centerPanelStyle}>
          <ReactFlowProvider>
            <DiagramPane
              gateGraph={activeGraph}
              symbols={activeSymbols}
              mode={mode}
              simulationResult={simResult}
              revisionDiff={revisionDiff}
              nodeTags={nodeTags}
              onNodeClick={handleNodeClick}
            />
          </ReactFlowProvider>
        </div>

        {/* Right: analysis pane */}
        <div style={rightPanelStyle}>
          <DiagnosticsPane
            analysisResult={activeAnalysis}
            gateGraph={activeGraph}
            symbols={activeSymbols}
            selectedNodeId={selectedNodeId}
            mode={mode}
            nodeTags={nodeTags}
            onTagChange={handleTagChange}
            simulationResult={simResult}
            inputValues={simInputs}
            onToggleInput={handleToggleInput}
            onResetSim={handleResetSim}
            revisionDiff={revisionDiff}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────
function StatBadge({ label, value, color = '#94a3b8' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#475569' }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const appStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100vh',
  background: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  overflow: 'hidden',
};
const topBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
  height: 44, background: '#0f172a', flexShrink: 0, borderBottom: '1px solid #1e293b',
};
const logoStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, color: '#f8fafc', marginRight: 4, whiteSpace: 'nowrap' };
const modeBarStyle: React.CSSProperties = { display: 'flex', gap: 2, borderRadius: 8, border: '1px solid #334155', padding: 2 };
const modeBtnBase: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 6,
  border: 'none', cursor: 'pointer', transition: 'background 0.15s',
};
const statsStyle: React.CSSProperties = { display: 'flex', gap: 14, marginLeft: 'auto' };
const bodyStyle: React.CSSProperties = { display: 'flex', flex: 1, overflow: 'hidden' };
const leftPanelStyle: React.CSSProperties = { width: '24%', minWidth: 200, maxWidth: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const centerPanelStyle: React.CSSProperties = { flex: 1, position: 'relative', overflow: 'hidden' };
const rightPanelStyle: React.CSSProperties = { width: '27%', minWidth: 260, maxWidth: 460, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const revLabelStyle: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#94a3b8',
  background: '#1e293b', flexShrink: 0,
};

// ── Default source ─────────────────────────────────────────────
const DEFAULT_SOURCE = `; SEL Relay Logic — Protection Example
; Operators: * AND  + OR  ! NOT  () grouping
; Lines beginning with ; are comments

; ── Trip output ──────────────────────────────────────────────
TRIP = SV01 + 87T + LOCKOUT

; ── Supervised overcurrent ───────────────────────────────────
SV01 = 50P1T * !52A + 51PT

; ── Alarm ────────────────────────────────────────────────────
ALARM = !DC_OK + TRIP_FAIL + COMM_FAIL

; ── Lockout latch ─────────────────────────────────────────────
LOCKOUT = 87T + 50H1

; ── Reclose block ─────────────────────────────────────────────
BLK_79 = LOCKOUT + !52A * 27PT
`;

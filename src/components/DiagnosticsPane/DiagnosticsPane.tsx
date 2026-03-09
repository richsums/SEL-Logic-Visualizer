// ============================================================
// DiagnosticsPane — tabbed right-hand panel
//
// Tabs:
//   Diagnostics  – parse errors, semantic warnings, cycle alerts, unused vars
//   Analysis     – selected node detail, asserting paths, blocking conditions,
//                  English truth-path explanation
//   Tags         – assign protection-function tags to the selected signal
//   Simulate     – input toggles + computed values (simulate mode)
//   Compare      – revision diff summary (compare mode)
// ============================================================
import { useState } from 'react';
import type {
  AnalysisResult, GateGraph, SymbolEntry, Diagnostic, AppMode,
  AssertingPath, NodeTags, ProtectionTag, RevisionDiff, SimulationResult,
  BlockingCondition,
} from '../../domain/models';
import { PROTECTION_TAG_META } from '../../domain/models';
import type { SignalNodeData } from '../../visualization/flowBuilder';
import { generateExplanation } from '../../analysis/explanationGenerator';
import { findAssertingPaths, deriveBlockingConditions, generateTruthPathExplanation } from '../../analysis/pathFinder';
import SimulationPanel from '../SimulationPanel/SimulationPanel';

// ── Types ──────────────────────────────────────────────────────
type Tab = 'diagnostics' | 'analysis' | 'tags' | 'simulate' | 'compare';

interface Props {
  analysisResult:   AnalysisResult | null;
  gateGraph:        GateGraph | null;
  symbols:          Map<string, SymbolEntry>;
  selectedNodeId:   string;
  mode:             AppMode;
  nodeTags:         NodeTags;
  onTagChange:      (symbol: string, tags: ProtectionTag[]) => void;
  simulationResult: SimulationResult | null;
  inputValues:      Map<string, boolean>;
  onToggleInput:    (name: string, value: boolean) => void;
  onResetSim:       () => void;
  revisionDiff:     RevisionDiff | null;
}

// ── Tab button ─────────────────────────────────────────────────
function TabBtn({ id, label, active, badge, onClick }: {
  id: Tab; label: string; active: boolean; badge?: number; onClick: (t: Tab) => void;
}) {
  return (
    <button onClick={() => onClick(id)} style={{
      ...tabBtnBase,
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      color: active ? '#2563eb' : '#64748b', fontWeight: active ? 600 : 400,
    }}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span style={{
          marginLeft: 4, fontSize: 10, fontWeight: 700,
          background: '#dc2626', color: '#fff',
          borderRadius: 8, padding: '1px 5px',
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function DiagnosticsPane({
  analysisResult, gateGraph, symbols, selectedNodeId, mode,
  nodeTags, onTagChange, simulationResult, inputValues, onToggleInput,
  onResetSim, revisionDiff,
}: Props) {
  const defaultTab: Tab =
    mode === 'simulate' ? 'simulate' :
    mode === 'compare'  ? 'compare'  : 'diagnostics';
  const [tab, setTab] = useState<Tab>(defaultTab);

  const diagnostics = analysisResult?.diagnostics ?? [];
  const errorCount  = diagnostics.filter(d => d.severity === 'error').length;

  // ── Determine selected node ──────────────────────────────────
  const selectedNode = selectedNodeId ? gateGraph?.nodes.get(selectedNodeId) : undefined;
  const selectedSymbol = selectedNode?.gateType === 'SIGNAL' ? (selectedNode.symbolName ?? '') : '';
  const selectedEntry  = selectedSymbol ? symbols.get(selectedSymbol) : undefined;

  // ── Asserting paths for selected signal ──────────────────────
  const paths: AssertingPath[] = selectedEntry && !selectedEntry.isExternalInput && analysisResult
    ? findAssertingPaths(selectedSymbol, getEquationsFromSymbols(symbols), symbols, simulationResult ?? undefined)
    : [];

  const blockingConditions: BlockingCondition[] = deriveBlockingConditions(paths);

  // ── Tags for selected symbol ─────────────────────────────────
  const currentTags: ProtectionTag[] = selectedSymbol ? (nodeTags.get(selectedSymbol) ?? []) : [];

  const toggleTag = (tag: ProtectionTag) => {
    if (!selectedSymbol) return;
    const next = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    onTagChange(selectedSymbol, next);
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Analysis</span>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <TabBtn id="diagnostics" label="Issues"   active={tab==='diagnostics'} badge={errorCount} onClick={setTab} />
        <TabBtn id="analysis"    label="Analysis" active={tab==='analysis'}    onClick={setTab} />
        <TabBtn id="tags"        label="Tags"     active={tab==='tags'}        onClick={setTab} />
        <TabBtn id="simulate"    label="Simulate" active={tab==='simulate'}    onClick={setTab} />
        <TabBtn id="compare"     label="Compare"  active={tab==='compare'}     onClick={setTab} />
      </div>

      {/* Tab content */}
      <div style={scrollStyle}>

        {/* ── DIAGNOSTICS ──────────────────────────────────── */}
        {tab === 'diagnostics' && (
          <DiagnosticsTab diagnostics={diagnostics} analysisResult={analysisResult} />
        )}

        {/* ── ANALYSIS ─────────────────────────────────────── */}
        {tab === 'analysis' && (
          <AnalysisTab
            selectedNode={selectedNode ? { id: selectedNodeId, gateType: selectedNode.gateType, symbolName: selectedSymbol } : null}
            selectedEntry={selectedEntry ?? null}
            paths={paths}
            blockingConditions={blockingConditions}
            symbols={symbols}
            simulationResult={simulationResult}
          />
        )}

        {/* ── TAGS ─────────────────────────────────────────── */}
        {tab === 'tags' && (
          <TagsTab
            selectedSymbol={selectedSymbol}
            currentTags={currentTags}
            onToggleTag={toggleTag}
            nodeTags={nodeTags}
          />
        )}

        {/* ── SIMULATE ─────────────────────────────────────── */}
        {tab === 'simulate' && (
          <SimulationPanel
            symbols={symbols}
            inputValues={inputValues}
            simulationResult={simulationResult}
            onToggle={onToggleInput}
            onReset={onResetSim}
          />
        )}

        {/* ── COMPARE ──────────────────────────────────────── */}
        {tab === 'compare' && (
          <CompareTab diff={revisionDiff} />
        )}
      </div>
    </div>
  );
}

// ── Helper: extract equations from symbol table ───────────────
function getEquationsFromSymbols(symbols: Map<string, SymbolEntry>) {
  return [...symbols.values()].filter(s => s.definedBy).map(s => s.definedBy!);
}

// ── DIAGNOSTICS TAB ───────────────────────────────────────────
function DiagnosticsTab({ diagnostics, analysisResult }: {
  diagnostics: Diagnostic[]; analysisResult: AnalysisResult | null;
}) {
  const errors   = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warning');
  const infos    = diagnostics.filter(d => d.severity === 'info');

  return (
    <div>
      {diagnostics.length === 0
        ? <EmptyState icon="✓" color="#16a34a" message="No issues found." />
        : <>
            {errors.length   > 0 && <DiagSection title={`Errors (${errors.length})`}   color="#dc2626" items={errors} />}
            {warnings.length > 0 && <DiagSection title={`Warnings (${warnings.length})`} color="#d97706" items={warnings} />}
            {infos.length    > 0 && <DiagSection title={`Info (${infos.length})`}       color="#0284c7" items={infos} />}
          </>
      }
      {analysisResult && <SymbolSummary result={analysisResult} />}
    </div>
  );
}

function DiagSection({ title, color, items }: { title: string; color: string; items: Diagnostic[] }) {
  return (
    <div style={{ padding: '10px 14px 4px' }}>
      <div style={{ ...sectionTitle, color }}>{title}</div>
      {items.map((d, i) => (
        <div key={i} style={{ ...diagRow, borderLeftColor: color }}>
          {d.loc && <span style={diagLoc}>Line {d.loc.line}</span>}
          <span style={{ fontSize: 12, color: '#1e293b' }}>{d.message}</span>
          {d.detail && <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 2, fontFamily: 'monospace' }}>{d.detail}</span>}
        </div>
      ))}
    </div>
  );
}

function SymbolSummary({ result }: { result: AnalysisResult }) {
  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={divider} />
      <div style={sectionTitle}>Symbol Summary</div>
      <SymRow label="External inputs"      items={result.undefinedReferences} color="#16a34a" />
      <SymRow label="Unreferenced outputs" items={result.unusedVariables}     color="#ea580c" />
      {result.cycles.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
            Cycles ({result.cycles.length})
          </div>
          {result.cycles.map((c, i) => (
            <div key={i} style={cycleTag}>{c.join(' → ')}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SymRow({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.map(n => (
          <span key={n} style={{ ...tagStyle, background: color + '1a', color, borderColor: color + '60' }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

// ── ANALYSIS TAB ──────────────────────────────────────────────
function AnalysisTab({ selectedNode, selectedEntry, paths, blockingConditions, symbols, simulationResult }: {
  selectedNode: { id: string; gateType: string; symbolName: string } | null;
  selectedEntry: SymbolEntry | null;
  paths: AssertingPath[];
  blockingConditions: BlockingCondition[];
  symbols: Map<string, SymbolEntry>;
  simulationResult: SimulationResult | null;
}) {
  if (!selectedNode) {
    return <EmptyState icon="↖" color="#94a3b8" message="Click any node in the diagram to inspect it." />;
  }

  const isSignal = selectedNode.gateType === 'SIGNAL';
  const symName  = selectedNode.symbolName;

  // English explanation (simple one-level)
  const simpleExplanation = isSignal && selectedEntry && !selectedEntry.isExternalInput
    ? generateExplanation(symName, symbols).text
    : null;

  // Truth-path explanation (multi-path)
  const truthPathText = paths.length > 0
    ? generateTruthPathExplanation(symName, paths, simulationResult ?? undefined)
    : null;

  return (
    <div>
      {/* Node detail card */}
      <div style={{ padding: '10px 14px 0' }}>
        <div style={sectionTitle}>Selected Node</div>
        <div style={card}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            {symName || selectedNode.id}
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr><td style={dtStyle}>Type</td>
                <td style={ddStyle}>{isSignal
                  ? (selectedEntry?.isExternalInput ? 'External input' : selectedEntry?.isUnreferenced ? 'Output' : 'Intermediate signal')
                  : `${selectedNode.gateType} gate`}</td></tr>
              {isSignal && selectedEntry?.definedBy && <>
                <tr><td style={dtStyle}>Line</td><td style={ddStyle}>{selectedEntry.definedBy.loc.line}</td></tr>
                <tr><td style={dtStyle}>Source</td><td style={{...ddStyle, fontFamily:'monospace', fontSize:11}}>{selectedEntry.definedBy.loc.rawSource}</td></tr>
              </>}
              {simulationResult && isSignal && <tr>
                <td style={dtStyle}>Sim value</td>
                <td style={ddStyle}>
                  {(() => {
                    const v = simulationResult.values.get(symName);
                    return v === true ? '✓ TRUE' : v === false ? '✗ FALSE' : '? CYCLE';
                  })()}
                </td>
              </tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asserting paths */}
      {paths.length > 0 && (
        <div style={{ padding: '0 14px' }}>
          <div style={divider} />
          <div style={sectionTitle}>Asserting Paths ({paths.length})</div>
          {paths.map(p => (
            <div key={p.index} style={{
              ...diagRow, borderLeftColor:
                p.isActive === true ? '#16a34a' : p.isActive === false ? '#dc2626' : '#94a3b8',
            }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                Path {p.index}
                {p.isActive !== undefined && (
                  <span style={{ marginLeft: 6, color: p.isActive ? '#16a34a' : '#dc2626' }}>
                    {p.isActive ? '✓ active' : '✗ inactive'}
                  </span>
                )}
              </span>
              {p.conditions.asserted.length > 0 && (
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  <span style={{ color: '#16a34a' }}>Requires: </span>
                  <span style={{ fontFamily: 'monospace', color: '#1e293b' }}>{p.conditions.asserted.join(' AND ')}</span>
                </div>
              )}
              {p.conditions.negated.length > 0 && (
                <div style={{ fontSize: 11 }}>
                  <span style={{ color: '#dc2626' }}>Blocks: </span>
                  <span style={{ fontFamily: 'monospace', color: '#1e293b' }}>{p.conditions.negated.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Blocking conditions */}
      {blockingConditions.length > 0 && (
        <div style={{ padding: '0 14px' }}>
          <div style={divider} />
          <div style={sectionTitle}>Blocking Conditions</div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px' }}>
            These signals, if asserted, prevent the output from being driven by the listed paths.
          </p>
          {blockingConditions.map(bc => (
            <div key={bc.signal} style={{ ...diagRow, borderLeftColor: '#d97706' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{bc.signal}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}> blocks path(s): {bc.pathIndices.join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Truth-path explanation */}
      {truthPathText && (
        <div style={{ padding: '0 14px' }}>
          <div style={divider} />
          <div style={sectionTitle}>Truth-Path Explanation</div>
          <div style={explanationBox}>
            {truthPathText.split('\n').map((line, i) => (
              <p key={i} style={{ margin: '0 0 6px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Simple English description */}
      {simpleExplanation && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={divider} />
          <div style={sectionTitle}>English Description</div>
          <div style={explanationBox}>
            {simpleExplanation.split('\n').map((line, i) => (
              <p key={i} style={{ margin: '0 0 6px', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAGS TAB ──────────────────────────────────────────────────
function TagsTab({ selectedSymbol, currentTags, onToggleTag, nodeTags }: {
  selectedSymbol: string;
  currentTags: ProtectionTag[];
  onToggleTag: (t: ProtectionTag) => void;
  nodeTags: NodeTags;
}) {
  const ALL_TAGS: ProtectionTag[] = ['trip', 'block', 'supervise', 'alarm', 'reclose', 'other'];
  const taggedSymbols = [...nodeTags.entries()].filter(([, tags]) => tags.length > 0);

  return (
    <div style={{ padding: '10px 14px' }}>
      {!selectedSymbol ? (
        <EmptyState icon="🏷" color="#94a3b8" message="Click a signal node in the diagram to tag it." />
      ) : (
        <>
          <div style={sectionTitle}>Tag: <span style={{ fontFamily:'monospace', color:'#0f172a' }}>{selectedSymbol}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {ALL_TAGS.map(tag => {
              const meta = PROTECTION_TAG_META[tag];
              const active = currentTags.includes(tag);
              return (
                <button key={tag} onClick={() => onToggleTag(tag)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1.5px solid ${active ? meta.border : '#e2e8f0'}`,
                  background: active ? meta.bg : '#f8fafc',
                  fontWeight: active ? 600 : 400,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: meta.text }} />
                  <span style={{ fontSize: 12, color: active ? meta.text : '#64748b', flex: 1, textAlign: 'left' }}>
                    {meta.label} — {tag}
                  </span>
                  {active && <span style={{ fontSize: 14, color: meta.text }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {taggedSymbols.length > 0 && (
        <>
          <div style={divider} />
          <div style={sectionTitle}>All Tagged Signals</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {taggedSymbols.map(([sym, tags]) => (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1e293b', minWidth: 60 }}>{sym}</span>
                {tags.map(tag => {
                  const m = PROTECTION_TAG_META[tag];
                  return <span key={tag} style={{ ...tagStyle, background: m.bg, color: m.text, borderColor: m.border }}>{m.label}</span>;
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── COMPARE TAB ───────────────────────────────────────────────
function CompareTab({ diff }: { diff: RevisionDiff | null }) {
  if (!diff) {
    return <EmptyState icon="⇄" color="#94a3b8" message="Switch to Compare mode and enter a second revision in the left panel." />;
  }

  const statusColor: Record<string, string> = {
    added: '#16a34a', removed: '#dc2626', modified: '#d97706', unchanged: '#94a3b8',
  };
  const statusIcon: Record<string, string> = {
    added: '+', removed: '−', modified: '~', unchanged: '=',
  };

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          { label: 'Added',     count: diff.addedSymbols.length,    color: '#16a34a' },
          { label: 'Removed',   count: diff.removedSymbols.length,  color: '#dc2626' },
          { label: 'Modified',  count: diff.modifiedSymbols.length, color: '#d97706' },
          { label: 'Unchanged', count: diff.unchangedSymbols.length, color: '#94a3b8' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '6px 12px', borderRadius: 8, background: color + '15', border: `1px solid ${color}40`,
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, color }}>{count}</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {diff.equations.filter(d => d.status !== 'unchanged').map(d => (
          <div key={d.target} style={{
            ...diagRow, borderLeftColor: statusColor[d.status],
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: statusColor[d.status] }}>
                {statusIcon[d.status]}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{d.target}</span>
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{d.status}</span>
            </div>
            {d.detail && (
              <pre style={{ margin: '4px 0 0', fontSize: 10, color: '#475569', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {d.detail}
              </pre>
            )}
          </div>
        ))}
        {diff.unchangedSymbols.length > 0 && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {diff.unchangedSymbols.length} equation(s) unchanged: {diff.unchangedSymbols.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────
function EmptyState({ icon, color, message }: { icon: string; color: string; message: string }) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 18, color }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100%',
  background: '#fff', borderLeft: '1px solid #e2e8f0',
};
const headerStyle: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0,
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0, overflowX: 'auto',
};
const tabBtnBase: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12, border: 'none', background: 'transparent',
  cursor: 'pointer', whiteSpace: 'nowrap',
};
const scrollStyle: React.CSSProperties = { flex: 1, overflowY: 'auto' };
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
  color: '#64748b', display: 'block', marginBottom: 6,
};
const diagRow: React.CSSProperties = {
  padding: '5px 8px', marginBottom: 4, borderLeft: '3px solid #dc2626',
  background: '#fafafa', borderRadius: '0 4px 4px 0', fontSize: 12,
};
const diagLoc: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2, fontFamily: 'monospace',
};
const divider: React.CSSProperties = { height: 1, background: '#e2e8f0', margin: '10px 0' };
const card: React.CSSProperties = {
  marginBottom: 10, padding: '10px 12px', background: '#f8fafc',
  border: '1px solid #e2e8f0', borderRadius: 8,
};
const dtStyle: React.CSSProperties = {
  fontSize: 11, color: '#64748b', paddingRight: 10, paddingBottom: 4,
  verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 500,
};
const ddStyle: React.CSSProperties = {
  fontSize: 12, color: '#1e293b', wordBreak: 'break-all', paddingBottom: 4,
};
const explanationBox: React.CSSProperties = {
  padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0',
  borderRadius: 8, fontSize: 12, color: '#14532d', marginBottom: 10,
};
const tagStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 4, border: '1px solid',
};
const cycleTag: React.CSSProperties = {
  fontSize: 11, fontFamily: 'monospace', padding: '3px 7px', marginBottom: 4,
  borderRadius: 4, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
};

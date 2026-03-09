// ============================================================
// DiagnosticsPane: right-hand panel showing
//   - Diagnostics (parse errors, semantic warnings)
//   - Selected node details
//   - English explanation for the selected symbol
// ============================================================

import type { AnalysisResult, GateGraph, SymbolEntry } from '../../domain/models';
import type { SignalNodeData, GateNodeData } from '../../visualization/flowBuilder';
import { generateExplanation } from '../../analysis/explanationGenerator';

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface DiagnosticsPaneProps {
  analysisResult: AnalysisResult | null;
  gateGraph:      GateGraph | null;
  symbols:        Map<string, SymbolEntry>;
  selectedNodeId: string;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function DiagnosticsPane({
  analysisResult,
  gateGraph,
  symbols,
  selectedNodeId,
}: DiagnosticsPaneProps) {
  const diagnostics = analysisResult?.diagnostics ?? [];
  const errors   = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warning');
  const infos    = diagnostics.filter(d => d.severity === 'info');

  // ── Selected node detail ───────────────────────────────────

  let selectedNodeDetail: React.ReactNode = null;
  let explanation: string | null = null;

  if (selectedNodeId && gateGraph) {
    const node = gateGraph.nodes.get(selectedNodeId);
    if (node) {
      if (node.gateType === 'SIGNAL') {
        const symbolName = node.symbolName ?? node.label;
        const entry = symbols.get(symbolName);
        selectedNodeDetail = (
          <NodeDetailCard
            title={symbolName}
            rows={[
              ['Type',       entry?.isExternalInput ? 'External input' : entry?.isUnreferenced ? 'Output' : 'Intermediate signal'],
              ['Symbol',     symbolName],
              ['Line',       entry?.definedBy?.loc.line?.toString() ?? '—'],
              ['Source',     entry?.definedBy?.loc.rawSource ?? '—'],
            ]}
          />
        );
        if (entry && !entry.isExternalInput) {
          const exp = generateExplanation(symbolName, symbols);
          explanation = exp.text;
        }
      } else {
        selectedNodeDetail = (
          <NodeDetailCard
            title={node.label}
            rows={[
              ['Type',   `${node.gateType} gate`],
              ['Target', node.id.split('_').slice(0, 3).join('_')],
              ['Line',   node.loc?.line?.toString() ?? '—'],
              ['Source', node.loc?.rawSource ?? '—'],
            ]}
          />
        );
      }
    }
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Diagnostics</span>
      </div>

      <div style={scrollAreaStyle}>

        {/* ── Diagnostics summary ─────────────────────────────── */}
        {diagnostics.length === 0 ? (
          <EmptyState icon="✓" color="#16a34a" message="No issues found." />
        ) : (
          <>
            {errors.length > 0 && (
              <Section title={`Errors (${errors.length})`} color="#dc2626">
                {errors.map((d, i) => (
                  <DiagRow key={i} diag={d} />
                ))}
              </Section>
            )}
            {warnings.length > 0 && (
              <Section title={`Warnings (${warnings.length})`} color="#d97706">
                {warnings.map((d, i) => (
                  <DiagRow key={i} diag={d} />
                ))}
              </Section>
            )}
            {infos.length > 0 && (
              <Section title={`Info (${infos.length})`} color="#0284c7">
                {infos.map((d, i) => (
                  <DiagRow key={i} diag={d} />
                ))}
              </Section>
            )}
          </>
        )}

        {/* ── Selected node detail ────────────────────────────── */}
        {selectedNodeDetail && (
          <>
            <div style={dividerStyle} />
            <div style={{ padding: '10px 14px 0' }}>
              <span style={sectionTitleStyle}>Selected Node</span>
            </div>
            {selectedNodeDetail}
          </>
        )}

        {/* ── Explanation ─────────────────────────────────────── */}
        {explanation && (
          <>
            <div style={dividerStyle} />
            <div style={{ padding: '10px 14px 0' }}>
              <span style={sectionTitleStyle}>Logic Explanation</span>
            </div>
            <div style={explanationStyle}>
              {explanation.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
                  {line}
                </p>
              ))}
            </div>
          </>
        )}

        {/* ── Symbols summary ─────────────────────────────────── */}
        {analysisResult && analysisResult.symbols.size > 0 && (
          <>
            <div style={dividerStyle} />
            <SymbolsSummary analysisResult={analysisResult} />
          </>
        )}

      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '10px 14px 4px' }}>
      <div style={{ ...sectionTitleStyle, color }}>{title}</div>
      {children}
    </div>
  );
}

import type { Diagnostic } from '../../domain/models';

function DiagRow({ diag }: { diag: Diagnostic }) {
  const color =
    diag.severity === 'error'   ? '#dc2626' :
    diag.severity === 'warning' ? '#d97706' : '#0284c7';

  return (
    <div style={{ ...diagRowStyle, borderLeftColor: color }}>
      {diag.loc && (
        <span style={diagLocStyle}>Line {diag.loc.line}</span>
      )}
      <span style={{ color: '#1e293b', fontSize: 12 }}>{diag.message}</span>
    </div>
  );
}

function NodeDetailCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label}>
              <td style={dtStyle}>{label}</td>
              <td style={ddStyle}>{val || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SymbolsSummary({ analysisResult }: { analysisResult: AnalysisResult }) {
  const { undefinedReferences, unusedVariables, cycles } = analysisResult;

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={sectionTitleStyle}>Symbol Summary</div>
      <SymRow label="External inputs" items={undefinedReferences} color="#16a34a" />
      <SymRow label="Unreferenced outputs" items={unusedVariables} color="#ea580c" />
      {cycles.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
            Cycles ({cycles.length})
          </div>
          {cycles.map((cycle, i) => (
            <div key={i} style={{ ...cycleTagStyle }}>
              {cycle.join(' → ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SymRow({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.map(name => (
          <span key={name} style={{ ...tagStyle, background: color + '20', color, borderColor: color + '60' }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, color, message }: { icon: string; color: string; message: string }) {
  return (
    <div style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16, color }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#64748b' }}>{message}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  height:        '100%',
  background:    '#fff',
  borderLeft:    '1px solid #e2e8f0',
};

const headerStyle: React.CSSProperties = {
  padding:      '10px 14px',
  borderBottom: '1px solid #e2e8f0',
  background:   '#f8fafc',
  flexShrink:   0,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize:   13,
  color:      '#0f172a',
};

const scrollAreaStyle: React.CSSProperties = {
  flex:     1,
  overflowY: 'auto',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize:     11,
  fontWeight:   700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color:        '#64748b',
  display:      'block',
  marginBottom: 6,
};

const diagRowStyle: React.CSSProperties = {
  padding:      '6px 10px',
  marginBottom: 4,
  borderLeft:   '3px solid #dc2626',
  background:   '#fafafa',
  borderRadius: '0 4px 4px 0',
  fontSize:     12,
};

const diagLocStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     11,
  color:        '#94a3b8',
  marginBottom: 2,
  fontFamily:   'monospace',
};

const dividerStyle: React.CSSProperties = {
  height:     1,
  background: '#e2e8f0',
  margin:     '8px 0',
};

const cardStyle: React.CSSProperties = {
  margin:       '8px 14px',
  padding:      '10px 12px',
  background:   '#f8fafc',
  border:       '1px solid #e2e8f0',
  borderRadius: 8,
};

const cardTitleStyle: React.CSSProperties = {
  fontWeight:    700,
  fontSize:      14,
  fontFamily:    'monospace',
  color:         '#0f172a',
  marginBottom:  8,
};

const dtStyle: React.CSSProperties = {
  fontSize:    11,
  color:       '#64748b',
  paddingRight: 10,
  paddingBottom: 4,
  verticalAlign: 'top',
  whiteSpace:  'nowrap',
  fontWeight:  500,
};

const ddStyle: React.CSSProperties = {
  fontSize:     12,
  color:        '#1e293b',
  fontFamily:   'monospace',
  wordBreak:    'break-all',
  paddingBottom: 4,
};

const explanationStyle: React.CSSProperties = {
  margin:     '8px 14px',
  padding:    '10px 12px',
  background: '#f0fdf4',
  border:     '1px solid #bbf7d0',
  borderRadius: 8,
  fontSize:   13,
  color:      '#14532d',
  lineHeight: 1.6,
};

const tagStyle: React.CSSProperties = {
  fontSize:     11,
  fontFamily:   'monospace',
  padding:      '2px 6px',
  borderRadius: 4,
  border:       '1px solid',
};

const cycleTagStyle: React.CSSProperties = {
  fontSize:     11,
  fontFamily:   'monospace',
  padding:      '4px 8px',
  marginBottom: 4,
  borderRadius: 4,
  background:   '#fef2f2',
  border:       '1px solid #fecaca',
  color:        '#991b1b',
};

// ============================================================
// SimulationPanel — toggle external inputs and inspect computed values
// ============================================================
import type { SimulationResult, SymbolEntry } from '../../domain/models';

interface Props {
  symbols: Map<string, SymbolEntry>;
  inputValues: Map<string, boolean>;
  simulationResult: SimulationResult | null;
  onToggle: (name: string, value: boolean) => void;
  onReset: () => void;
}

export default function SimulationPanel({
  symbols, inputValues, simulationResult, onToggle, onReset,
}: Props) {
  const inputs   = [...symbols.values()].filter(s => s.isExternalInput).sort((a, b) => a.name.localeCompare(b.name));
  const defined  = [...symbols.values()].filter(s => !s.isExternalInput).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ padding: '10px 14px' }}>
      {/* Controls header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={secTitle}>External Inputs</span>
        <button onClick={onReset} style={resetBtn} title="Set all inputs to false">
          Reset all
        </button>
      </div>

      {inputs.length === 0 && (
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No external inputs detected.</p>
      )}

      {/* Input toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {inputs.map(s => {
          const val = inputValues.get(s.name) ?? false;
          return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Toggle */}
              <button
                onClick={() => onToggle(s.name, !val)}
                style={{
                  ...toggleBase,
                  background: val ? '#16a34a' : '#e2e8f0',
                }}
                title={val ? 'Click to set FALSE' : 'Click to set TRUE'}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  transform: val ? 'translateX(14px)' : 'translateX(0)',
                  transition: 'transform 0.15s',
                }} />
              </button>
              <span style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: '#1e293b' }}>
                {s.name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: val ? '#16a34a' : '#94a3b8' }}>
                {val ? 'TRUE' : 'FALSE'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Computed signal values */}
      {simulationResult && defined.length > 0 && (
        <>
          <div style={{ height: 1, background: '#e2e8f0', margin: '14px 0 10px' }} />
          <span style={secTitle}>Computed Values</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {defined.map(s => {
              const val = simulationResult.values.get(s.name);
              const icon  = val === true ? '✓' : val === false ? '✗' : '?';
              const color = val === true ? '#16a34a' : val === false ? '#ef4444' : '#94a3b8';
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: '#1e293b' }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>
                    {icon} {val === true ? 'TRUE' : val === false ? 'FALSE' : 'CYCLE'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const secTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.8, color: '#64748b', flex: 1,
};
const resetBtn: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', background: '#f1f5f9',
  border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', color: '#475569',
};
const toggleBase: React.CSSProperties = {
  width: 32, height: 18, borderRadius: 9, border: 'none',
  cursor: 'pointer', padding: 2, flexShrink: 0, transition: 'background 0.15s',
  display: 'flex', alignItems: 'center',
};

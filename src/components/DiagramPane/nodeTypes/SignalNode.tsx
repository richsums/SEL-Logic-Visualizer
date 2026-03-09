// Custom React Flow node: Signal — with simulation values, diff status, and protection tags
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SignalNodeData } from '../../../visualization/flowBuilder';
import { PROTECTION_TAG_META } from '../../../domain/models';
import type { ProtectionTag } from '../../../domain/models';

function SignalNode({ data, selected }: NodeProps) {
  const d = data as SignalNodeData;

  let borderColor = '#64748b', background = '#f8fafc', labelColor = '#0f172a';

  if (d.diffStatus === 'added')    { borderColor = '#16a34a'; background = '#f0fdf4'; }
  else if (d.diffStatus === 'removed')  { borderColor = '#dc2626'; background = '#fef2f2'; }
  else if (d.diffStatus === 'modified') { borderColor = '#d97706'; background = '#fffbeb'; }
  else if (d.isExternalInput) { borderColor = '#16a34a'; background = '#f0fdf4'; labelColor = '#14532d'; }
  else if (d.isOutput)        { borderColor = '#ea580c'; background = '#fff7ed'; labelColor = '#7c2d12'; }
  else                        { borderColor = '#2563eb'; background = '#eff6ff'; labelColor = '#1e3a8a'; }

  if (selected)               { borderColor = '#7c3aed'; background = '#faf5ff'; }
  if (d.highlighted && !selected) { borderColor = '#f97316'; background = '#fff7ed'; }

  // Simulation badge
  const simVal = d.simulationValue;
  const simIcon = simVal === true ? '✓' : simVal === false ? '✗' : simVal === null ? '?' : null;
  const simColor = simVal === true ? '#16a34a' : simVal === false ? '#ef4444' : '#94a3b8';

  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 8,
      border: `2px solid ${borderColor}`, background,
      opacity: d.diffStatus === 'removed' ? 0.5 : 1,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      boxShadow: selected ? '0 0 0 3px #7c3aed44' : undefined, overflow: 'hidden',
    }}>
      {/* Protection-function tag strip */}
      {d.tags && d.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '2px 4px',
          background: '#0f172a08', borderBottom: `1px solid ${borderColor}40` }}>
          {d.tags.map(tag => {
            const meta = PROTECTION_TAG_META[tag as ProtectionTag];
            return (
              <span key={tag} style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 0.5, padding: '1px 4px',
                borderRadius: 3, background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`,
              }}>{meta.label}</span>
            );
          })}
        </div>
      )}

      {/* Label row */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '2px 8px' }}>
        {!d.isExternalInput && (
          <Handle type="target" position={Position.Left}
            style={{ background: borderColor, width: 8, height: 8 }} />
        )}
        <span style={{
          fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
          color: labelColor, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', flex: 1, textAlign: 'center',
        }} title={d.label}>{d.label}</span>
        {simIcon !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: simColor, marginLeft: 4, flexShrink: 0 }}>
            {simIcon}
          </span>
        )}
        <Handle type="source" position={Position.Right}
          style={{ background: borderColor, width: 8, height: 8 }} />
      </div>
    </div>
  );
}

export default memo(SignalNode);

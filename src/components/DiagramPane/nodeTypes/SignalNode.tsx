// ============================================================
// Custom React Flow node: Signal (named wire / variable)
// ============================================================

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SignalNodeData } from '../../../visualization/flowBuilder';

function SignalNode({ data, selected }: NodeProps) {
  const d = data as SignalNodeData;

  let borderColor = '#64748b';   // default intermediate
  let background  = '#f8fafc';
  let labelColor  = '#0f172a';

  if (d.isExternalInput) {
    borderColor = '#16a34a';
    background  = '#f0fdf4';
    labelColor  = '#14532d';
  } else if (d.isOutput) {
    borderColor = '#ea580c';
    background  = '#fff7ed';
    labelColor  = '#7c2d12';
  } else {
    // intermediate defined signal
    borderColor = '#2563eb';
    background  = '#eff6ff';
    labelColor  = '#1e3a8a';
  }

  if (selected) {
    borderColor = '#7c3aed';
    background  = '#faf5ff';
  }
  if (d.highlighted && !selected) {
    borderColor = '#f97316';
    background  = '#fff7ed';
  }

  return (
    <div
      style={{
        width:        '100%',
        height:       '100%',
        borderRadius: 8,
        border:       `2px solid ${borderColor}`,
        background,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        padding:      '4px 8px',
        boxSizing:    'border-box',
        boxShadow:    selected ? `0 0 0 3px #7c3aed44` : undefined,
      }}
    >
      {/* Input handle (left) — not shown for pure external inputs */}
      {!d.isExternalInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: borderColor, width: 8, height: 8 }}
        />
      )}

      <span
        style={{
          fontFamily:  'monospace',
          fontSize:    13,
          fontWeight:  600,
          color:       labelColor,
          whiteSpace:  'nowrap',
          overflow:    'hidden',
          textOverflow: 'ellipsis',
        }}
        title={d.label}
      >
        {d.label}
      </span>

      {/* Output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: borderColor, width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(SignalNode);

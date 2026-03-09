// ============================================================
// Custom React Flow node: Logic gate (AND / OR / NOT)
// ============================================================

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GateNodeData } from '../../../visualization/flowBuilder';

const GATE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  AND: { bg: '#fef9c3', border: '#ca8a04', text: '#713f12' },
  OR:  { bg: '#fce7f3', border: '#db2777', text: '#831843' },
  NOT: { bg: '#f3e8ff', border: '#9333ea', text: '#4c1d95' },
};

function GateNode({ data, selected }: NodeProps) {
  const d = data as GateNodeData;
  const colors = GATE_COLORS[d.gateType] ?? GATE_COLORS['AND'];

  const borderColor = selected   ? '#7c3aed'
    : d.highlighted ? '#f97316'
    : colors.border;
  const background  = selected   ? '#faf5ff'
    : d.highlighted ? '#fff7ed'
    : colors.bg;

  // Number of input handles depends on gate type
  const inputCount = d.gateType === 'NOT' ? 1 : 2;

  return (
    <div
      style={{
        width:        '100%',
        height:       '100%',
        borderRadius: 6,
        border:       `2px solid ${borderColor}`,
        background,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        boxSizing:    'border-box',
        boxShadow:    selected ? `0 0 0 3px #7c3aed44` : undefined,
      }}
    >
      {/* Input handles */}
      {inputCount === 1 ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in0"
          style={{ background: borderColor, width: 7, height: 7, top: '50%' }}
        />
      ) : (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in0"
            style={{ background: borderColor, width: 7, height: 7, top: '33%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="in1"
            style={{ background: borderColor, width: 7, height: 7, top: '67%' }}
          />
        </>
      )}

      <span
        style={{
          fontFamily: 'monospace',
          fontSize:   12,
          fontWeight: 700,
          color:      selected ? '#7c3aed' : d.highlighted ? '#f97316' : colors.text,
          letterSpacing: 1,
        }}
      >
        {d.gateType}
      </span>

      {/* Output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ background: borderColor, width: 7, height: 7, top: '50%' }}
      />
    </div>
  );
}

export default memo(GateNode);

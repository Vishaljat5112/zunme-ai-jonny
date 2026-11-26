import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { User, Briefcase, Building } from 'lucide-react';
import { ChartNodeData } from './types';

// Custom Shape Node supporting Rectangle, Rounded-Rectangle, Circle, Diamond, and Text
export const CustomShapeNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = (data || {}) as ChartNodeData;
  const shape = nodeData.shape || 'rounded-rectangle';
  const fillColor = nodeData.fillColor || '#FFFFFF';
  const borderColor = nodeData.borderColor || '#6E56CF';
  const borderWidth = nodeData.borderWidth ?? 1.5;
  const borderStyle = nodeData.borderStyle || 'solid';
  const textColor = nodeData.textColor || '#111625';
  const fontSize = nodeData.fontSize || 13;
  const fontWeight = nodeData.fontWeight || 'normal';
  const textAlign = nodeData.textAlign || 'center';

  const isCircle = shape === 'circle';
  const isDiamond = shape === 'diamond';
  const isText = shape === 'text';
  const isRounded = shape === 'rounded-rectangle';

  // Base container styles
  let borderRadius = '8px';
  if (isCircle) borderRadius = '50%';
  else if (isRounded) borderRadius = '18px';
  else if (isText) borderRadius = '4px';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: isCircle ? '80px' : isDiamond ? '90px' : '100px',
        minHeight: isCircle ? '80px' : isDiamond ? '90px' : '40px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isText ? '4px 8px' : isDiamond ? '14px' : '10px 14px',
        background: isText ? 'transparent' : fillColor,
        border: isText
          ? selected
            ? '1px dashed #6E56CF'
            : '1px solid transparent'
          : `${borderWidth}px ${borderStyle} ${borderColor}`,
        borderRadius,
        color: textColor,
        fontSize: `${fontSize}px`,
        fontWeight,
        textAlign,
        boxShadow: isText ? 'none' : selected ? '0 0 0 2px #6E56CF40, 0 4px 12px rgba(0,0,0,0.06)' : '0 2px 6px rgba(0,0,0,0.03)',
        boxSizing: 'border-box',
        transform: isDiamond ? 'rotate(45deg)' : undefined,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      {/* Node Resizer Control visible when selected */}
      <NodeResizer
        isVisible={!!selected}
        minWidth={isCircle || isDiamond ? 70 : 80}
        minHeight={isCircle || isDiamond ? 70 : 36}
        color="#6E56CF"
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        lineStyle={{ borderColor: '#6E56CF', borderWidth: 1 }}
      />

      {/* Connection Handles (Top, Bottom, Left, Right) */}
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        style={{
          background: '#6E56CF',
          width: 8,
          height: 8,
          borderRadius: 4,
          top: isDiamond ? '-4px' : '-4px',
          left: '50%'
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        style={{
          background: '#6E56CF',
          width: 8,
          height: 8,
          borderRadius: 4,
          bottom: isDiamond ? '-4px' : '-4px',
          left: '50%'
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="l"
        style={{
          background: '#6E56CF',
          width: 8,
          height: 8,
          borderRadius: 4,
          left: isDiamond ? '-4px' : '-4px',
          top: '50%'
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        style={{
          background: '#6E56CF',
          width: 8,
          height: 8,
          borderRadius: 4,
          right: isDiamond ? '-4px' : '-4px',
          top: '50%'
        }}
      />

      {/* Content wrapper (counter-rotate text if diamond) */}
      <div
        style={{
          transform: isDiamond ? 'rotate(-45deg)' : undefined,
          wordBreak: 'break-word',
          lineHeight: '1.35',
          userSelect: 'none',
          pointerEvents: 'none',
          width: '100%',
          textAlign
        }}
      >
        {nodeData.label || 'Node'}
      </div>
    </div>
  );
});

CustomShapeNode.displayName = 'CustomShapeNode';

// Organization / Person Node for Hierarchy & Org Charts
export const OrgPersonNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = (data || {}) as ChartNodeData;
  const personName = nodeData.personName || nodeData.label || 'Team Member';
  const personRole = nodeData.personRole || 'Software Engineer';
  const department = nodeData.department || 'Engineering';
  const fillColor = nodeData.fillColor || '#FFFFFF';
  const borderColor = nodeData.borderColor || '#6E56CF';

  return (
    <div
      style={{
        width: '100%',
        minWidth: '180px',
        padding: '12px 14px',
        background: fillColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: '12px',
        boxShadow: selected ? '0 0 0 2px #6E56CF40, 0 6px 16px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.04)',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease'
      }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={160}
        minHeight={60}
        color="#6E56CF"
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />

      {/* Hierarchical Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        style={{ background: '#6E56CF', width: 8, height: 8, borderRadius: 4, top: '-4px' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        style={{ background: '#6E56CF', width: 8, height: 8, borderRadius: 4, bottom: '-4px' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="l"
        style={{ background: '#6E56CF', width: 8, height: 8, borderRadius: 4, left: '-4px' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        style={{ background: '#6E56CF', width: 8, height: 8, borderRadius: 4, right: '-4px' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#F4F1FD',
            color: '#6E56CF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <User size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1, pointerEvents: 'none' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#111625', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {personName}
          </div>
          <div style={{ fontSize: '11.5px', color: '#5F6B85', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Briefcase size={10} />
            <span>{personRole}</span>
          </div>
        </div>
      </div>

      {department && (
        <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #F1F4F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: '#8C97B0', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Building size={10} />
            <span>{department}</span>
          </span>
          <span style={{ background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
            Org Node
          </span>
        </div>
      )}
    </div>
  );
});

OrgPersonNode.displayName = 'OrgPersonNode';

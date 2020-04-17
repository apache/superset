import React, { CSSProperties } from 'react';
import { LegendItemMarkRendererProps } from '../legend/types';
import { LineEncodingConfig } from './Encoder';

const MARK_WIDTH = 12;
const MARK_HEIGHT = 8;

const MARK_STYLE: CSSProperties = { display: 'inline-block' };

export default function DefaultLegendItemMarkRenderer({
  item,
}: LegendItemMarkRendererProps<LineEncodingConfig>) {
  return (
    <svg width={MARK_WIDTH} height={MARK_HEIGHT} style={MARK_STYLE}>
      <line
        stroke={item.output.stroke ?? 'none'}
        strokeWidth={item.output.strokeWidth ?? 2}
        strokeDasharray={item.output.strokeDasharray ?? 'none'}
        x1={0}
        x2={MARK_WIDTH}
        y1={MARK_HEIGHT / 2}
        y2={MARK_HEIGHT / 2}
      />
    </svg>
  );
}

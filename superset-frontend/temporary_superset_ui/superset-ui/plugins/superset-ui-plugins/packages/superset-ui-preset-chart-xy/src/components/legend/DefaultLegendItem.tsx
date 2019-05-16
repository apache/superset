import React, { CSSProperties } from 'react';
import { LegendItem, LegendLabel } from '@vx/legend';
import { LegendItemRendererProps } from './types';

const MARK_SIZE = 8;

const MARK_STYLE: CSSProperties = { display: 'inline-block' };

export default function DefaultLegendItem<ChannelTypes>({
  item,
  MarkRenderer,
  LabelRenderer,
}: LegendItemRendererProps<ChannelTypes>) {
  return (
    <LegendItem key={`legend-item-${item.field}-${item.value}`} margin="0 5px">
      {typeof MarkRenderer === 'undefined' ? (
        <svg width={MARK_SIZE} height={MARK_SIZE} style={MARK_STYLE}>
          <circle
            fill={
              // @ts-ignore
              item.encodedValues.color ||
              // @ts-ignore
              item.encodedValues.stroke ||
              // @ts-ignore
              item.encodedValues.fill ||
              '#ccc'
            }
            stroke={
              // @ts-ignore
              item.encodedValues.stroke || 'none'
            }
            r={MARK_SIZE / 2}
            cx={MARK_SIZE / 2}
            cy={MARK_SIZE / 2}
          />
        </svg>
      ) : (
        <MarkRenderer item={item} />
      )}
      {typeof LabelRenderer === 'undefined' ? (
        <LegendLabel align="left" margin="0 0 0 4px">
          {item.value}
        </LegendLabel>
      ) : (
        <LabelRenderer item={item} />
      )}
    </LegendItem>
  );
}

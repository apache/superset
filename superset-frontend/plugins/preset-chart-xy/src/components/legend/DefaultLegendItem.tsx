import React, { CSSProperties } from 'react';
import { LegendItem, LegendLabel } from '@vx/legend';
import { EncodingConfig } from 'encodable';
import { LegendItemRendererProps } from './types';

const MARK_SIZE = 8;

const MARK_STYLE: CSSProperties = { display: 'inline-block' };

export default function DefaultLegendItem<Config extends EncodingConfig>({
  group,
  item,
  MarkRenderer,
  LabelRenderer,
}: LegendItemRendererProps<Config>) {
  return (
    <LegendItem key={`legend-item-${group.field}-${item.input}`} margin="0 5px">
      {typeof MarkRenderer === 'undefined' ? (
        <svg width={MARK_SIZE} height={MARK_SIZE} style={MARK_STYLE}>
          <circle
            fill={
              // @ts-ignore
              (item.output.color ??
                // @ts-ignore
                item.output.fill ??
                // @ts-ignore
                item.output.stroke ??
                '#ccc') as string
            }
            stroke={
              // @ts-ignore
              (item.output.stroke ?? 'none') as string
            }
            r={MARK_SIZE / 2}
            cx={MARK_SIZE / 2}
            cy={MARK_SIZE / 2}
          />
        </svg>
      ) : (
        <MarkRenderer group={group} item={item} />
      )}
      {typeof LabelRenderer === 'undefined' ? (
        <LegendLabel align="left" margin="0 0 0 4px">
          {item.input}
        </LegendLabel>
      ) : (
        <LabelRenderer group={group} item={item} />
      )}
    </LegendItem>
  );
}

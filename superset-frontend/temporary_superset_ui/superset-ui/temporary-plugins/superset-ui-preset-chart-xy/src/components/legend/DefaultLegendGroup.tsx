import React, { CSSProperties } from 'react';
import { EncodingConfig } from 'encodable';
import { LegendGroupRendererProps } from './types';
import DefaultLegendItem from './DefaultLegendItem';

const LEGEND_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexDirection: 'row',
  flexGrow: 1,
  flexShrink: 1,
  flexWrap: 'wrap',
  fontSize: '0.8em',
  justifyContent: 'flex-end',
  padding: 8,
};

export default function DefaultLegendGroupRenderer<Config extends EncodingConfig>({
  group,
  ItemRenderer = DefaultLegendItem,
  ItemMarkRenderer,
  ItemLabelRenderer,
  style,
}: LegendGroupRendererProps<Config>) {
  const combinedStyle =
    typeof style === 'undefined' ? LEGEND_GROUP_STYLE : { ...LEGEND_GROUP_STYLE, ...style };

  return (
    <div style={combinedStyle}>
      {'items' in group &&
        group.items.map(item => (
          <ItemRenderer
            key={`legend-item-${group.field}-${item.input}`}
            group={group}
            item={item}
            MarkRenderer={ItemMarkRenderer}
            LabelRenderer={ItemLabelRenderer}
          />
        ))}
    </div>
  );
}

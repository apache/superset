import React, { CSSProperties } from 'react';
import { LegendGroupRendererProps } from './types';
import DefaultLegendItem from './DefaultLegendItem';

const LEGEND_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  fontSize: '0.8em',
};

export default function DefaultLegendGroupRenderer<ChannelTypes>({
  items,
  ItemRenderer,
  ItemMarkRenderer,
  ItemLabelRenderer,
}: LegendGroupRendererProps<ChannelTypes>) {
  const LegendItem = typeof ItemRenderer === 'undefined' ? DefaultLegendItem : ItemRenderer;

  return (
    <div style={LEGEND_GROUP_STYLE}>
      {items.map(item => (
        <LegendItem
          key={`legend-item-${item.field}-${item.value}`}
          item={item}
          MarkRenderer={ItemMarkRenderer}
          LabelRenderer={ItemLabelRenderer}
        />
      ))}
    </div>
  );
}

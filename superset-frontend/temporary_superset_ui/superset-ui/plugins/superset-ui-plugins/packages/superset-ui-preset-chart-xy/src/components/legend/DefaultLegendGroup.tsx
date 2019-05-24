import React, { CSSProperties } from 'react';
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
};

export default function DefaultLegendGroupRenderer<ChannelTypes>({
  items,
  ItemRenderer,
  ItemMarkRenderer,
  ItemLabelRenderer,
  style,
}: LegendGroupRendererProps<ChannelTypes>) {
  const LegendItem = typeof ItemRenderer === 'undefined' ? DefaultLegendItem : ItemRenderer;

  const combinedStyle =
    typeof style === 'undefined' ? LEGEND_GROUP_STYLE : { ...LEGEND_GROUP_STYLE, ...style };

  return (
    <div style={combinedStyle}>
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

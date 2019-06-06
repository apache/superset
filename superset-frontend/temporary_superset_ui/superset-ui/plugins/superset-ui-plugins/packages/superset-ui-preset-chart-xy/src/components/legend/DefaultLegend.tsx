import React, { CSSProperties, PureComponent } from 'react';
import AbstractEncoder from '../../encodeable/AbstractEncoder';
import { LegendRendererProps } from './types';
import DefaultLegendGroup from './DefaultLegendGroup';

const LEGEND_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  maxHeight: 100,
  overflowY: 'auto',
  position: 'relative',
};

export type Props<Encoder> = LegendRendererProps<Encoder>;

export default class DefaultLegend<Encoder extends AbstractEncoder<any, any>> extends PureComponent<
  Props<Encoder>
> {
  render() {
    const {
      groups,
      LegendGroupRenderer = DefaultLegendGroup,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style,
    } = this.props;

    const combinedStyle =
      typeof style === 'undefined'
        ? LEGEND_CONTAINER_STYLE
        : { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      <div style={combinedStyle}>
        {groups.map(items => (
          <LegendGroupRenderer
            key={items[0].field}
            items={items}
            ItemRenderer={LegendItemRenderer}
            ItemMarkRenderer={LegendItemMarkRenderer}
            ItemLabelRenderer={LegendItemLabelRenderer}
          />
        ))}
      </div>
    );
  }
}

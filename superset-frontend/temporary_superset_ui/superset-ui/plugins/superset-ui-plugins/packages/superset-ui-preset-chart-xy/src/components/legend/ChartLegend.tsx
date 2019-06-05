import React, { CSSProperties, PureComponent } from 'react';
import AbstractEncoder from '../../encodeable/AbstractEncoder';
import { Dataset } from '../../encodeable/types/Data';
import { ChannelType } from '../../encodeable/types/Channel';
import {
  LegendItemRendererType,
  LegendGroupRendererType,
  LegendItemLabelRendererType,
  LegendItemMarkRendererType,
} from './types';
import DefaultLegendGroup from './DefaultLegendGroup';
import { ChannelDef } from '../../encodeable/types/ChannelDef';

const LEGEND_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  maxHeight: 100,
  overflowY: 'auto',
  position: 'relative',
};

export type Hooks<ChannelTypes> = {
  LegendGroupRenderer?: LegendGroupRendererType<ChannelTypes>;
  LegendItemRenderer?: LegendItemRendererType<ChannelTypes>;
  LegendItemMarkRenderer?: LegendItemMarkRendererType<ChannelTypes>;
  LegendItemLabelRenderer?: LegendItemLabelRendererType<ChannelTypes>;
};

export type Props<ChannelTypes, Encoder> = {
  data: Dataset;
  encoder: Encoder;
  style?: CSSProperties;
} & Hooks<ChannelTypes>;

export default class ChartLegend<
  Encoder extends AbstractEncoder<ChannelTypes, Encoding>,
  ChannelTypes extends Record<string, ChannelType> = any,
  Encoding extends Record<keyof ChannelTypes, ChannelDef> = any
> extends PureComponent<Props<ChannelTypes, Encoder>, {}> {
  render() {
    const {
      data,
      encoder,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style,
    } = this.props;

    const LegendGroup =
      typeof LegendGroupRenderer === 'undefined' ? DefaultLegendGroup : LegendGroupRenderer;
    const combinedStyle =
      typeof style === 'undefined'
        ? LEGEND_CONTAINER_STYLE
        : { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      <div style={combinedStyle}>
        {encoder.getLegendInfos(data).map(items => (
          <LegendGroup
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

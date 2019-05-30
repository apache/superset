import React, { CSSProperties, PureComponent } from 'react';
import { Value } from 'vega-lite/build/src/channeldef';
import AbstractEncoder from '../../encodeable/AbstractEncoder';
import { Dataset } from '../../encodeable/types/Data';
import { ObjectWithKeysFromAndValueType } from '../../encodeable/types/Base';
import { ChannelType, EncodingFromChannelsAndOutputs } from '../../encodeable/types/Channel';
import { BaseOptions } from '../../encodeable/types/Specification';
import {
  LegendItemRendererType,
  LegendGroupRendererType,
  LegendItemLabelRendererType,
  LegendItemMarkRendererType,
} from './types';
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

export type Hooks<ChannelTypes> = {
  LegendGroupRenderer?: LegendGroupRendererType<ChannelTypes>;
  LegendItemRenderer?: LegendItemRendererType<ChannelTypes>;
  LegendItemMarkRenderer?: LegendItemMarkRendererType<ChannelTypes>;
  LegendItemLabelRenderer?: LegendItemLabelRendererType<ChannelTypes>;
};

export type Props<Encoder, ChannelTypes> = {
  data: Dataset;
  encoder: Encoder;
  style?: CSSProperties;
} & Hooks<ChannelTypes>;

export default class ChartLegend<
  ChannelTypes extends ObjectWithKeysFromAndValueType<Outputs, ChannelType>,
  Outputs extends ObjectWithKeysFromAndValueType<Encoding, Value>,
  Encoding extends EncodingFromChannelsAndOutputs<
    ChannelTypes,
    Outputs
  > = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>,
  Options extends BaseOptions = BaseOptions
> extends PureComponent<
  Props<AbstractEncoder<ChannelTypes, Outputs, Encoding, Options>, ChannelTypes>,
  {}
> {
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

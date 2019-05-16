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
  maxHeight: 100,
  overflowY: 'auto',
  paddingLeft: 14,
  paddingTop: 6,
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
    } = this.props;

    const LegendGroup =
      typeof LegendGroupRenderer === 'undefined' ? DefaultLegendGroup : LegendGroupRenderer;

    return (
      <div style={LEGEND_CONTAINER_STYLE}>
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

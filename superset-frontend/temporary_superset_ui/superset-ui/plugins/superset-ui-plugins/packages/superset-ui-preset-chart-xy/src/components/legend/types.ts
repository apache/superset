import { Value } from 'vega-lite/build/src/channeldef';
import { CSSProperties } from 'react';
import { ObjectWithKeysFromAndValueType } from '../../encodeable/types/Base';
import { ChannelInput } from '../../encodeable/types/Channel';

export type LegendItemInfo<ChannelTypes> = {
  field: string;
  value: ChannelInput;
  encodedValues: Partial<ObjectWithKeysFromAndValueType<ChannelTypes, Value | undefined>>;
};

export type LegendItemMarkRendererType<ChannelTypes> = React.ComponentType<{
  item: LegendItemInfo<ChannelTypes>;
}>;

export type LegendItemLabelRendererType<ChannelTypes> = React.ComponentType<{
  item: LegendItemInfo<ChannelTypes>;
}>;

export type LegendItemRendererProps<ChannelTypes> = {
  item: LegendItemInfo<ChannelTypes>;
  MarkRenderer?: LegendItemMarkRendererType<ChannelTypes>;
  LabelRenderer?: LegendItemLabelRendererType<ChannelTypes>;
};

export type LegendItemRendererType<ChannelTypes> = React.ComponentType<
  LegendItemRendererProps<ChannelTypes>
>;

export type LegendGroupRendererProps<ChannelTypes> = {
  items: LegendItemInfo<ChannelTypes>[];
  ItemRenderer?: LegendItemRendererType<ChannelTypes>;
  ItemMarkRenderer?: LegendItemMarkRendererType<ChannelTypes>;
  ItemLabelRenderer?: LegendItemLabelRendererType<ChannelTypes>;
  style?: CSSProperties;
};

export type LegendGroupRendererType<ChannelTypes> = React.ComponentType<
  LegendGroupRendererProps<ChannelTypes>
>;

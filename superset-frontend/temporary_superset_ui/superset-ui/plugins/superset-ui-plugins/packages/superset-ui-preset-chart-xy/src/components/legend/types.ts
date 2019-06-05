import { Value } from 'vega-lite/build/src/channeldef';
import { CSSProperties } from 'react';
import { ChannelInput } from '../../encodeable/types/Channel';

export type LegendItemInfo<Encoding> = {
  field: string;
  value: ChannelInput;
  encodedValues: Partial<Record<keyof Encoding, Value | undefined>>;
};

export type LegendItemMarkRendererType<Encoding> = React.ComponentType<{
  item: LegendItemInfo<Encoding>;
}>;

export type LegendItemLabelRendererType<Encoding> = React.ComponentType<{
  item: LegendItemInfo<Encoding>;
}>;

export type LegendItemRendererProps<Encoding> = {
  item: LegendItemInfo<Encoding>;
  MarkRenderer?: LegendItemMarkRendererType<Encoding>;
  LabelRenderer?: LegendItemLabelRendererType<Encoding>;
};

export type LegendItemRendererType<Encoding> = React.ComponentType<
  LegendItemRendererProps<Encoding>
>;

export type LegendGroupRendererProps<Encoding> = {
  items: LegendItemInfo<Encoding>[];
  ItemRenderer?: LegendItemRendererType<Encoding>;
  ItemMarkRenderer?: LegendItemMarkRendererType<Encoding>;
  ItemLabelRenderer?: LegendItemLabelRendererType<Encoding>;
  style?: CSSProperties;
};

export type LegendGroupRendererType<Encoding> = React.ComponentType<
  LegendGroupRendererProps<Encoding>
>;

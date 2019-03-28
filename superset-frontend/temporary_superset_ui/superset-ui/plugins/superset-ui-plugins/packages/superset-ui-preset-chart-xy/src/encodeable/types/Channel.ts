import { Value } from 'vega-lite/build/src/fielddef';
import { XFieldDef, YFieldDef, ChannelDef, MarkPropChannelDef, TextChannelDef } from './FieldDef';
import { ObjectWithKeysFromAndValueType } from './Base';

// eslint-disable-next-line import/prefer-default-export
export interface ChannelOptions {
  namespace?: string;
  legend?: boolean;
}

/**
 * Define all channel types and mapping to available definition grammar
 */
export interface ChannelTypeToDefMap<Output extends Value = Value>
  extends ObjectWithKeysFromAndValueType<ChannelTypeToDefMap<Output>, ChannelDef> {
  // position on x-axis
  X: XFieldDef<Output>;
  // position on y-axis
  Y: YFieldDef<Output>;
  // position on x-axis but as a range, e.g., bar chart or heat map
  XBand: XFieldDef<Output>;
  // position on y-axis but as a range, e.g., bar chart or heat map
  YBand: YFieldDef<Output>;
  // numeric attributes of the mark, e.g., size, opacity
  Numeric: MarkPropChannelDef<Output>;
  // categorical attributes of the mark, e.g., color, visibility, shape
  Category: MarkPropChannelDef<Output>;
  // color of the mark
  Color: MarkPropChannelDef<Output>;
  // plain text, e.g., tooltip, key
  Text: TextChannelDef<Output>;
}

export type ChannelType = keyof ChannelTypeToDefMap;

export type ChannelDefFromType<
  T extends keyof ChannelTypeToDefMap,
  Output extends Value
> = ChannelTypeToDefMap<Output>[T];

export type EncodingFromChannelsAndOutputs<
  Channels extends ObjectWithKeysFromAndValueType<Outputs, ChannelType>,
  Outputs extends ObjectWithKeysFromAndValueType<Channels, Value>
> = { [key in keyof Channels]: ChannelDefFromType<Channels[key], Outputs[key]> };

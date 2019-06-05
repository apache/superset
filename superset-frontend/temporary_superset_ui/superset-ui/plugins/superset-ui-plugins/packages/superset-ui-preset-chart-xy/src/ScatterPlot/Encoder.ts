import { Value } from 'vega-lite/build/src/channeldef';
import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import { ChannelTypeToDefMap } from '../encodeable/types/Channel';
import { ExtractChannelOutput } from '../encodeable/types/ChannelDef';

/**
 * Define channel types
 */
const channelTypes = {
  fill: 'Color',
  group: 'Text',
  size: 'Numeric',
  stroke: 'Color',
  tooltip: 'Text',
  x: 'X',
  y: 'Y',
} as const;

export type ChannelTypes = typeof channelTypes;

/**
 * Helper for defining encoding
 */
type CreateChannelDef<
  ChannelName extends keyof ChannelTypes,
  Output extends Value
> = ChannelTypeToDefMap<Output>[ChannelTypes[ChannelName]];

/**
 * Encoding definition
 */
export type Encoding = {
  fill: CreateChannelDef<'fill', string>;
  group: CreateChannelDef<'group', string>[];
  size: CreateChannelDef<'size', number>;
  stroke: CreateChannelDef<'stroke', string>;
  tooltip: CreateChannelDef<'tooltip', string>[];
  x: CreateChannelDef<'x', number>;
  y: CreateChannelDef<'y', number>;
};

/**
 * Can use this to get returned type of a Channel
 * example usage: ChannelOutput<'x'>
 */
export type ChannelOutput<ChannelName extends keyof Encoding> = ExtractChannelOutput<
  Encoding[ChannelName]
>;

export default class Encoder extends AbstractEncoder<ChannelTypes, Encoding> {
  static readonly DEFAULT_ENCODINGS: Encoding = {
    fill: { value: '#222' },
    group: [],
    size: { value: 5 },
    stroke: { value: 'none' },
    tooltip: [],
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  };

  static readonly CHANNEL_OPTIONS = {};

  constructor(spec: PartialSpec<Encoding>) {
    super(channelTypes, spec, Encoder.DEFAULT_ENCODINGS, Encoder.CHANNEL_OPTIONS);
  }
}

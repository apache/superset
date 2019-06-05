import { Value } from 'vega-lite/build/src/channeldef';
import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import { ChannelTypeToDefMap } from '../encodeable/types/Channel';
import { ExtractChannelOutput } from '../encodeable/types/ChannelDef';

/**
 * Define channel names and their types
 */
const channelTypes = {
  fill: 'Category',
  stroke: 'Color',
  strokeDasharray: 'Category',
  strokeWidth: 'Numeric',
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
  fill: CreateChannelDef<'fill', boolean>;
  stroke: CreateChannelDef<'stroke', string>;
  strokeDasharray: CreateChannelDef<'strokeDasharray', string>;
  strokeWidth: CreateChannelDef<'strokeWidth', number>;
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
    fill: { value: false },
    stroke: { value: '#222' },
    strokeDasharray: { value: '' },
    strokeWidth: { value: 1 },
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  };

  static readonly CHANNEL_OPTIONS = {
    fill: { legend: false },
  };

  constructor(spec: PartialSpec<Encoding>) {
    super(channelTypes, spec, Encoder.DEFAULT_ENCODINGS, Encoder.CHANNEL_OPTIONS);
  }
}

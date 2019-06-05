import { Value } from 'vega-lite/build/src/channeldef';
import { ChannelTypeToDefMap } from '../encodeable/types/Channel';
import { ExtractChannelOutput } from '../encodeable/types/ChannelDef';
import createEncoderClass from '../encodeable/createEncoderClass';

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
} as const; // "as const" is mandatory

export type ChannelTypes = typeof channelTypes;

/**
 * TEMPLATE:
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
 * TEMPLATE:
 * Can use this to get returned type of a Channel
 * example usage: ChannelOutput<'x'>
 */
export type ChannelOutput<ChannelName extends keyof Encoding> = ExtractChannelOutput<
  Encoding[ChannelName]
>;

export default class Encoder extends createEncoderClass<ChannelTypes, Encoding>({
  channelTypes,
  defaultEncoding: {
    fill: { value: '#222' },
    group: [],
    size: { value: 5 },
    stroke: { value: 'none' },
    tooltip: [],
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
}) {}

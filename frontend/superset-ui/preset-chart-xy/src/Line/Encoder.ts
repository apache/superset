import { Value } from 'vega-lite/build/src/channeldef';
import { ChannelTypeToDefMap } from '../encodeable/types/Channel';
import { ExtractChannelOutput } from '../encodeable/types/ChannelDef';
import createEncoderClass from '../encodeable/createEncoderClass';

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
  fill: CreateChannelDef<'fill', boolean>;
  stroke: CreateChannelDef<'stroke', string>;
  strokeDasharray: CreateChannelDef<'strokeDasharray', string>;
  strokeWidth: CreateChannelDef<'strokeWidth', number>;
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
  allChannelOptions: {
    fill: { legend: false },
  },
  channelTypes,
  defaultEncoding: {
    fill: { value: false },
    stroke: { value: '#222' },
    strokeDasharray: { value: '' },
    strokeWidth: { value: 1 },
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
}) {}

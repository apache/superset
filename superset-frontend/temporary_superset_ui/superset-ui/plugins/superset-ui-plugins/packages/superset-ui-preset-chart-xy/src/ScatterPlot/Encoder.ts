import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import { EncodingFromChannelsAndOutputs } from '../encodeable/types/Channel';

/**
 * Define channel types
 */
const channelTypes = {
  fill: 'Color',
  size: 'Numeric',
  stroke: 'Color',
  x: 'X',
  y: 'Y',
} as const;

export type ChannelTypes = typeof channelTypes;

/**
 * Define output type for each channel
 */
export interface Outputs {
  fill: string;
  size: number;
  stroke: string;
  x: number | null;
  y: number | null;
}

/**
 * Derive encoding config
 */
export type Encoding = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>;

export default class Encoder extends AbstractEncoder<ChannelTypes, Outputs> {
  static readonly DEFAULT_ENCODINGS: Encoding = {
    fill: { value: '#222' },
    size: { value: 5 },
    stroke: { value: 'none' },
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  };

  static readonly CHANNEL_OPTIONS = {};

  constructor(spec: PartialSpec<Encoding>) {
    super(channelTypes, spec, Encoder.DEFAULT_ENCODINGS, Encoder.CHANNEL_OPTIONS);
  }
}

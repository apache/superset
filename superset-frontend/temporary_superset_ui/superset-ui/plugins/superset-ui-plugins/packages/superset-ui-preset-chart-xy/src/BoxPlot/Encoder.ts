import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import { EncodingFromChannelsAndOutputs } from '../encodeable/types/Channel';

/**
 * Define channel types
 */
const channelTypes = {
  color: 'Color',
  x: 'XBand',
  y: 'YBand',
} as const;

export type ChannelTypes = typeof channelTypes;

/**
 * Define output type for each channel
 */
export interface Outputs {
  x: number | null;
  y: number | null;
  color: string;
}

/**
 * Derive encoding config
 */
export type Encoding = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>;

export default class Encoder extends AbstractEncoder<ChannelTypes, Outputs> {
  static readonly DEFAULT_ENCODINGS: Encoding = {
    color: { value: '#222' },
    x: { field: 'x', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
  };

  static readonly CHANNEL_OPTIONS = {};

  constructor(spec: PartialSpec<Encoding>) {
    super(channelTypes, spec, Encoder.DEFAULT_ENCODINGS, Encoder.CHANNEL_OPTIONS);
  }
}

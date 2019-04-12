import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import { EncodingFromChannelsAndOutputs } from '../encodeable/types/Channel';

/**
 * Define channel types
 */
// This is a workaround until TypeScript 3.4 which has const context
// which will allow use to derive type from object literal
// without type widening (e.g. 'X' instead of string).
// Now we have to define class with readonly fields
// to be able to use "typeof" to infer strict types
// See more details from
// https://github.com/Microsoft/TypeScript/issues/20195
// https://github.com/Microsoft/TypeScript/pull/29510
const channelTypes = new (class Channels {
  readonly x = 'X';
  readonly y = 'Y';
  readonly color = 'Color';
  readonly fill = 'Category';
  readonly strokeDasharray = 'Category';
})();

export type ChannelTypes = typeof channelTypes;

/**
 * Define output type for each channel
 */
export interface Outputs {
  x: number | null;
  y: number | null;
  color: string;
  fill: boolean;
  strokeDasharray: string;
}

/**
 * Derive encoding config
 */
export type Encoding = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>;

export default class Encoder extends AbstractEncoder<ChannelTypes, Outputs> {
  static readonly DEFAULT_ENCODINGS: Encoding = {
    color: { value: '#222' },
    fill: { value: false },
    strokeDasharray: { value: '' },
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

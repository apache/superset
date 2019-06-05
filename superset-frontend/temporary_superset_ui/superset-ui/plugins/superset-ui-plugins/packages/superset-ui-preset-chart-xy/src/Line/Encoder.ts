import AbstractEncoder from '../encodeable/AbstractEncoder';
import { PartialSpec } from '../encodeable/types/Specification';
import {
  EncodingFromChannelsAndOutputs,
  ChannelTypeToDefMap,
  ChannelType,
} from '../encodeable/types/Channel';

/**
 * Define channel types
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

export type Encoding = {
  fill: ChannelTypeToDefMap<boolean>[ChannelTypes['fill']];
  stroke: ChannelTypeToDefMap<string>[ChannelTypes['stroke']];
  strokeDasharray: ChannelTypeToDefMap<string>[ChannelTypes['strokeDasharray']];
  strokeWidth: ChannelTypeToDefMap<number>[ChannelTypes['strokeWidth']];
  x: ChannelTypeToDefMap<string>[ChannelTypes['x']];
  y: ChannelTypeToDefMap<string>[ChannelTypes['y']];
};

/**
 * Define output type for each channel
 */
// export interface Outputs {
//   x: number | null;
//   y: number | null;
//   fill: boolean;
//   stroke: string;
//   strokeDasharray: string;
//   strokeWidth: number;
// }

/**
 * Derive encoding config
 */
// export type Encoding = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>;

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

import Encoder from 'encodable/lib/encoders/Encoder';
import createEncoderFactory from 'encodable/lib/encoders/createEncoderFactory';
import { DeriveEncoding, DeriveChannelOutputs } from 'encodable/lib/types/Encoding';

export type LineEncodingConfig = {
  x: ['X', number];
  y: ['Y', number];
  fill: ['Category', boolean];
  stroke: ['Color', string];
  strokeDasharray: ['Category', string];
  strokeWidth: ['Numeric', number];
};

export const lineEncoderFactory = createEncoderFactory<LineEncodingConfig>({
  channelTypes: {
    x: 'X',
    y: 'Y',
    fill: 'Category',
    stroke: 'Color',
    strokeDasharray: 'Category',
    strokeWidth: 'Numeric',
  },
  defaultEncoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    fill: { value: false, legend: false },
    stroke: { value: '#222' },
    strokeDasharray: { value: '' },
    strokeWidth: { value: 1 },
  },
});

export type LineEncoding = DeriveEncoding<LineEncodingConfig>;

export type LineEncoder = Encoder<LineEncodingConfig>;

export type LineChannelOutputs = DeriveChannelOutputs<LineEncodingConfig>;

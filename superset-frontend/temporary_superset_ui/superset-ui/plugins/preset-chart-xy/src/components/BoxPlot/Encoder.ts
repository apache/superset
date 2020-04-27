import { createEncoderFactory, Encoder, DeriveEncoding } from 'encodable';

export type BoxPlotEncodingConfig = {
  x: ['XBand', number];
  y: ['YBand', number];
  color: ['Color', string];
};

export const boxPlotEncoderFactory = createEncoderFactory<BoxPlotEncodingConfig>({
  channelTypes: {
    x: 'XBand',
    y: 'YBand',
    color: 'Color',
  },
  defaultEncoding: {
    x: { field: 'x', type: 'nominal' },
    y: { field: 'y', type: 'quantitative' },
    color: { value: '#222' },
  },
});

export type BoxPlotEncoding = DeriveEncoding<BoxPlotEncodingConfig>;

export type BoxPlotEncoder = Encoder<BoxPlotEncodingConfig>;

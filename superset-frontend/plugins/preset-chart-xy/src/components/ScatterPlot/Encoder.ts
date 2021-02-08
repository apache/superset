import { createEncoderFactory, Encoder, DeriveEncoding, DeriveChannelOutputs } from 'encodable';

export type ScatterPlotEncodingConfig = {
  x: ['X', number];
  y: ['Y', number];
  fill: ['Color', string];
  group: ['Category', string, 'multiple'];
  size: ['Numeric', number];
  stroke: ['Color', string];
  tooltip: ['Text', string, 'multiple'];
};

export const scatterPlotEncoderFactory = createEncoderFactory<ScatterPlotEncodingConfig>({
  channelTypes: {
    x: 'X',
    y: 'Y',
    fill: 'Color',
    group: 'Category',
    size: 'Numeric',
    stroke: 'Color',
    tooltip: 'Text',
  },
  defaultEncoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    fill: { value: '#222' },
    group: [],
    size: { value: 5 },
    stroke: { value: 'none' },
    tooltip: [],
  },
});

export type ScatterPlotEncoding = DeriveEncoding<ScatterPlotEncodingConfig>;

export type ScatterPlotEncoder = Encoder<ScatterPlotEncodingConfig>;

export type ScatterPlotChannelOutputs = DeriveChannelOutputs<ScatterPlotEncodingConfig>;

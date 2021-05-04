import { createEncoderFactory, DeriveEncoding, Encoder, DeriveChannelOutputs } from 'encodable';

type ChoroplethMapEncodingConfig = {
  key: ['Text', string];
  fill: ['Color', string];
  opacity: ['Numeric', number];
  stroke: ['Color', string];
  strokeWidth: ['Numeric', number];
  tooltip: ['Text', string, 'multiple'];
};

export type ChoroplethMapEncoding = DeriveEncoding<ChoroplethMapEncodingConfig>;

export type ChoroplethMapEncoder = Encoder<ChoroplethMapEncodingConfig>;

export type ChoroplethMapChannelOutputs = DeriveChannelOutputs<ChoroplethMapEncodingConfig>;

export const DefaultChannelOutputs = {
  key: '',
  fill: '#f0f0f0',
  opacity: 1,
  stroke: '#ccc',
  strokeWidth: 1,
};

export const choroplethMapEncoderFactory = createEncoderFactory<ChoroplethMapEncodingConfig>({
  channelTypes: {
    key: 'Text',
    fill: 'Color',
    opacity: 'Numeric',
    stroke: 'Color',
    strokeWidth: 'Numeric',
    tooltip: 'Text',
  },
  defaultEncoding: {
    key: { field: 'key', title: 'Location' },
    fill: { value: DefaultChannelOutputs.fill },
    opacity: { value: DefaultChannelOutputs.opacity },
    stroke: { value: DefaultChannelOutputs.stroke },
    strokeWidth: { value: DefaultChannelOutputs.strokeWidth },
    tooltip: [],
  },
});

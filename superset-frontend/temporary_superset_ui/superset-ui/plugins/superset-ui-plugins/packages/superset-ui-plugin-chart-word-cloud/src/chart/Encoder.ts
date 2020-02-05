import { createEncoderFactory } from 'encodable';
import { DeriveEncoding } from 'encodable/lib/types/Encoding';

type WordCloudEncodingConfig = {
  color: ['Color', string];
  fontFamily: ['Category', string];
  fontSize: ['Numeric', number];
  fontWeight: ['Category', string | number];
  text: ['Text', string];
};

export const wordCloudEncoderFactory = createEncoderFactory<WordCloudEncodingConfig>({
  channelTypes: {
    color: 'Color',
    fontFamily: 'Category',
    fontSize: 'Numeric',
    fontWeight: 'Category',
    text: 'Text',
  },
  defaultEncoding: {
    color: { value: 'black' },
    fontFamily: { value: 'Helvetica' },
    fontSize: { value: 20 },
    fontWeight: { value: 'bold' },
    text: { value: '' },
  },
});

export type WordCloudEncoding = DeriveEncoding<WordCloudEncodingConfig>;

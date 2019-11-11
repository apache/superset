import Encoder from './Encoder';
import { EncodingConfig, DeriveChannelTypes, DeriveEncoding } from '../types/Encoding';
import mergeEncoding from '../utils/mergeEncoding';

type CreateEncoderFactoryParams<Config extends EncodingConfig> = {
  channelTypes: DeriveChannelTypes<Config>;
} & (
  | {
      /**
       * use the default approach to merge default encoding with user-specified encoding
       * if there are missing fields
       */
      defaultEncoding: DeriveEncoding<Config>;
    }
  | {
      /**
       * custom way to complete the encoding
       * if there are missing fields
       */
      completeEncoding: (e: Partial<DeriveEncoding<Config>>) => DeriveEncoding<Config>;
    }
);

export default function createEncoderFactory<Config extends EncodingConfig>(
  params: CreateEncoderFactoryParams<Config>,
) {
  const { channelTypes } = params;
  type PartialEncoding = Partial<DeriveEncoding<Config>>;

  const completeEncoding =
    'defaultEncoding' in params
      ? (encoding: PartialEncoding) => mergeEncoding(params.defaultEncoding, encoding)
      : params.completeEncoding;

  return {
    channelTypes,
    create: (encoding: PartialEncoding) =>
      new Encoder<Config>({
        channelTypes,
        encoding: completeEncoding(encoding),
      }),
    DEFAULT_ENCODING: completeEncoding({}),
  };
}

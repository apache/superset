import { EncodingConfig, DeriveEncoding } from '../types/Encoding';

export default function mergeEncoding<Config extends EncodingConfig>(
  defaultEncoding: DeriveEncoding<Config>,
  encoding: Partial<DeriveEncoding<Config>>,
): DeriveEncoding<Config> {
  return {
    ...defaultEncoding,
    ...encoding,
  };
}

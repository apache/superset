import AbstractEncoder from './AbstractEncoder';
import { PartialSpec, BaseOptions } from './types/Specification';
import { MayBeArray } from './types/Base';
import { ChannelDef } from './types/ChannelDef';
import { ChannelType, AllChannelOptions } from './types/Channel';

export default function createEncoderClass<
  ChannelTypes extends Record<string, ChannelType>,
  Encoding extends Record<keyof ChannelTypes, MayBeArray<ChannelDef>>,
  Options extends BaseOptions = BaseOptions
>({
  channelTypes,
  defaultEncoding,
  allChannelOptions: allChannelOptions = {},
}: {
  channelTypes: ChannelTypes;
  defaultEncoding: Encoding;
  allChannelOptions?: AllChannelOptions<Encoding>;
}) {
  return class Encoder extends AbstractEncoder<ChannelTypes, Encoding, Options> {
    static readonly DEFAULT_ENCODING: Encoding = defaultEncoding;

    static readonly ALL_CHANNEL_OPTIONS = allChannelOptions;

    constructor(spec: PartialSpec<Encoding, Options>) {
      super(channelTypes, spec, defaultEncoding, allChannelOptions);
    }
  };
}

import { createSelector } from 'reselect';
import { PartialSpec, BaseOptions } from './types/Specification';
import AbstractEncoder from './AbstractEncoder';
import { ChannelType } from './types/Channel';
import { ChannelDef } from './types/ChannelDef';
import { MayBeArray } from './types/Base';

export default function createEncoderSelector<
  EncoderConstructor extends AbstractEncoder<ChannelTypes, Encoding, Options>,
  ChannelTypes extends Record<string, ChannelType>,
  Encoding extends Record<keyof ChannelTypes, MayBeArray<ChannelDef>>,
  Options extends BaseOptions = BaseOptions
>(EncoderConstructor: new (spec: PartialSpec<Encoding, Options>) => EncoderConstructor) {
  return createSelector(
    (spec: PartialSpec<Encoding, Options>) => spec.encoding,
    spec => spec.options,
    (encoding, options) => new EncoderConstructor({ encoding, options }),
  );
}

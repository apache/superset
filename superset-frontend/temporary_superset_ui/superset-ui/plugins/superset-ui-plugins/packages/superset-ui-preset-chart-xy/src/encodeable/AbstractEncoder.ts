import { flatMap } from 'lodash';
import { Value } from 'vega-lite/build/src/channeldef';
import { ChannelType, ChannelInput, AllChannelOptions } from './types/Channel';
import { FullSpec, BaseOptions, PartialSpec } from './types/Specification';
import { isFieldDef, isTypedFieldDef, ChannelDef } from './types/ChannelDef';
import { Dataset } from './types/Data';
import { Unarray, MayBeArray, isArray, isNotArray } from './types/Base';
import ChannelEncoder from './ChannelEncoder';

type AllChannelEncoders<Encoding extends Record<string, MayBeArray<ChannelDef>>> = {
  readonly [k in keyof Encoding]: Encoding[k] extends any[]
    ? ChannelEncoder<Unarray<Encoding[k]>>[]
    : ChannelEncoder<Unarray<Encoding[k]>>;
};

export default abstract class AbstractEncoder<
  ChannelTypes extends Record<string, ChannelType>,
  Encoding extends Record<keyof ChannelTypes, MayBeArray<ChannelDef>>,
  Options extends BaseOptions = BaseOptions
> {
  readonly spec: FullSpec<Encoding, Options>;
  readonly channelTypes: ChannelTypes;
  readonly channels: AllChannelEncoders<Encoding>;

  readonly legends: {
    [key: string]: (keyof Encoding)[];
  };

  constructor(
    channelTypes: ChannelTypes,
    spec: PartialSpec<Encoding, Options>,
    defaultEncoding?: Encoding,
    allChannelOptions: AllChannelOptions<Encoding> = {},
  ) {
    this.channelTypes = channelTypes;
    this.spec = this.createFullSpec(spec, defaultEncoding);
    const { encoding } = this.spec;

    const channelNames = this.getChannelNames();

    const channels: { [k in keyof Encoding]?: MayBeArray<ChannelEncoder<ChannelDef>> } = {};

    channelNames.forEach(name => {
      const channelEncoding = encoding[name];
      if (isArray(channelEncoding)) {
        const definitions = channelEncoding;
        channels[name] = definitions.map(
          (definition, i) =>
            new ChannelEncoder({
              definition,
              name: `${name}[${i}]`,
              type: 'Text',
            }),
        );
      } else if (isNotArray(channelEncoding)) {
        const definition = channelEncoding;
        channels[name] = new ChannelEncoder({
          definition,
          name,
          options: {
            ...this.spec.options,
            ...allChannelOptions[name],
          },
          type: channelTypes[name],
        });
      }
    });

    this.channels = channels as AllChannelEncoders<Encoding>;

    type ChannelName = keyof Encoding;

    // Group the channels that use the same field together
    // so they can share the same legend.
    this.legends = {};
    channelNames
      .map(name => this.channels[name])
      .forEach(c => {
        if (isNotArray(c) && c.hasLegend() && isFieldDef(c.definition)) {
          const name = c.name as ChannelName;
          const { field } = c.definition;
          if (this.legends[field]) {
            this.legends[field].push(name);
          } else {
            this.legends[field] = [name];
          }
        }
      });
  }

  /**
   * subclass can override this
   */
  createFullSpec(spec: PartialSpec<Encoding, Options>, defaultEncoding?: Encoding) {
    if (typeof defaultEncoding === 'undefined') {
      return spec as FullSpec<Encoding, Options>;
    }

    const { encoding, ...rest } = spec;

    return {
      ...rest,
      encoding: {
        ...defaultEncoding,
        ...encoding,
      },
    };
  }

  getChannelNames() {
    return Object.keys(this.channelTypes) as (keyof ChannelTypes)[];
  }

  getChannelsAsArray() {
    return this.getChannelNames().map(name => this.channels[name]);
  }

  getGroupBys() {
    const fields = flatMap(this.getChannelsAsArray())
      .filter(c => c.isGroupBy())
      .map(c => (isFieldDef(c.definition) ? c.definition.field : ''))
      .filter(field => field !== '');

    return Array.from(new Set(fields));
  }

  getLegendInfos(data: Dataset) {
    return Object.keys(this.legends)
      .map((field: string) => {
        const channelNames = this.legends[field];
        const channelEncoder = this.channels[channelNames[0]];

        if (isNotArray(channelEncoder) && isTypedFieldDef(channelEncoder.definition)) {
          // Only work for nominal channels now
          // TODO: Add support for numerical scale
          if (channelEncoder.definition.type === 'nominal') {
            const domain = channelEncoder.getDomain(data) as string[];

            return domain.map((value: ChannelInput) => ({
              field,
              value,
              // eslint-disable-next-line sort-keys
              encodedValues: channelNames.reduce(
                (prev: Partial<Record<keyof Encoding, Value | undefined>>, curr) => {
                  const map = prev;
                  const channel = this.channels[curr];
                  if (isNotArray(channel)) {
                    map[curr] = channel.encodeValue(value);
                  }

                  return map;
                },
                {},
              ),
            }));
          }
        }

        return [];
      })
      .filter(items => items.length > 0);
  }

  hasLegend() {
    return Object.keys(this.legends).length > 0;
  }
}

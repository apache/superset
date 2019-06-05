import { flatMap } from 'lodash';
import { Value } from 'vega-lite/build/src/channeldef';
import { ChannelOptions, ChannelType, ChannelInput } from './types/Channel';
import { FullSpec, BaseOptions, PartialSpec } from './types/Specification';
import { isFieldDef, isTypedFieldDef, FieldDef, ChannelDef } from './types/ChannelDef';
import ChannelEncoder from './ChannelEncoder';
import { Dataset } from './types/Data';
import { Unarray, MayBeArray, isArray, isNotArray } from './types/Base';

export default abstract class AbstractEncoder<
  ChannelTypes extends Record<string, ChannelType>,
  Encoding extends Record<keyof ChannelTypes, MayBeArray<ChannelDef>>,
  Options extends BaseOptions = BaseOptions
> {
  readonly channelTypes: ChannelTypes;
  readonly spec: FullSpec<Encoding, Options>;
  readonly channels: {
    readonly [k in keyof Encoding]: Encoding[k] extends any[]
      ? ChannelEncoder<Unarray<Encoding[k]>>[]
      : ChannelEncoder<Unarray<Encoding[k]>>
  };

  readonly legends: {
    [key: string]: (keyof Encoding)[];
  };

  constructor(
    channelTypes: ChannelTypes,
    spec: PartialSpec<Encoding, Options>,
    defaultEncoding?: Encoding,
    channelOptions: Partial<{ [k in keyof Encoding]: ChannelOptions }> = {},
  ) {
    this.channelTypes = channelTypes;
    this.spec = this.createFullSpec(spec, defaultEncoding);
    const { encoding } = this.spec;

    type ChannelName = keyof Encoding;
    type Channels = {
      readonly [k in keyof Encoding]: Encoding[k] extends any[]
        ? ChannelEncoder<Unarray<Encoding[k]>>[]
        : ChannelEncoder<Unarray<Encoding[k]>>
    };

    const channelNames = this.getChannelNames();

    const tmp: { [k in keyof Encoding]?: MayBeArray<ChannelEncoder<ChannelDef>> } = {};

    channelNames.forEach(name => {
      const channelEncoding = encoding[name];
      if (isArray(channelEncoding)) {
        const definitions = channelEncoding;
        tmp[name] = definitions.map(
          (definition, i) =>
            new ChannelEncoder({
              definition,
              name: `${name}[${i}]`,
              type: 'Text',
            }),
        );
      } else if (isNotArray(channelEncoding)) {
        const definition = channelEncoding;
        tmp[name] = new ChannelEncoder({
          definition,
          name,
          options: {
            ...this.spec.options,
            ...channelOptions[name],
          },
          type: channelTypes[name],
        });
      }
    });

    this.channels = tmp as Channels;

    // Group the channels that use the same field together
    // so they can share the same legend.
    this.legends = {};
    channelNames
      .map((name: ChannelName) => this.channels[name])
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
  protected createFullSpec(spec: PartialSpec<Encoding, Options>, defaultEncoding?: Encoding) {
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

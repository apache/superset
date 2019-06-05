import { Value } from 'vega-lite/build/src/channeldef';
import { ObjectWithKeysFromAndValueType } from './types/Base';
import { ChannelOptions, ChannelType, ChannelInput } from './types/Channel';
import { FullSpec, BaseOptions, PartialSpec } from './types/Specification';
import { isFieldDef, isTypedFieldDef, FieldDef, ChannelDef } from './types/ChannelDef';
import ChannelEncoder from './ChannelEncoder';
import { Dataset } from './types/Data';

export default abstract class AbstractEncoder<
  ChannelTypes extends Record<string, ChannelType>,
  Encoding extends Record<keyof ChannelTypes, ChannelDef | ChannelDef>,
  Options extends BaseOptions = BaseOptions
> {
  readonly channelTypes: ChannelTypes;
  readonly spec: FullSpec<Encoding, Options>;
  readonly channels: { readonly [k in keyof ChannelTypes]: ChannelEncoder<Encoding[k]> };

  readonly commonChannels: {
    group: ChannelEncoder<FieldDef>[];
    tooltip: ChannelEncoder<FieldDef>[];
  };

  readonly legends: {
    [key: string]: (keyof ChannelTypes)[];
  };

  constructor(
    channelTypes: ChannelTypes,
    spec: PartialSpec<Encoding, Options>,
    defaultEncoding?: Encoding,
    channelOptions: Partial<{ [k in keyof ChannelTypes]: ChannelOptions }> = {},
  ) {
    this.channelTypes = channelTypes;
    this.spec = this.createFullSpec(spec, defaultEncoding);

    type ChannelName = keyof ChannelTypes;
    type Channels = { readonly [k in ChannelName]: ChannelEncoder<Encoding[k]> };

    const channelNames = Object.keys(this.channelTypes) as ChannelName[];

    const { encoding } = this.spec;
    this.channels = channelNames
      .map(
        (name: ChannelName) =>
          new ChannelEncoder<Encoding[typeof name]>({
            definition: encoding[name],
            name,
            options: {
              ...this.spec.options,
              ...channelOptions[name],
            },
            type: channelTypes[name],
          }),
      )
      .reduce((prev: Partial<Channels>, curr) => {
        const all = prev;
        all[curr.name as ChannelName] = curr;

        return all;
      }, {}) as Channels;

    this.commonChannels = {
      group: this.spec.commonEncoding.group.map(
        (def, i) =>
          new ChannelEncoder({
            definition: def,
            name: `group${i}`,
            type: 'Text',
          }),
      ),
      tooltip: this.spec.commonEncoding.tooltip.map(
        (def, i) =>
          new ChannelEncoder({
            definition: def,
            name: `tooltip${i}`,
            type: 'Text',
          }),
      ),
    };

    // Group the channels that use the same field together
    // so they can share the same legend.
    this.legends = {};
    channelNames
      .map((name: ChannelName) => this.channels[name])
      .filter(c => c.hasLegend())
      .forEach(c => {
        if (isFieldDef(c.definition)) {
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

    const { encoding, commonEncoding = {}, ...rest } = spec;
    const { group = [], tooltip = [] } = commonEncoding;

    return {
      commonEncoding: {
        group,
        tooltip,
      },
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
    const fields = this.getChannelsAsArray()
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

        if (isTypedFieldDef(channelEncoder.definition)) {
          // Only work for nominal channels now
          // TODO: Add support for numerical scale
          if (channelEncoder.definition.type === 'nominal') {
            const domain = channelEncoder.getDomain(data) as string[];

            return domain.map((value: ChannelInput) => ({
              field,
              value,
              // eslint-disable-next-line sort-keys
              encodedValues: channelNames.reduce(
                (
                  prev: Partial<ObjectWithKeysFromAndValueType<ChannelTypes, Value | undefined>>,
                  curr,
                ) => {
                  const map = prev;
                  map[curr] = this.channels[curr].encodeValue(value);

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

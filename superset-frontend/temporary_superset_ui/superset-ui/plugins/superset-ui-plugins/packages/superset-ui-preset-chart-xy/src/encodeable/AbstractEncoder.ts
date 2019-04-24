import { Value } from 'vega-lite/build/src/channeldef';
import { ObjectWithKeysFromAndValueType } from './types/Base';
import { ChannelOptions, EncodingFromChannelsAndOutputs, ChannelType } from './types/Channel';
import { FullSpec, BaseOptions, PartialSpec } from './types/Specification';
import { isFieldDef } from './types/ChannelDef';
import ChannelEncoder from './ChannelEncoder';

export default abstract class AbstractEncoder<
  // The first 3 generics depends on each other
  // to ensure all of them will have the exact same keys
  ChannelTypes extends ObjectWithKeysFromAndValueType<Outputs, ChannelType>,
  Outputs extends ObjectWithKeysFromAndValueType<Encoding, Value>,
  Encoding extends EncodingFromChannelsAndOutputs<
    ChannelTypes,
    Outputs
  > = EncodingFromChannelsAndOutputs<ChannelTypes, Outputs>,
  Options extends BaseOptions = BaseOptions
> {
  readonly channelTypes: ChannelTypes;
  readonly spec: FullSpec<Encoding, Options>;
  readonly channels: {
    readonly [k in keyof ChannelTypes]: ChannelEncoder<Encoding[k], Outputs[k]>
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
    type Channels = { readonly [k in ChannelName]: ChannelEncoder<Encoding[k], Outputs[k]> };

    const channelNames = Object.keys(this.channelTypes) as ChannelName[];

    const { encoding } = this.spec;
    this.channels = channelNames
      .map(
        (name: ChannelName) =>
          new ChannelEncoder<Encoding[typeof name], Outputs[typeof name]>({
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
    const fields = this.getChannelsAsArray()
      .filter(c => c.isGroupBy())
      .map(c => (isFieldDef(c.definition) ? c.definition.field : ''))
      .filter(field => field !== '');

    return Array.from(new Set(fields));
  }

  hasLegend() {
    return Object.keys(this.legends).length > 0;
  }
}

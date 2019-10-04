import { extent as d3Extent } from 'd3-array';
import { ChannelType, ChannelInput } from '../types/Channel';
import { PlainObject, Dataset } from '../types/Data';
import { ChannelDef } from '../types/ChannelDef';
import createGetterFromChannelDef, { Getter } from '../parsers/createGetterFromChannelDef';
import completeChannelDef, { CompleteChannelDef } from '../fillers/completeChannelDef';
import createFormatterFromChannelDef from '../parsers/format/createFormatterFromChannelDef';
import createScaleFromScaleConfig from '../parsers/scale/createScaleFromScaleConfig';
import identity from '../utils/identity';
import { HasToString, IdentityFunction } from '../types/Base';
import { isTypedFieldDef, isValueDef } from '../typeGuards/ChannelDef';
import { isX, isY, isXOrY } from '../typeGuards/Channel';
import { Value } from '../types/VegaLite';

type EncodeFunction<Output> = (value: ChannelInput | Output) => Output | null | undefined;

export default class ChannelEncoder<Def extends ChannelDef<Output>, Output extends Value = Value> {
  readonly name: string | Symbol | number;
  readonly channelType: ChannelType;
  readonly originalDefinition: Def;
  readonly definition: CompleteChannelDef<Output>;
  readonly scale: false | ReturnType<typeof createScaleFromScaleConfig>;

  private readonly getValue: Getter<Output>;
  readonly encodeValue: IdentityFunction<ChannelInput | Output> | EncodeFunction<Output>;
  readonly formatValue: (value: ChannelInput | HasToString) => string;

  constructor({
    name,
    channelType,
    definition: originalDefinition,
  }: {
    name: string;
    channelType: ChannelType;
    definition: Def;
  }) {
    this.name = name;
    this.channelType = channelType;

    this.originalDefinition = originalDefinition;
    this.definition = completeChannelDef(this.channelType, originalDefinition);

    this.getValue = createGetterFromChannelDef(this.definition);
    this.formatValue = createFormatterFromChannelDef(this.definition);

    const scale = this.definition.scale && createScaleFromScaleConfig(this.definition.scale);
    this.encodeValue = scale === false ? identity : (value: ChannelInput) => scale(value);
    this.scale = scale;
  }

  encodeDatum: {
    (datum: PlainObject): Output | null | undefined;
    (datum: PlainObject, otherwise: Output): Output;
  } = (datum: PlainObject, otherwise?: Output) => {
    const value = this.getValueFromDatum(datum);

    if (otherwise !== undefined && (value === null || value === undefined)) {
      return otherwise;
    }

    return this.encodeValue(value) as Output;
  };

  formatDatum = (datum: PlainObject): string => this.formatValue(this.getValueFromDatum(datum));

  getValueFromDatum = <T extends ChannelInput | Output>(datum: PlainObject, otherwise?: T) => {
    const value = this.getValue(datum);

    return otherwise !== undefined && (value === null || value === undefined)
      ? otherwise
      : (value as T);
  };

  getDomain = (data: Dataset) => {
    if (isValueDef(this.definition)) {
      const { value } = this.definition;

      return [value];
    }

    const { type } = this.definition;
    if (type === 'nominal' || type === 'ordinal') {
      return Array.from(new Set(data.map(d => this.getValueFromDatum(d)))) as string[];
    } else if (type === 'quantitative') {
      const extent = d3Extent(data, d => this.getValueFromDatum<number>(d));

      return typeof extent[0] === 'undefined' ? [0, 1] : (extent as [number, number]);
    } else if (type === 'temporal') {
      const extent = d3Extent(data, d => this.getValueFromDatum<number | Date>(d));

      return typeof extent[0] === 'undefined'
        ? [0, 1]
        : (extent as [number, number] | [Date, Date]);
    }

    return [];
  };

  getTitle() {
    return this.definition.title;
  }

  isGroupBy() {
    if (isTypedFieldDef(this.definition)) {
      const { type } = this.definition;

      return (
        this.channelType === 'Category' ||
        this.channelType === 'Text' ||
        (this.channelType === 'Color' && (type === 'nominal' || type === 'ordinal')) ||
        (isXOrY(this.channelType) && (type === 'nominal' || type === 'ordinal'))
      );
    }

    return false;
  }

  isX() {
    return isX(this.channelType);
  }

  isXOrY() {
    return isXOrY(this.channelType);
  }

  isY() {
    return isY(this.channelType);
  }

  hasLegend() {
    return this.definition.legend !== false;
  }
}

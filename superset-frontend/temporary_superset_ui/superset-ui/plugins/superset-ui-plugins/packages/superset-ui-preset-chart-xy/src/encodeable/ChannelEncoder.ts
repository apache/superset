import { Value } from 'vega-lite/build/src/channeldef';
import { extractFormatFromChannelDef } from './parsers/extractFormat';
import extractScale, { ScaleAgent } from './parsers/extractScale';
import extractGetter from './parsers/extractGetter';
import { ChannelOptions, ChannelType } from './types/Channel';
import { PlainObject } from './types/Data';
import {
  ChannelDef,
  isScaleFieldDef,
  isMarkPropFieldDef,
  isValueDef,
  isFieldDef,
  isNonValueDef,
} from './types/ChannelDef';
import isEnabled from './utils/isEnabled';
import isDisabled from './utils/isDisabled';
import identity from './utils/identity';
import AxisAgent from './AxisAgent';

export default class ChannelEncoder<Def extends ChannelDef<Output>, Output extends Value = Value> {
  readonly name: string | Symbol | number;
  readonly type: ChannelType;
  readonly definition: Def;
  readonly options: ChannelOptions;

  protected readonly getValue: (datum: PlainObject) => Value | undefined;
  readonly encodeValue: (value: any) => Output | null | undefined;
  readonly formatValue: (value: any) => string;
  readonly scale?: ScaleAgent<Output>;
  readonly axis?: AxisAgent<Def, Output>;

  constructor({
    name,
    type,
    definition,
    options = {},
  }: {
    name: string | Symbol | number;
    type: ChannelType;
    definition: Def;
    options?: ChannelOptions;
  }) {
    this.name = name;
    this.type = type;
    this.definition = definition;
    this.options = options;

    this.getValue = extractGetter(definition);
    this.formatValue = extractFormatFromChannelDef(definition);

    this.scale = extractScale(this.type, definition, options.namespace);
    // Has to extract axis after format and scale
    if (
      this.isXY() &&
      isNonValueDef(this.definition) &&
      (('axis' in this.definition && isEnabled(this.definition.axis)) ||
        !('axis' in this.definition))
    ) {
      this.axis = new AxisAgent<Def, Output>(this);
    }

    this.encodeValue = this.scale ? this.scale.encodeValue : identity;
    this.encode = this.encode.bind(this);
    this.format = this.format.bind(this);
    this.get = this.get.bind(this);
  }

  encode(datum: PlainObject, otherwise?: Output) {
    const value = this.get(datum);
    if (value === null || value === undefined) {
      return value;
    }

    const output = this.encodeValue(value);

    return otherwise !== undefined && (output === null || output === undefined)
      ? otherwise
      : output;
  }

  format(datum: PlainObject): string {
    return this.formatValue(this.get(datum));
  }

  get(datum: PlainObject, otherwise?: any) {
    const value = this.getValue(datum);

    return otherwise !== undefined && (value === null || value === undefined) ? otherwise : value;
  }

  getTitle() {
    if (isFieldDef(this.definition)) {
      return this.definition.title || this.definition.field;
    }

    return '';
  }

  hasLegend() {
    if (isDisabled(this.options.legend) || this.isXY() || isValueDef(this.definition)) {
      return false;
    }
    if (isMarkPropFieldDef(this.definition)) {
      return isEnabled(this.definition.legend);
    }

    return isScaleFieldDef(this.definition);
  }

  isX() {
    return this.type === 'X' || this.type === 'XBand';
  }

  isXY() {
    return this.type === 'X' || this.type === 'Y' || this.type === 'XBand' || this.type === 'YBand';
  }

  isY() {
    return this.type === 'Y' || this.type === 'YBand';
  }
}

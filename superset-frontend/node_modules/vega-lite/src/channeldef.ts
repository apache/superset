import {LinearGradient, RadialGradient, Text} from 'vega';
import {isArray, isBoolean, isNumber, isString} from 'vega-util';
import {Aggregate, isAggregateOp, isArgmaxDef, isArgminDef, isCountingAggregateOp} from './aggregate';
import {Axis} from './axis';
import {autoMaxBins, Bin, BinParams, binToString, isBinned, isBinning} from './bin';
import {Channel, isScaleChannel, isSecondaryRangeChannel, POSITION_SCALE_CHANNELS, rangeType} from './channel';
import {getMarkConfig} from './compile/common';
import {CompositeAggregate} from './compositemark';
import {Config} from './config';
import {DateTime, dateTimeToExpr, isDateTime} from './datetime';
import {FormatMixins, Guide, TitleMixins} from './guide';
import {ImputeParams} from './impute';
import {Legend} from './legend';
import * as log from './log';
import {LogicalComposition} from './logical';
import {isRectBasedMark, MarkDef} from './mark';
import {Predicate} from './predicate';
import {Scale} from './scale';
import {isSortByChannel, Sort, SortOrder} from './sort';
import {isFacetFieldDef} from './spec/facet';
import {StackOffset} from './stack';
import {
  getTimeUnitParts,
  normalizeTimeUnit,
  TimeUnit,
  TimeUnitParams,
  timeUnitToString,
  isLocalSingleTimeUnit
} from './timeunit';
import {AggregatedFieldDef, WindowFieldDef} from './transform';
import {getFullName, QUANTITATIVE, StandardType, Type} from './type';
import {contains, flatAccessWithDatum, getFirstDefined, internalField, replacePathInField, titlecase} from './util';

export type Value = number | string | boolean | null;
export type Gradient = LinearGradient | RadialGradient;
export type ValueOrGradient = Value | Gradient;

export type ValueOrGradientOrText = Value | Gradient | Text;

/**
 * Definition object for a constant value (primitive value or gradient definition) of an encoding channel.
 */
export interface ValueDef<V extends ValueOrGradient | Value[] = Value> {
  /**
   * A constant value in visual domain (e.g., `"red"` / `"#0099ff"` / [gradient definition](https://vega.github.io/vega-lite/docs/types.html#gradient) for color, values between `0` to `1` for opacity).
   */
  value: V;
}

/**
 * Generic type for conditional channelDef.
 * F defines the underlying FieldDef type.
 */

export type ChannelDefWithCondition<F extends FieldDef<any>, V extends ValueOrGradientOrText = Value> =
  | FieldDefWithCondition<F, V>
  | ValueDefWithCondition<F, V>;

/**
 * A ValueDef with Condition<ValueDef | FieldDef> where either the condition or the value are optional.
 * {
 *   condition: {field: ...} | {value: ...},
 *   value: ...,
 * }
 */

/**
 * @minProperties 1
 */
export type ValueDefWithCondition<F extends FieldDef<any>, V extends ValueOrGradientOrText = Value> = Partial<
  ValueDef<V>
> & {
  /**
   * A field definition or one or more value definition(s) with a selection predicate.
   */
  condition?: Conditional<F> | Conditional<ValueDef<V>> | Conditional<ValueDef<V>>[];
};

export type StringValueDefWithCondition<F extends Field, T extends Type = StandardType> = ValueDefWithCondition<
  MarkPropFieldDef<F, T>,
  string | null
>;

export type ColorGradientValueDefWithCondition<F extends Field, T extends Type = StandardType> = ValueDefWithCondition<
  MarkPropFieldDef<F, T>,
  Gradient | string | null
>;

export type NumericValueDefWithCondition<F extends Field> = ValueDefWithCondition<
  MarkPropFieldDef<F, StandardType>,
  number
>;

export type TypeForShape = 'nominal' | 'ordinal' | 'geojson';

export type ShapeValueDefWithCondition<F extends Field> = StringValueDefWithCondition<F, TypeForShape>;

export type TextValueDefWithCondition<F extends Field> = ValueDefWithCondition<StringFieldDef<F>, Text>;

export type Conditional<CD extends FieldDef<any> | ValueDef<any>> = ConditionalPredicate<CD> | ConditionalSelection<CD>;

export type ConditionalPredicate<CD extends FieldDef<any> | ValueDef<any>> = {
  /**
   * Predicate for triggering the condition
   */
  test: LogicalComposition<Predicate>;
} & CD;

export type ConditionalSelection<CD extends FieldDef<any> | ValueDef<any>> = {
  /**
   * A [selection name](https://vega.github.io/vega-lite/docs/selection.html), or a series of [composed selections](https://vega.github.io/vega-lite/docs/selection.html#compose).
   */
  selection: LogicalComposition<string>;
} & CD;

export function isConditionalSelection<T>(c: Conditional<T>): c is ConditionalSelection<T> {
  return c['selection'];
}

export interface ConditionValueDefMixins<V extends ValueOrGradientOrText = Value> {
  /**
   * One or more value definition(s) with [a selection or a test predicate](https://vega.github.io/vega-lite/docs/condition.html).
   *
   * __Note:__ A field definition's `condition` property can only contain [conditional value definitions](https://vega.github.io/vega-lite/docs/condition.html#value)
   * since Vega-Lite only allows at most one encoded field per encoding channel.
   */
  condition?: Conditional<ValueDef<V>> | Conditional<ValueDef<V>>[];
}

/**
 * A FieldDef with Condition<ValueDef>
 * {
 *   condition: {value: ...},
 *   field: ...,
 *   ...
 * }
 */

export type FieldDefWithCondition<F extends FieldDef<any>, V extends ValueOrGradientOrText = Value> = F &
  ConditionValueDefMixins<V>;

export type ColorGradientFieldDefWithCondition<F extends Field, T extends Type = StandardType> = FieldDefWithCondition<
  MarkPropFieldDef<F, T>,
  Gradient | string | null
>;

export type NumericFieldDefWithCondition<F extends Field> = FieldDefWithCondition<
  MarkPropFieldDef<F, StandardType>,
  number
>;

export type ShapeFieldDefWithCondition<F extends Field> = FieldDefWithCondition<
  MarkPropFieldDef<F, TypeForShape>,
  string | null
>;

export type TextFieldDefWithCondition<F extends Field> = FieldDefWithCondition<StringFieldDef<F>, Text>;

export type StringFieldDefWithCondition<F extends Field> = FieldDefWithCondition<StringFieldDef<F>, string>;

/**
 * A ValueDef with optional Condition<ValueDef | FieldDef>
 * {
 *   condition: {field: ...} | {value: ...},
 *   value: ...,
 * }
 */

/**
 * Reference to a repeated value.
 */
export interface RepeatRef {
  repeat: 'row' | 'column' | 'repeat';
}

export type FieldName = string;
export type Field = FieldName | RepeatRef;

export function isRepeatRef(field: Field): field is RepeatRef {
  return field && !isString(field) && 'repeat' in field;
}

/** @@hidden */
export type HiddenCompositeAggregate = CompositeAggregate;

export interface FieldDefBase<F, B extends Bin = Bin> {
  /**
   * __Required.__ A string defining the name of the field from which to pull a data value
   * or an object defining iterated values from the [`repeat`](https://vega.github.io/vega-lite/docs/repeat.html) operator.
   *
   * __See also:__ [`field`](https://vega.github.io/vega-lite/docs/field.html) documentation.
   *
   * __Notes:__
   * 1)  Dots (`.`) and brackets (`[` and `]`) can be used to access nested objects (e.g., `"field": "foo.bar"` and `"field": "foo['bar']"`).
   * If field names contain dots or brackets but are not nested, you can use `\\` to escape dots and brackets (e.g., `"a\\.b"` and `"a\\[0\\]"`).
   * See more details about escaping in the [field documentation](https://vega.github.io/vega-lite/docs/field.html).
   * 2) `field` is not required if `aggregate` is `count`.
   */
  field?: F;

  // function

  /**
   * Time unit (e.g., `year`, `yearmonth`, `month`, `hours`) for a temporal field.
   * or [a temporal field that gets casted as ordinal](https://vega.github.io/vega-lite/docs/type.html#cast).
   *
   * __Default value:__ `undefined` (None)
   *
   * __See also:__ [`timeUnit`](https://vega.github.io/vega-lite/docs/timeunit.html) documentation.
   */
  timeUnit?: TimeUnit | TimeUnitParams;

  /**
   * Aggregation function for the field
   * (e.g., `"mean"`, `"sum"`, `"median"`, `"min"`, `"max"`, `"count"`).
   *
   * __Default value:__ `undefined` (None)
   *
   * __See also:__ [`aggregate`](https://vega.github.io/vega-lite/docs/aggregate.html) documentation.
   */
  aggregate?: Aggregate | HiddenCompositeAggregate;

  /**
   * A flag for binning a `quantitative` field, [an object defining binning parameters](https://vega.github.io/vega-lite/docs/bin.html#params), or indicating that the data for `x` or `y` channel are binned before they are imported into Vega-Lite (`"binned"`).
   *
   * - If `true`, default [binning parameters](https://vega.github.io/vega-lite/docs/bin.html) will be applied.
   *
   * - If `"binned"`, this indicates that the data for the `x` (or `y`) channel are already binned. You can map the bin-start field to `x` (or `y`) and the bin-end field to `x2` (or `y2`). The scale and axis will be formatted similar to binning in Vega-Lite.  To adjust the axis ticks based on the bin step, you can also set the axis's [`tickMinStep`](https://vega.github.io/vega-lite/docs/axis.html#ticks) property.
   *
   * __Default value:__ `false`
   *
   * __See also:__ [`bin`](https://vega.github.io/vega-lite/docs/bin.html) documentation.
   */
  bin?: B;
}

export function toFieldDefBase(fieldDef: TypedFieldDef<string>): FieldDefBase<string> {
  const {field, timeUnit, bin, aggregate} = fieldDef;
  return {
    ...(timeUnit ? {timeUnit} : {}),
    ...(bin ? {bin} : {}),
    ...(aggregate ? {aggregate} : {}),
    field
  };
}

export interface TypeMixins<T extends Type> {
  /**
   * The encoded field's type of measurement (`"quantitative"`, `"temporal"`, `"ordinal"`, or `"nominal"`).
   * It can also be a `"geojson"` type for encoding ['geoshape'](https://vega.github.io/vega-lite/docs/geoshape.html).
   *
   *
   * __Note:__
   *
   * - Data values for a temporal field can be either a date-time string (e.g., `"2015-03-07 12:32:17"`, `"17:01"`, `"2015-03-16"`. `"2015"`) or a timestamp number (e.g., `1552199579097`).
   * - Data `type` describes the semantics of the data rather than the primitive data types (number, string, etc.). The same primitive data type can have different types of measurement. For example, numeric data can represent quantitative, ordinal, or nominal data.
   * - When using with [`bin`](https://vega.github.io/vega-lite/docs/bin.html), the `type` property can be either `"quantitative"` (for using a linear bin scale) or [`"ordinal"` (for using an ordinal bin scale)](https://vega.github.io/vega-lite/docs/type.html#cast-bin).
   * - When using with [`timeUnit`](https://vega.github.io/vega-lite/docs/timeunit.html), the `type` property can be either `"temporal"` (for using a temporal scale) or [`"ordinal"` (for using an ordinal scale)](https://vega.github.io/vega-lite/docs/type.html#cast-bin).
   * - When using with [`aggregate`](https://vega.github.io/vega-lite/docs/aggregate.html), the `type` property refers to the post-aggregation data type. For example, we can calculate count `distinct` of a categorical field `"cat"` using `{"aggregate": "distinct", "field": "cat", "type": "quantitative"}`. The `"type"` of the aggregate output is `"quantitative"`.
   * - Secondary channels (e.g., `x2`, `y2`, `xError`, `yError`) do not have `type` as they have exactly the same type as their primary channels (e.g., `x`, `y`).
   *
   * __See also:__ [`type`](https://vega.github.io/vega-lite/docs/type.html) documentation.
   */
  type: T;
}

/**
 *  Definition object for a data field, its type and transformation of an encoding channel.
 */
export type TypedFieldDef<
  F extends Field,
  T extends Type = Type,
  B extends Bin = boolean | BinParams | 'binned' | null // This is equivalent to Bin but we use the full form so the docs has detailed types
> = FieldDefBase<F, B> & TitleMixins & TypeMixins<T>;

export interface SortableFieldDef<
  F extends Field,
  T extends Type = StandardType,
  B extends Bin = boolean | BinParams | null
> extends TypedFieldDef<F, T, B> {
  /**
   * Sort order for the encoded field.
   *
   * For continuous fields (quantitative or temporal), `sort` can be either `"ascending"` or `"descending"`.
   *
   * For discrete fields, `sort` can be one of the following:
   * - `"ascending"` or `"descending"` -- for sorting by the values' natural order in JavaScript.
   * - [A string indicating an encoding channel name to sort by](https://vega.github.io/vega-lite/docs/sort.html#sort-by-encoding) (e.g., `"x"` or `"y"`) with an optional minus prefix for descending sort (e.g., `"-x"` to sort by x-field, descending). This channel string is short-form of [a sort-by-encoding definition](https://vega.github.io/vega-lite/docs/sort.html#sort-by-encoding). For example, `"sort": "-x"` is equivalent to `"sort": {"encoding": "x", "order": "descending"}`.
   * - [A sort field definition](https://vega.github.io/vega-lite/docs/sort.html#sort-field) for sorting by another field.
   * - [An array specifying the field values in preferred order](https://vega.github.io/vega-lite/docs/sort.html#sort-array). In this case, the sort order will obey the values in the array, followed by any unspecified values in their original order. For discrete time field, values in the sort array can be [date-time definition objects](types#datetime). In addition, for time units `"month"` and `"day"`, the values can be the month or day names (case insensitive) or their 3-letter initials (e.g., `"Mon"`, `"Tue"`).
   * - `null` indicating no sort.
   *
   * __Default value:__ `"ascending"`
   *
   * __Note:__ `null` and sorting by another channel is not supported for `row` and `column`.
   *
   * __See also:__ [`sort`](https://vega.github.io/vega-lite/docs/sort.html) documentation.
   */
  sort?: Sort<F>;
}

export function isSortableFieldDef<F extends Field>(fieldDef: FieldDef<F>): fieldDef is SortableFieldDef<F> {
  return isTypedFieldDef(fieldDef) && !!fieldDef['sort'];
}

export interface ScaleFieldDef<
  F extends Field,
  T extends Type = StandardType,
  B extends Bin = boolean | BinParams | null
> extends SortableFieldDef<F, T, B> {
  /**
   * An object defining properties of the channel's scale, which is the function that transforms values in the data domain (numbers, dates, strings, etc) to visual values (pixels, colors, sizes) of the encoding channels.
   *
   * If `null`, the scale will be [disabled and the data value will be directly encoded](https://vega.github.io/vega-lite/docs/scale.html#disable).
   *
   * __Default value:__ If undefined, default [scale properties](https://vega.github.io/vega-lite/docs/scale.html) are applied.
   *
   * __See also:__ [`scale`](https://vega.github.io/vega-lite/docs/scale.html) documentation.
   */
  scale?: Scale | null;
}

/**
 * A field definition of a secondary channel that shares a scale with another primary channel. For example, `x2`, `xError` and `xError2` share the same scale with `x`.
 */
export type SecondaryFieldDef<F extends Field> = FieldDefBase<F, null> & TitleMixins; // x2/y2 shouldn't have bin, but we keep bin property for simplicity of the codebase.

/**
 * Field Def without scale (and without bin: "binned" support).
 */
export type FieldDefWithoutScale<F extends Field, T extends Type = StandardType> = TypedFieldDef<F, T>;

export type LatLongFieldDef<F extends Field> = FieldDefBase<F, null> &
  TitleMixins &
  Partial<TypeMixins<'quantitative'>>; // Lat long shouldn't have bin, but we keep bin property for simplicity of the codebase.

export interface PositionFieldDef<F extends Field>
  extends ScaleFieldDef<
    F,
    StandardType,
    boolean | BinParams | 'binned' | null // This is equivalent to Bin but we use the full form so the docs has detailed types
  > {
  /**
   * An object defining properties of axis's gridlines, ticks and labels.
   * If `null`, the axis for the encoding channel will be removed.
   *
   * __Default value:__ If undefined, default [axis properties](https://vega.github.io/vega-lite/docs/axis.html) are applied.
   *
   * __See also:__ [`axis`](https://vega.github.io/vega-lite/docs/axis.html) documentation.
   */
  axis?: Axis | null;

  /**
   * Type of stacking offset if the field should be stacked.
   * `stack` is only applicable for `x` and `y` channels with continuous domains.
   * For example, `stack` of `y` can be used to customize stacking for a vertical bar chart.
   *
   * `stack` can be one of the following values:
   * - `"zero"` or `true`: stacking with baseline offset at zero value of the scale (for creating typical stacked [bar](https://vega.github.io/vega-lite/docs/stack.html#bar) and [area](https://vega.github.io/vega-lite/docs/stack.html#area) chart).
   * - `"normalize"` - stacking with normalized domain (for creating [normalized stacked bar and area charts](https://vega.github.io/vega-lite/docs/stack.html#normalized). <br/>
   * -`"center"` - stacking with center baseline (for [streamgraph](https://vega.github.io/vega-lite/docs/stack.html#streamgraph)).
   * - `null` or `false` - No-stacking. This will produce layered [bar](https://vega.github.io/vega-lite/docs/stack.html#layered-bar-chart) and area chart.
   *
   * __Default value:__ `zero` for plots with all of the following conditions are true:
   * (1) the mark is `bar` or `area`;
   * (2) the stacked measure channel (x or y) has a linear scale;
   * (3) At least one of non-position channels mapped to an unaggregated field that is different from x and y. Otherwise, `null` by default.
   *
   * __See also:__ [`stack`](https://vega.github.io/vega-lite/docs/stack.html) documentation.
   */
  stack?: StackOffset | null | boolean;

  /**
   * An object defining the properties of the Impute Operation to be applied.
   * The field value of the other positional channel is taken as `key` of the `Impute` Operation.
   * The field of the `color` channel if specified is used as `groupby` of the `Impute` Operation.
   *
   * __See also:__ [`impute`](https://vega.github.io/vega-lite/docs/impute.html) documentation.
   */
  impute?: ImputeParams | null;

  /**
   * For rect-based marks (`rect`, `bar`, and `image`), mark size relative to bandwidth of [band scales](https://vega.github.io/vega-lite/docs/scale.html#band) or time units. If set to `1`, the mark size is set to the bandwidth or the time unit interval. If set to `0.5`, the mark size is half of the bandwidth or the time unit interval.
   *
   * For other marks, relative position on a band of a stacked, binned, time unit or band scale. If set to `0`, the marks will be positioned at the beginning of the band. If set to `0.5`, the marks will be positioned in the middle of the band.
   *
   * @minimum 0
   * @maximum 1
   */
  band?: number;
}

export function getBand(
  channel: Channel,
  fieldDef: FieldDef<string>,
  fieldDef2: ChannelDef<SecondaryFieldDef<string>>,
  mark: MarkDef,
  config: Config,
  {isMidPoint}: {isMidPoint?: boolean} = {}
) {
  const {timeUnit, bin} = fieldDef;
  if (contains(['x', 'y'], channel)) {
    if (isPositionFieldDef(fieldDef) && fieldDef.band !== undefined) {
      return fieldDef.band;
    } else if (timeUnit && !fieldDef2) {
      if (isMidPoint) {
        return getMarkConfig('timeUnitBandPosition', mark, config);
      } else {
        return isRectBasedMark(mark.type) ? getMarkConfig('timeUnitBand', mark, config) : 0;
      }
    } else if (isBinning(bin)) {
      return isRectBasedMark(mark.type) && !isMidPoint ? 1 : 0.5;
    }
  }
  return undefined;
}

export function hasBand(
  channel: Channel,
  fieldDef: FieldDef<string>,
  fieldDef2: ChannelDef<SecondaryFieldDef<string>>,
  mark: MarkDef,
  config: Config
) {
  if (isBinning(fieldDef.bin) || (fieldDef.timeUnit && isTypedFieldDef(fieldDef) && fieldDef.type === 'temporal')) {
    return !!getBand(channel, fieldDef, fieldDef2, mark, config);
  }
  return false;
}

/**
 * Field definition of a mark property, which can contain a legend.
 */
export type MarkPropFieldDef<F extends Field, T extends Type = Type> = ScaleFieldDef<
  F,
  T,
  boolean | BinParams | null
> & {
  /**
   * An object defining properties of the legend.
   * If `null`, the legend for the encoding channel will be removed.
   *
   * __Default value:__ If undefined, default [legend properties](https://vega.github.io/vega-lite/docs/legend.html) are applied.
   *
   * __See also:__ [`legend`](https://vega.github.io/vega-lite/docs/legend.html) documentation.
   */
  legend?: Legend | null;
};

// Detail

// Order Path have no scale

export interface OrderFieldDef<F extends Field> extends FieldDefWithoutScale<F> {
  /**
   * The sort order. One of `"ascending"` (default) or `"descending"`.
   */
  sort?: SortOrder;
}

export interface StringFieldDef<F extends Field> extends FieldDefWithoutScale<F, StandardType>, FormatMixins {}

export type FieldDef<F extends Field> = SecondaryFieldDef<F> | TypedFieldDef<F>;
export type ChannelDef<
  FD extends FieldDef<any> = FieldDef<string>,
  V extends ValueOrGradientOrText = ValueOrGradientOrText
> = ChannelDefWithCondition<FD, V>;

export function isConditionalDef<F extends Field, V extends ValueOrGradientOrText>(
  channelDef: ChannelDef<FieldDef<F>, V>
): channelDef is ChannelDefWithCondition<FieldDef<F>, V> {
  return !!channelDef && !!channelDef.condition;
}

/**
 * Return if a channelDef is a ConditionalValueDef with ConditionFieldDef
 */
export function hasConditionalFieldDef<F extends Field, V extends ValueOrGradientOrText>(
  channelDef: ChannelDef<FieldDef<F>, V>
): channelDef is Partial<ValueDef<V>> & {condition: Conditional<TypedFieldDef<F>>} {
  return !!channelDef && !!channelDef.condition && !isArray(channelDef.condition) && isFieldDef(channelDef.condition);
}

export function hasConditionalValueDef<F extends Field, V extends ValueOrGradient>(
  channelDef: ChannelDef<FieldDef<F>, V>
): channelDef is ValueDef<V> & {condition: Conditional<ValueDef<V>> | Conditional<ValueDef<V>>[]} {
  return !!channelDef && !!channelDef.condition && (isArray(channelDef.condition) || isValueDef(channelDef.condition));
}

export function isFieldDef<F extends Field>(
  channelDef: ChannelDef<FieldDef<F>>
): channelDef is
  | TypedFieldDef<F>
  | SecondaryFieldDef<F>
  | PositionFieldDef<F>
  | ScaleFieldDef<F>
  | MarkPropFieldDef<F>
  | OrderFieldDef<F>
  | StringFieldDef<F> {
  return !!channelDef && (!!channelDef['field'] || channelDef['aggregate'] === 'count');
}

export function isTypedFieldDef<F extends Field>(channelDef: ChannelDef<FieldDef<F>>): channelDef is TypedFieldDef<F> {
  return !!channelDef && ((!!channelDef['field'] && !!channelDef['type']) || channelDef['aggregate'] === 'count');
}

export function isStringFieldDef(channelDef: ChannelDef<FieldDef<Field>>): channelDef is TypedFieldDef<string> {
  return isFieldDef(channelDef) && isString(channelDef.field);
}

export function isValueDef<F extends Field, V extends ValueOrGradientOrText>(
  channelDef: ChannelDef<FieldDef<F>, V>
): channelDef is ValueDef<V> {
  return channelDef && 'value' in channelDef && channelDef['value'] !== undefined;
}

export function isScaleFieldDef<F extends Field>(channelDef: ChannelDef<FieldDef<F>>): channelDef is ScaleFieldDef<F> {
  return !!channelDef && (!!channelDef['scale'] || !!channelDef['sort']);
}

export function isPositionFieldDef<F extends Field>(
  channelDef: ChannelDef<FieldDef<F>>
): channelDef is PositionFieldDef<F> {
  return (
    !!channelDef &&
    (!!channelDef['axis'] || !!channelDef['stack'] || !!channelDef['impute'] || channelDef['band'] !== undefined)
  );
}

export function isMarkPropFieldDef<F extends Field>(
  channelDef: ChannelDef<FieldDef<F>>
): channelDef is MarkPropFieldDef<F> {
  return !!channelDef && !!channelDef['legend'];
}

export function isTextFieldDef<F extends Field>(channelDef: ChannelDef<FieldDef<F>>): channelDef is StringFieldDef<F> {
  return !!channelDef && !!channelDef['format'];
}

export interface FieldRefOption {
  /** Exclude bin, aggregate, timeUnit */
  nofn?: boolean;
  /** Wrap the field with datum, parent, or datum.datum (e.g., datum['...'] for Vega Expression */
  expr?: 'datum' | 'parent' | 'datum.datum';
  /** Prepend fn with custom function prefix */
  prefix?: string;
  /** Append suffix to the field ref for bin (default='start') */
  binSuffix?: 'end' | 'range' | 'mid';
  /** Append suffix to the field ref (general) */
  suffix?: string;
  /**
   * Use the field name for `as` in a transform.
   * We will not escape nested accesses because Vega transform outputs cannot be nested.
   */
  forAs?: boolean;
}

function isOpFieldDef(
  fieldDef: FieldDefBase<string> | WindowFieldDef | AggregatedFieldDef
): fieldDef is WindowFieldDef | AggregatedFieldDef {
  return !!fieldDef['op'];
}

/**
 * Get a Vega field reference from a Vega-Lite field def.
 */
export function vgField(
  fieldDef: FieldDefBase<string> | WindowFieldDef | AggregatedFieldDef,
  opt: FieldRefOption = {}
): string {
  let field = fieldDef.field;
  const prefix = opt.prefix;
  let suffix = opt.suffix;

  let argAccessor = ''; // for accessing argmin/argmax field at the end without getting escaped

  if (isCount(fieldDef)) {
    field = internalField('count');
  } else {
    let fn: string;

    if (!opt.nofn) {
      if (isOpFieldDef(fieldDef)) {
        fn = fieldDef.op;
      } else {
        const {bin, aggregate, timeUnit} = fieldDef;
        if (isBinning(bin)) {
          fn = binToString(bin);
          suffix = (opt.binSuffix ?? '') + (opt.suffix ?? '');
        } else if (aggregate) {
          if (isArgmaxDef(aggregate)) {
            argAccessor = `.${field}`;
            field = `argmax_${aggregate.argmax}`;
          } else if (isArgminDef(aggregate)) {
            argAccessor = `.${field}`;
            field = `argmin_${aggregate.argmin}`;
          } else {
            fn = String(aggregate);
          }
        } else if (timeUnit) {
          fn = timeUnitToString(timeUnit);
          suffix = ((!contains(['range', 'mid'], opt.binSuffix) && opt.binSuffix) || '') + (opt.suffix ?? '');
        }
      }
    }

    if (fn) {
      field = field ? `${fn}_${field}` : fn;
    }
  }

  if (suffix) {
    field = `${field}_${suffix}`;
  }

  if (prefix) {
    field = `${prefix}_${field}`;
  }

  if (opt.forAs) {
    return field;
  } else if (opt.expr) {
    // Expression to access flattened field. No need to escape dots.
    return flatAccessWithDatum(field, opt.expr) + argAccessor;
  } else {
    // We flattened all fields so paths should have become dot.
    return replacePathInField(field) + argAccessor;
  }
}

export function isDiscrete(fieldDef: TypedFieldDef<Field>) {
  switch (fieldDef.type) {
    case 'nominal':
    case 'ordinal':
    case 'geojson':
      return true;
    case 'quantitative':
      return !!fieldDef.bin;
    case 'temporal':
      return false;
  }
  throw new Error(log.message.invalidFieldType(fieldDef.type));
}

export function isContinuous(fieldDef: TypedFieldDef<Field>) {
  return !isDiscrete(fieldDef);
}

export function isCount(fieldDef: FieldDefBase<Field>) {
  return fieldDef.aggregate === 'count';
}

export type FieldTitleFormatter = (fieldDef: FieldDefBase<string>, config: Config) => string;

export function verbalTitleFormatter(fieldDef: FieldDefBase<string>, config: Config) {
  const {field, bin, timeUnit, aggregate} = fieldDef;
  if (aggregate === 'count') {
    return config.countTitle;
  } else if (isBinning(bin)) {
    return `${field} (binned)`;
  } else if (timeUnit) {
    const unit = normalizeTimeUnit(timeUnit)?.unit;
    if (unit) {
      return `${field} (${getTimeUnitParts(unit).join('-')})`;
    }
  } else if (aggregate) {
    if (isArgmaxDef(aggregate)) {
      return `${field} for max ${aggregate.argmax}`;
    } else if (isArgminDef(aggregate)) {
      return `${field} for min ${aggregate.argmin}`;
    } else {
      return `${titlecase(aggregate)} of ${field}`;
    }
  }
  return field;
}

export function functionalTitleFormatter(fieldDef: FieldDefBase<string>) {
  const {aggregate, bin, timeUnit, field} = fieldDef;
  if (isArgmaxDef(aggregate)) {
    return `${field} for argmax(${aggregate.argmax})`;
  } else if (isArgminDef(aggregate)) {
    return `${field} for argmin(${aggregate.argmin})`;
  }

  const timeUnitParams = normalizeTimeUnit(timeUnit);

  const fn = aggregate || timeUnitParams?.unit || (timeUnitParams?.maxbins && 'timeunit') || (isBinning(bin) && 'bin');
  if (fn) {
    return fn.toUpperCase() + '(' + field + ')';
  } else {
    return field;
  }
}

export const defaultTitleFormatter: FieldTitleFormatter = (fieldDef: FieldDefBase<string>, config: Config) => {
  switch (config.fieldTitle) {
    case 'plain':
      return fieldDef.field;
    case 'functional':
      return functionalTitleFormatter(fieldDef);
    default:
      return verbalTitleFormatter(fieldDef, config);
  }
};

let titleFormatter = defaultTitleFormatter;

export function setTitleFormatter(formatter: FieldTitleFormatter) {
  titleFormatter = formatter;
}

export function resetTitleFormatter() {
  setTitleFormatter(defaultTitleFormatter);
}

export function title(
  fieldDef: TypedFieldDef<string> | SecondaryFieldDef<string>,
  config: Config,
  {allowDisabling, includeDefault = true}: {allowDisabling: boolean; includeDefault?: boolean}
) {
  const guide = getGuide(fieldDef) ?? {};
  const guideTitle = guide.title;
  const def = includeDefault ? defaultTitle(fieldDef, config) : undefined;

  if (allowDisabling) {
    return getFirstDefined(guideTitle, fieldDef.title, def);
  } else {
    return guideTitle ?? fieldDef.title ?? def;
  }
}

export function getGuide(fieldDef: TypedFieldDef<string> | SecondaryFieldDef<string>): Guide {
  if (isPositionFieldDef(fieldDef) && fieldDef.axis) {
    return fieldDef.axis;
  } else if (isMarkPropFieldDef(fieldDef) && fieldDef.legend) {
    return fieldDef.legend;
  } else if (isFacetFieldDef(fieldDef) && fieldDef.header) {
    return fieldDef.header;
  }
  return undefined;
}

export function defaultTitle(fieldDef: FieldDefBase<string>, config: Config) {
  return titleFormatter(fieldDef, config);
}

export function format(fieldDef: TypedFieldDef<string>) {
  if (isTextFieldDef(fieldDef) && fieldDef.format) {
    return fieldDef.format;
  } else {
    const guide = getGuide(fieldDef) ?? {};
    return guide.format;
  }
}

export function defaultType(fieldDef: TypedFieldDef<Field>, channel: Channel): Type {
  if (fieldDef.timeUnit) {
    return 'temporal';
  }
  if (isBinning(fieldDef.bin)) {
    return 'quantitative';
  }
  switch (rangeType(channel)) {
    case 'continuous':
      return 'quantitative';
    case 'discrete':
      return 'nominal';
    case 'flexible': // color
      return 'nominal';
    default:
      return 'quantitative';
  }
}

/**
 * Returns the fieldDef -- either from the outer channelDef or from the condition of channelDef.
 * @param channelDef
 */

export function getFieldDef<F extends Field>(channelDef: ChannelDef<FieldDef<F>>): FieldDef<F> {
  if (isFieldDef(channelDef)) {
    return channelDef;
  } else if (hasConditionalFieldDef(channelDef)) {
    return channelDef.condition;
  }
  return undefined;
}

export function getTypedFieldDef<F extends Field>(channelDef: ChannelDef<TypedFieldDef<F>>): TypedFieldDef<F> {
  if (isFieldDef(channelDef)) {
    return channelDef;
  } else if (hasConditionalFieldDef(channelDef)) {
    return channelDef.condition;
  }
  return undefined;
}

/**
 * Convert type to full, lowercase type, or augment the fieldDef with a default type if missing.
 */
export function normalize(channelDef: ChannelDef, channel: Channel): ChannelDef<any> {
  if (isString(channelDef) || isNumber(channelDef) || isBoolean(channelDef)) {
    const primitiveType = isString(channelDef) ? 'string' : isNumber(channelDef) ? 'number' : 'boolean';
    log.warn(log.message.primitiveChannelDef(channel, primitiveType, channelDef));
    return {value: channelDef};
  }

  // If a fieldDef contains a field, we need type.
  if (isFieldDef(channelDef)) {
    return normalizeFieldDef(channelDef, channel);
  } else if (hasConditionalFieldDef(channelDef)) {
    return {
      ...channelDef,
      // Need to cast as normalizeFieldDef normally return FieldDef, but here we know that it is definitely Condition<FieldDef>
      condition: normalizeFieldDef(channelDef.condition, channel) as Conditional<TypedFieldDef<string>>
    };
  }
  return channelDef;
}
export function normalizeFieldDef(fd: FieldDef<string>, channel: Channel) {
  const {aggregate, timeUnit, bin, field} = fd;
  const fieldDef = {...fd};

  // Drop invalid aggregate
  if (aggregate && !isAggregateOp(aggregate) && !isArgmaxDef(aggregate) && !isArgminDef(aggregate)) {
    log.warn(log.message.invalidAggregate(aggregate));
    delete fieldDef.aggregate;
  }

  // Normalize Time Unit
  if (timeUnit) {
    fieldDef.timeUnit = normalizeTimeUnit(timeUnit);
  }

  if (field) {
    fieldDef.field = `${field}`;
  }

  // Normalize bin
  if (isBinning(bin)) {
    fieldDef.bin = normalizeBin(bin, channel);
  }

  if (isBinned(bin) && !contains(POSITION_SCALE_CHANNELS, channel)) {
    log.warn(`Channel ${channel} should not be used with "binned" bin`);
  }

  // Normalize Type
  if (isTypedFieldDef(fieldDef)) {
    const {type} = fieldDef;
    const fullType = getFullName(type);
    if (type !== fullType) {
      // convert short type to full type
      fieldDef.type = fullType;
    }
    if (type !== 'quantitative') {
      if (isCountingAggregateOp(aggregate)) {
        log.warn(log.message.invalidFieldTypeForCountAggregate(type, aggregate));
        fieldDef.type = 'quantitative';
      }
    }
  } else if (!isSecondaryRangeChannel(channel)) {
    // If type is empty / invalid, then augment with default type
    const newType = defaultType(fieldDef as TypedFieldDef<any>, channel);
    log.warn(log.message.missingFieldType(channel, newType));

    fieldDef['type'] = newType;
  }

  if (isTypedFieldDef(fieldDef)) {
    const {compatible, warning} = channelCompatibility(fieldDef, channel);
    if (!compatible) {
      log.warn(warning);
    }
  }

  if (isSortableFieldDef(fieldDef) && isString(fieldDef.sort)) {
    const {sort} = fieldDef;
    if (isSortByChannel(sort)) {
      return {
        ...fieldDef,
        sort: {encoding: sort}
      };
    }
    const sub = sort.substr(1);
    if (sort.charAt(0) === '-' && isSortByChannel(sub)) {
      return {
        ...fieldDef,
        sort: {encoding: sub, order: 'descending'}
      };
    }
  }

  return fieldDef;
}

export function normalizeBin(bin: BinParams | boolean | 'binned', channel?: Channel) {
  if (isBoolean(bin)) {
    return {maxbins: autoMaxBins(channel)};
  } else if (bin === 'binned') {
    return {
      binned: true
    };
  } else if (!bin.maxbins && !bin.step) {
    return {...bin, maxbins: autoMaxBins(channel)};
  } else {
    return bin;
  }
}

const COMPATIBLE = {compatible: true};
export function channelCompatibility(
  fieldDef: TypedFieldDef<Field>,
  channel: Channel
): {compatible: boolean; warning?: string} {
  const type = fieldDef.type;

  if (type === 'geojson' && channel !== 'shape') {
    return {
      compatible: false,
      warning: `Channel ${channel} should not be used with a geojson data.`
    };
  }

  switch (channel) {
    case 'row':
    case 'column':
    case 'facet':
      if (isContinuous(fieldDef)) {
        return {
          compatible: false,
          warning: log.message.facetChannelShouldBeDiscrete(channel)
        };
      }
      return COMPATIBLE;

    case 'x':
    case 'y':
    case 'color':
    case 'fill':
    case 'stroke':
    case 'text':
    case 'detail':
    case 'key':
    case 'tooltip':
    case 'href':
    case 'url':
      return COMPATIBLE;

    case 'longitude':
    case 'longitude2':
    case 'latitude':
    case 'latitude2':
      if (type !== QUANTITATIVE) {
        return {
          compatible: false,
          warning: `Channel ${channel} should be used with a quantitative field only, not ${fieldDef.type} field.`
        };
      }
      return COMPATIBLE;

    case 'opacity':
    case 'fillOpacity':
    case 'strokeOpacity':
    case 'strokeWidth':
    case 'size':
    case 'x2':
    case 'y2':
      if (type === 'nominal' && !fieldDef['sort']) {
        return {
          compatible: false,
          warning: `Channel ${channel} should not be used with an unsorted discrete field.`
        };
      }
      return COMPATIBLE;

    case 'shape':
      if (!contains(['ordinal', 'nominal', 'geojson'], fieldDef.type)) {
        return {
          compatible: false,
          warning: 'Shape channel should be used with only either discrete or geojson data.'
        };
      }
      return COMPATIBLE;

    case 'order':
      if (fieldDef.type === 'nominal' && !('sort' in fieldDef)) {
        return {
          compatible: false,
          warning: `Channel order is inappropriate for nominal field, which has no inherent order.`
        };
      }
      return COMPATIBLE;
  }
  throw new Error('channelCompatability not implemented for channel ' + channel);
}

/**
 * Check if the field def uses a time format or does not use any format but is temporal
 * (this does not cover field defs that are temporal but use a number format).
 */
export function isTimeFormatFieldDef(fieldDef: TypedFieldDef<string>): boolean {
  const guide = getGuide(fieldDef);
  const formatType = (guide && guide.formatType) || (isTextFieldDef(fieldDef) && fieldDef.formatType);
  return formatType === 'time' || (!formatType && isTimeFieldDef(fieldDef));
}

/**
 * Check if field def has tye `temporal`. If you want to also cover field defs that use a time format, use `isTimeFormatFieldDef`.
 */
export function isTimeFieldDef(fieldDef: TypedFieldDef<any>) {
  return fieldDef.type === 'temporal' || !!fieldDef.timeUnit;
}

/**
 * Getting a value associated with a fielddef.
 * Convert the value to Vega expression if applicable (for datetime object, or string if the field def is temporal or has timeUnit)
 */
export function valueExpr(
  v: number | string | boolean | DateTime,
  {
    timeUnit,
    type,
    time,
    undefinedIfExprNotRequired
  }: {
    timeUnit: TimeUnit | TimeUnitParams;
    type?: Type;
    time?: boolean;
    undefinedIfExprNotRequired?: boolean;
  }
): string {
  const unit = normalizeTimeUnit(timeUnit)?.unit;
  let expr;
  if (isDateTime(v)) {
    expr = dateTimeToExpr(v);
  } else if (isString(v) || isNumber(v)) {
    if (unit || type === 'temporal') {
      if (isLocalSingleTimeUnit(unit)) {
        expr = dateTimeToExpr({[unit]: v});
      } else {
        expr = `datetime(${JSON.stringify(v)})`;
      }
    }
  }
  if (expr) {
    return time ? `time(${expr})` : expr;
  }
  // number or boolean or normal string
  return undefinedIfExprNotRequired ? undefined : JSON.stringify(v);
}

/**
 * Standardize value array -- convert each value to Vega expression if applicable
 */
export function valueArray(fieldDef: TypedFieldDef<string>, values: (number | string | boolean | DateTime)[]) {
  const {type} = fieldDef;
  const timeUnit = normalizeTimeUnit(fieldDef.timeUnit)?.unit;
  return values.map(v => {
    const expr = valueExpr(v, {timeUnit, type, undefinedIfExprNotRequired: true});
    // return signal for the expression if we need an expression
    if (expr !== undefined) {
      return {signal: expr};
    }
    // otherwise just return the original value
    return v;
  });
}

/**
 * Checks whether a fieldDef for a particular channel requires a computed bin range.
 */
export function binRequiresRange(fieldDef: TypedFieldDef<string>, channel: Channel) {
  if (!isBinning(fieldDef.bin)) {
    console.warn('Only call this method for binned field defs.');
    return false;
  }

  // We need the range only when the user explicitly forces a binned field to be use discrete scale. In this case, bin range is used in axis and legend labels.
  // We could check whether the axis or legend exists (not disabled) but that seems overkill.
  return isScaleChannel(channel) && contains(['ordinal', 'nominal'], fieldDef.type);
}

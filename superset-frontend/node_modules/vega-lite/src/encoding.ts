import {AggregateOp} from 'vega';
import {array, isArray} from 'vega-util';
import {isArgmaxDef, isArgminDef} from './aggregate';
import {isBinned, isBinning} from './bin';
import {Channel, CHANNELS, isChannel, isNonPositionScaleChannel, isSecondaryRangeChannel, supportMark} from './channel';
import {
  binRequiresRange,
  ChannelDef,
  ColorGradientFieldDefWithCondition,
  ColorGradientValueDefWithCondition,
  Field,
  FieldDef,
  FieldDefWithoutScale,
  getFieldDef,
  getGuide,
  getTypedFieldDef,
  hasConditionalFieldDef,
  isConditionalDef,
  isFieldDef,
  isTypedFieldDef,
  isValueDef,
  LatLongFieldDef,
  normalize,
  normalizeFieldDef,
  NumericFieldDefWithCondition,
  NumericValueDefWithCondition,
  OrderFieldDef,
  PositionFieldDef,
  SecondaryFieldDef,
  ShapeFieldDefWithCondition,
  ShapeValueDefWithCondition,
  StringFieldDef,
  StringFieldDefWithCondition,
  StringValueDefWithCondition,
  TextFieldDefWithCondition,
  TextValueDefWithCondition,
  title,
  TypedFieldDef,
  ValueDef,
  ValueOrGradientOrText,
  vgField
} from './channeldef';
import {Config} from './config';
import * as log from './log';
import {Mark, MarkDef} from './mark';
import {EncodingFacetMapping} from './spec/facet';
import {AggregatedFieldDef, BinTransform, TimeUnitTransform} from './transform';
import {TEMPORAL} from './type';
import {keys, some} from './util';

export interface Encoding<F extends Field> {
  /**
   * X coordinates of the marks, or width of horizontal `"bar"` and `"area"` without specified `x2` or `width`.
   *
   * The `value` of this channel can be a number or a string `"width"` for the width of the plot.
   */
  x?: PositionFieldDef<F> | ValueDef<number | 'width'>;

  /**
   * Y coordinates of the marks, or height of vertical `"bar"` and `"area"` without specified `y2` or `height`.
   *
   * The `value` of this channel can be a number or a string `"height"` for the height of the plot.
   */
  y?: PositionFieldDef<F> | ValueDef<number | 'height'>;

  /**
   * X2 coordinates for ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   *
   * The `value` of this channel can be a number or a string `"width"` for the width of the plot.
   */
  // TODO: Ham need to add default behavior
  // `x2` cannot have type as it should have the same type as `x`
  x2?: SecondaryFieldDef<F> | ValueDef<number | 'width'>;

  /**
   * Y2 coordinates for ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   *
   * The `value` of this channel can be a number or a string `"height"` for the height of the plot.
   */
  // TODO: Ham need to add default behavior
  // `y2` cannot have type as it should have the same type as `y`
  y2?: SecondaryFieldDef<F> | ValueDef<number | 'height'>;

  /**
   * Longitude position of geographically projected marks.
   */
  longitude?: LatLongFieldDef<F> | ValueDef<number>;

  /**
   * Latitude position of geographically projected marks.
   */
  latitude?: LatLongFieldDef<F> | ValueDef<number>;

  /**
   * Longitude-2 position for geographically projected ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   */
  // `longitude2` cannot have type as it should have the same type as `longitude`
  longitude2?: SecondaryFieldDef<F> | ValueDef<number>;

  /**
   * Latitude-2 position for geographically projected ranged `"area"`, `"bar"`, `"rect"`, and  `"rule"`.
   */
  // `latitude2` cannot have type as it should have the same type as `latitude`
  latitude2?: SecondaryFieldDef<F> | ValueDef<number>;

  /**
   * Color of the marks – either fill or stroke color based on  the `filled` property of mark definition.
   * By default, `color` represents fill color for `"area"`, `"bar"`, `"tick"`,
   * `"text"`, `"trail"`, `"circle"`, and `"square"` / stroke color for `"line"` and `"point"`.
   *
   * __Default value:__ If undefined, the default color depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `color` property.
   *
   * _Note:_
   * 1) For fine-grained control over both fill and stroke colors of the marks, please use the `fill` and `stroke` channels. The `fill` or `stroke` encodings have higher precedence than `color`, thus may override the `color` encoding if conflicting encodings are specified.
   * 2) See the scale documentation for more information about customizing [color scheme](https://vega.github.io/vega-lite/docs/scale.html#scheme).
   */
  color?: ColorGradientFieldDefWithCondition<F> | ColorGradientValueDefWithCondition<F>;

  /**
   * Fill color of the marks.
   * __Default value:__ If undefined, the default color depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `color` property.
   *
   * _Note:_ The `fill` encoding has higher precedence than `color`, thus may override the `color` encoding if conflicting encodings are specified.
   */
  fill?: ColorGradientFieldDefWithCondition<F> | ColorGradientValueDefWithCondition<F>;

  /**
   * Stroke color of the marks.
   * __Default value:__ If undefined, the default color depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `color` property.
   *
   * _Note:_ The `stroke` encoding has higher precedence than `color`, thus may override the `color` encoding if conflicting encodings are specified.
   */

  stroke?: ColorGradientFieldDefWithCondition<F> | ColorGradientValueDefWithCondition<F>;

  /**
   * Opacity of the marks.
   *
   * __Default value:__ If undefined, the default opacity depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `opacity` property.
   */
  opacity?: NumericFieldDefWithCondition<F> | NumericValueDefWithCondition<F>;

  /**
   * Fill opacity of the marks.
   *
   * __Default value:__ If undefined, the default opacity depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `fillOpacity` property.
   */
  fillOpacity?: NumericFieldDefWithCondition<F> | NumericValueDefWithCondition<F>;

  /**
   * Stroke opacity of the marks.
   *
   * __Default value:__ If undefined, the default opacity depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `strokeOpacity` property.
   */
  strokeOpacity?: NumericFieldDefWithCondition<F> | NumericValueDefWithCondition<F>;

  /**
   * Stroke width of the marks.
   *
   * __Default value:__ If undefined, the default stroke width depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#mark)'s `strokeWidth` property.
   */
  strokeWidth?: NumericFieldDefWithCondition<F> | NumericValueDefWithCondition<F>;

  /**
   * Size of the mark.
   * - For `"point"`, `"square"` and `"circle"`, – the symbol size, or pixel area of the mark.
   * - For `"bar"` and `"tick"` – the bar and tick's size.
   * - For `"text"` – the text's font size.
   * - Size is unsupported for `"line"`, `"area"`, and `"rect"`. (Use `"trail"` instead of line with varying size)
   */
  size?: NumericFieldDefWithCondition<F> | NumericValueDefWithCondition<F>;

  /**
   * Shape of the mark.
   *
   * 1. For `point` marks the supported values include:
   *   - plotting shapes: `"circle"`, `"square"`, `"cross"`, `"diamond"`, `"triangle-up"`, `"triangle-down"`, `"triangle-right"`, or `"triangle-left"`.
   *   - the line symbol `"stroke"`
   *   - centered directional shapes `"arrow"`, `"wedge"`, or `"triangle"`
   *   - a custom [SVG path string](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths) (For correct sizing, custom shape paths should be defined within a square bounding box with coordinates ranging from -1 to 1 along both the x and y dimensions.)
   *
   * 2. For `geoshape` marks it should be a field definition of the geojson data
   *
   * __Default value:__ If undefined, the default shape depends on [mark config](https://vega.github.io/vega-lite/docs/config.html#point-config)'s `shape` property. (`"circle"` if unset.)
   */
  shape?: ShapeFieldDefWithCondition<F> | ShapeValueDefWithCondition<F>;
  /**
   * Additional levels of detail for grouping data in aggregate views and
   * in line, trail, and area marks without mapping data to a specific visual channel.
   */
  detail?: FieldDefWithoutScale<F> | FieldDefWithoutScale<F>[];

  /**
   * A data field to use as a unique key for data binding. When a visualization’s data is updated, the key value will be used to match data elements to existing mark instances. Use a key channel to enable object constancy for transitions over dynamic data.
   */
  key?: FieldDefWithoutScale<F>;

  /**
   * Text of the `text` mark.
   */
  text?: TextFieldDefWithCondition<F> | TextValueDefWithCondition<F>;

  /**
   * The tooltip text to show upon mouse hover. Specifying `tooltip` encoding overrides [the `tooltip` property in the mark definition](https://vega.github.io/vega-lite/docs/mark.html#mark-def).
   *
   * See the [`tooltip`](https://vega.github.io/vega-lite/docs/tooltip.html) documentation for a detailed discussion about tooltip in Vega-Lite.
   */
  tooltip?: StringFieldDefWithCondition<F> | StringValueDefWithCondition<F> | StringFieldDef<F>[] | null;

  /**
   * A URL to load upon mouse click.
   */
  href?: StringFieldDefWithCondition<F> | StringValueDefWithCondition<F>;

  /**
   * The URL of an image mark.
   */
  url?: StringFieldDefWithCondition<F> | StringValueDefWithCondition<F>;

  /**
   * Order of the marks.
   * - For stacked marks, this `order` channel encodes [stack order](https://vega.github.io/vega-lite/docs/stack.html#order).
   * - For line and trail marks, this `order` channel encodes order of data points in the lines. This can be useful for creating [a connected scatterplot](https://vega.github.io/vega-lite/examples/connected_scatterplot.html). Setting `order` to `{"value": null}` makes the line marks use the original order in the data sources.
   * - Otherwise, this `order` channel encodes layer order of the marks.
   *
   * __Note__: In aggregate plots, `order` field should be `aggregate`d to avoid creating additional aggregation grouping.
   */
  order?: OrderFieldDef<F> | OrderFieldDef<F>[] | ValueDef<number>;
}

export interface EncodingWithFacet<F extends Field> extends Encoding<F>, EncodingFacetMapping<F> {}

export function channelHasField<F extends Field>(encoding: EncodingWithFacet<F>, channel: Channel): boolean {
  const channelDef = encoding && encoding[channel];
  if (channelDef) {
    if (isArray(channelDef)) {
      return some(channelDef, fieldDef => !!fieldDef.field);
    } else {
      return isFieldDef(channelDef) || hasConditionalFieldDef<Field, ValueOrGradientOrText>(channelDef);
    }
  }
  return false;
}

export function isAggregate(encoding: EncodingWithFacet<Field>) {
  return some(CHANNELS, channel => {
    if (channelHasField(encoding, channel)) {
      const channelDef = encoding[channel];
      if (isArray(channelDef)) {
        return some(channelDef, fieldDef => !!fieldDef.aggregate);
      } else {
        const fieldDef = getFieldDef(channelDef);
        return fieldDef && !!fieldDef.aggregate;
      }
    }
    return false;
  });
}

export function extractTransformsFromEncoding(oldEncoding: Encoding<Field>, config: Config) {
  const groupby: string[] = [];
  const bins: BinTransform[] = [];
  const timeUnits: TimeUnitTransform[] = [];
  const aggregate: AggregatedFieldDef[] = [];
  const encoding: Encoding<string> = {};

  forEach(oldEncoding, (channelDef, channel) => {
    // Extract potential embedded transformations along with remaining properties
    if (isFieldDef(channelDef)) {
      const {field, aggregate: aggOp, bin, timeUnit, ...remaining} = channelDef;
      if (aggOp || timeUnit || bin) {
        const guide = getGuide(channelDef);
        const isTitleDefined = guide && guide.title;
        let newField = vgField(channelDef, {forAs: true});
        const newFieldDef: FieldDef<string> = {
          // Only add title if it doesn't exist
          ...(isTitleDefined ? [] : {title: title(channelDef, config, {allowDisabling: true})}),
          ...remaining,
          // Always overwrite field
          field: newField
        };
        const isPositionChannel: boolean = channel === 'x' || channel === 'y';

        if (aggOp) {
          let op: AggregateOp;

          if (isArgmaxDef(aggOp)) {
            op = 'argmax';
            newField = vgField({op: 'argmax', field: aggOp.argmax}, {forAs: true});
            newFieldDef.field = `${newField}.${field}`;
          } else if (isArgminDef(aggOp)) {
            op = 'argmin';
            newField = vgField({op: 'argmin', field: aggOp.argmin}, {forAs: true});
            newFieldDef.field = `${newField}.${field}`;
          } else if (aggOp !== 'boxplot' && aggOp !== 'errorbar' && aggOp !== 'errorband') {
            op = aggOp;
          }

          if (op) {
            const aggregateEntry: AggregatedFieldDef = {
              op,
              as: newField
            };
            if (field) {
              aggregateEntry.field = field;
            }
            aggregate.push(aggregateEntry);
          }
        } else {
          groupby.push(newField);
          if (isTypedFieldDef(channelDef) && isBinning(bin)) {
            bins.push({bin, field, as: newField});
            // Add additional groupbys for range and end of bins
            groupby.push(vgField(channelDef, {binSuffix: 'end'}));
            if (binRequiresRange(channelDef, channel)) {
              groupby.push(vgField(channelDef, {binSuffix: 'range'}));
            }
            // Create accompanying 'x2' or 'y2' field if channel is 'x' or 'y' respectively
            if (isPositionChannel) {
              const secondaryChannel: SecondaryFieldDef<string> = {
                field: newField + '_end'
              };
              encoding[channel + '2'] = secondaryChannel;
            }
            newFieldDef.bin = 'binned';
            if (!isSecondaryRangeChannel(channel)) {
              newFieldDef['type'] = 'quantitative';
            }
          } else if (timeUnit) {
            timeUnits.push({
              timeUnit,
              field,
              as: newField
            });

            // define the format type for later compilation
            const formatType = isTypedFieldDef(channelDef) && channelDef.type !== TEMPORAL && 'time';
            if (formatType) {
              if (channel === 'text' || channel === 'tooltip') {
                newFieldDef['formatType'] = formatType;
              } else if (isNonPositionScaleChannel(channel)) {
                newFieldDef['legend'] = {
                  formatType,
                  ...newFieldDef['legend']
                };
              } else if (isPositionChannel) {
                newFieldDef['axis'] = {
                  formatType,
                  ...newFieldDef['axis']
                };
              }
            }
          }
        }
        // now the field should refer to post-transformed field instead
        encoding[channel] = newFieldDef;
      } else {
        groupby.push(field);
        encoding[channel] = oldEncoding[channel];
      }
    } else {
      // For value def, just copy
      encoding[channel] = oldEncoding[channel];
    }
  });

  return {
    bins,
    timeUnits,
    aggregate,
    groupby,
    encoding
  };
}

export function markChannelCompatible(encoding: Encoding<string>, channel: Channel, mark: Mark) {
  const markSupported = supportMark(channel, mark);
  if (!markSupported) {
    return false;
  } else if (markSupported === 'binned') {
    const primaryFieldDef = encoding[channel === 'x2' ? 'x' : 'y'];

    // circle, point, square and tick only support x2/y2 when their corresponding x/y fieldDef
    // has "binned" data and thus need x2/y2 to specify the bin-end field.
    if (isFieldDef(primaryFieldDef) && isFieldDef(encoding[channel]) && isBinned(primaryFieldDef.bin)) {
      return true;
    } else {
      return false;
    }
  }
  return true;
}

export function normalizeEncoding(encoding: Encoding<string>, markDef: MarkDef): Encoding<string> {
  const mark = markDef.type;

  return keys(encoding).reduce((normalizedEncoding: Encoding<string>, channel: Channel | string) => {
    if (!isChannel(channel)) {
      // Drop invalid channel
      log.warn(log.message.invalidEncodingChannel(channel));
      return normalizedEncoding;
    }

    if (!markChannelCompatible(encoding, channel, mark)) {
      // Drop unsupported channel
      log.warn(log.message.incompatibleChannel(channel, mark));
      return normalizedEncoding;
    }

    // Drop line's size if the field is aggregated.
    if (channel === 'size' && mark === 'line') {
      const fieldDef = getTypedFieldDef(encoding[channel]);
      if (fieldDef?.aggregate) {
        log.warn(log.message.LINE_WITH_VARYING_SIZE);
        return normalizedEncoding;
      }
    }

    // Drop color if either fill or stroke is specified

    if (channel === 'color' && (markDef.filled ? 'fill' in encoding : 'stroke' in encoding)) {
      log.warn(log.message.droppingColor('encoding', {fill: 'fill' in encoding, stroke: 'stroke' in encoding}));
      return normalizedEncoding;
    }

    const channelDef = encoding[channel];
    if (
      channel === 'detail' ||
      (channel === 'order' && !isArray(channelDef) && !isValueDef(channelDef)) ||
      (channel === 'tooltip' && isArray(channelDef))
    ) {
      if (channelDef) {
        // Array of fieldDefs for detail channel (or production rule)
        (normalizedEncoding[channel] as any) = array(channelDef).reduce(
          (defs: FieldDef<string>[], fieldDef: FieldDef<string>) => {
            if (!isFieldDef(fieldDef)) {
              log.warn(log.message.emptyFieldDef(fieldDef, channel));
            } else {
              defs.push(normalizeFieldDef(fieldDef, channel));
            }
            return defs;
          },
          []
        );
      }
    } else {
      if (channel === 'tooltip' && channelDef === null) {
        // Preserve null so we can use it to disable tooltip
        normalizedEncoding[channel] = null;
      } else if (!isFieldDef(channelDef) && !isValueDef(channelDef) && !isConditionalDef(channelDef)) {
        log.warn(log.message.emptyFieldDef(channelDef, channel));
        return normalizedEncoding;
      }
      normalizedEncoding[channel] = normalize(channelDef as ChannelDef, channel);
    }
    return normalizedEncoding;
  }, {});
}

export function fieldDefs<F extends Field>(encoding: EncodingWithFacet<F>): FieldDef<F>[] {
  const arr: FieldDef<F>[] = [];
  for (const channel of keys(encoding)) {
    if (channelHasField(encoding, channel)) {
      const channelDef = encoding[channel];
      const channelDefArray = array(channelDef);
      for (const def of channelDefArray) {
        if (isFieldDef(def)) {
          arr.push(def);
        } else if (hasConditionalFieldDef<F, ValueOrGradientOrText>(def)) {
          arr.push(def.condition);
        }
      }
    }
  }
  return arr;
}

export function forEach<U extends {[k in Channel]?: any}>(
  mapping: U,
  f: (cd: ChannelDef, c: Channel) => void,
  thisArg?: any
) {
  if (!mapping) {
    return;
  }

  for (const channel of keys(mapping)) {
    const el = mapping[channel];
    if (isArray(el)) {
      el.forEach((channelDef: ChannelDef) => {
        f.call(thisArg, channelDef, channel);
      });
    } else {
      f.call(thisArg, el, channel);
    }
  }
}

export function reduce<T, U extends {[k in Channel]?: any}>(
  mapping: U,
  f: (acc: any, fd: TypedFieldDef<string>, c: Channel) => U,
  init: T,
  thisArg?: any
) {
  if (!mapping) {
    return init;
  }

  return keys(mapping).reduce((r, channel) => {
    const map = mapping[channel];
    if (isArray(map)) {
      return map.reduce((r1: T, channelDef: ChannelDef) => {
        return f.call(thisArg, r1, channelDef, channel);
      }, r);
    } else {
      return f.call(thisArg, r, map, channel);
    }
  }, init);
}

/**
 * Returns list of path grouping fields for the given encoding
 */
export function pathGroupingFields(mark: Mark, encoding: Encoding<string>): string[] {
  return keys(encoding).reduce((details, channel) => {
    switch (channel) {
      // x, y, x2, y2, lat, long, lat1, long2, order, tooltip, href, cursor should not cause lines to group
      case 'x':
      case 'y':
      case 'href':
      case 'url':
      case 'x2':
      case 'y2':
      // falls through

      case 'latitude':
      case 'longitude':
      case 'latitude2':
      case 'longitude2':
      // TODO: case 'cursor':

      // text, shape, shouldn't be a part of line/trail/area [falls through]
      case 'text':
      case 'shape':
      // falls through

      // tooltip fields should not be added to group by [falls through]
      case 'tooltip':
        return details;

      case 'order':
        // order should not group line / trail
        if (mark === 'line' || mark === 'trail') {
          return details;
        }
      // but order should group area for stacking (falls through)

      case 'detail':
      case 'key': {
        const channelDef = encoding[channel];
        if (isArray(channelDef) || isFieldDef(channelDef)) {
          array(channelDef).forEach(fieldDef => {
            if (!fieldDef.aggregate) {
              details.push(vgField(fieldDef, {}));
            }
          });
        }
        return details;
      }

      case 'size':
        if (mark === 'trail') {
          // For trail, size should not group trail lines.
          return details;
        }
      // For line, size should group lines.

      // falls through
      case 'color':
      case 'fill':
      case 'stroke':
      case 'opacity':
      case 'fillOpacity':
      case 'strokeOpacity':
      case 'strokeWidth': {
        // TODO strokeDashOffset:
        // falls through

        const fieldDef = getTypedFieldDef<string>(encoding[channel]);
        if (fieldDef && !fieldDef.aggregate) {
          details.push(vgField(fieldDef, {}));
        }
        return details;
      }
    }
  }, []);
}

/**
 * Utility files for producing Vega ValueRef for marks
 */
import {isFunction, isString} from 'vega-util';
import {isCountingAggregateOp} from '../../../aggregate';
import {isBinned, isBinning} from '../../../bin';
import {Channel, getMainRangeChannel, PositionChannel, X, X2, Y, Y2} from '../../../channel';
import {
  binRequiresRange,
  ChannelDef,
  FieldDef,
  FieldDefBase,
  FieldName,
  FieldRefOption,
  getBand,
  isFieldDef,
  isPositionFieldDef,
  isTypedFieldDef,
  isValueDef,
  SecondaryFieldDef,
  TypedFieldDef,
  ValueOrGradientOrText,
  vgField
} from '../../../channeldef';
import {Config} from '../../../config';
import * as log from '../../../log';
import {isPathMark, Mark, MarkDef} from '../../../mark';
import {fieldValidPredicate} from '../../../predicate';
import {hasDiscreteDomain, isContinuousToContinuous} from '../../../scale';
import {StackProperties} from '../../../stack';
import {QUANTITATIVE, TEMPORAL} from '../../../type';
import {contains, getFirstDefined} from '../../../util';
import {VgValueRef} from '../../../vega.schema';
import {ScaleComponent} from '../../scale/component';

export function midPointRefWithPositionInvalidTest(
  params: MidPointParams & {
    channel: PositionChannel;
  }
) {
  const {channel, channelDef, markDef, scale} = params;
  const ref = midPoint(params);

  // Wrap to check if the positional value is invalid, if so, plot the point on the min value
  if (
    // Only this for field def without counting aggregate (as count wouldn't be null)
    isFieldDef(channelDef) &&
    !isCountingAggregateOp(channelDef.aggregate) &&
    // and only for continuous scale without zero (otherwise, null / invalid will be interpreted as zero, which doesn't cause layout problem)
    scale &&
    isContinuousToContinuous(scale.get('type')) &&
    scale.get('zero') === false
  ) {
    return wrapPositionInvalidTest({
      fieldDef: channelDef,
      channel,
      markDef,
      ref
    });
  }
  return ref;
}

export function wrapPositionInvalidTest({
  fieldDef,
  channel,
  markDef,
  ref
}: {
  fieldDef: FieldDef<string>;
  channel: PositionChannel;
  markDef: MarkDef<Mark>;
  ref: VgValueRef;
}): VgValueRef | VgValueRef[] {
  if (!isPathMark(markDef.type)) {
    // Only do this for non-path mark (as path marks will already use "defined" to skip points)

    return [fieldInvalidTestValueRef(fieldDef, channel), ref];
  }
  return ref;
}

export function fieldInvalidTestValueRef(fieldDef: FieldDef<string>, channel: PositionChannel) {
  const test = fieldInvalidPredicate(fieldDef, true);
  const mainChannel = getMainRangeChannel(channel) as 'x' | 'y';
  const zeroValueRef = mainChannel === 'x' ? {value: 0} : {field: {group: 'height'}};

  return {test, ...zeroValueRef};
}

export function fieldInvalidPredicate(field: FieldName | FieldDef<string>, invalid = true) {
  return fieldValidPredicate(isString(field) ? field : vgField(field, {expr: 'datum'}), !invalid);
}

export function fieldRef(
  fieldDef: FieldDefBase<string>,
  scaleName: string,
  opt: FieldRefOption,
  encode: {offset?: number | VgValueRef; band?: number | boolean}
): VgValueRef {
  const ref: VgValueRef = {
    ...(scaleName ? {scale: scaleName} : {}),
    field: vgField(fieldDef, opt)
  };

  if (encode) {
    const {offset, band} = encode;
    return {
      ...ref,
      ...(offset ? {offset} : {}),
      ...(band ? {band} : {})
    };
  }
  return ref;
}

/**
 * Signal that returns the middle of a bin from start and end field. Should only be used with x and y.
 */
export function interpolatedSignalRef({
  scaleName,
  fieldDef,
  fieldDef2,
  offset,
  startSuffix,
  band = 0.5
}: {
  scaleName: string;
  fieldDef: TypedFieldDef<string>;
  fieldDef2?: SecondaryFieldDef<string>;
  startSuffix?: string;
  offset: number;
  band: number;
}) {
  const expr = 0 < band && band < 1 ? 'datum' : undefined;
  const start = vgField(fieldDef, {expr, suffix: startSuffix});
  const end = fieldDef2 !== undefined ? vgField(fieldDef2, {expr}) : vgField(fieldDef, {suffix: 'end', expr});

  if (band === 0) {
    return {
      scale: scaleName,
      field: start,
      ...(offset ? {offset} : {})
    };
  } else if (band === 1) {
    return {
      scale: scaleName,
      field: end,
      ...(offset ? {offset} : {})
    };
  } else {
    const datum = `${band} * ${start} + ${1 - band} * ${end}`;

    return {
      signal: `scale("${scaleName}", ${datum})`,
      ...(offset ? {offset} : {})
    };
  }
}

export interface MidPointParams {
  channel: Channel;
  channelDef: ChannelDef;
  channel2Def?: ChannelDef<SecondaryFieldDef<string>>;

  markDef: MarkDef<Mark>;
  config: Config;

  scaleName: string;
  scale: ScaleComponent;
  stack?: StackProperties;
  offset?: number;
  defaultRef: VgValueRef | (() => VgValueRef);
}

/**
 * @returns {VgValueRef} Value Ref for xc / yc or mid point for other channels.
 */
export function midPoint({
  channel,
  channelDef,
  channel2Def,
  markDef,
  config,
  scaleName,
  scale,
  stack,
  offset,
  defaultRef
}: MidPointParams): VgValueRef {
  // TODO: datum support
  if (channelDef) {
    /* istanbul ignore else */

    if (isFieldDef(channelDef)) {
      if (isTypedFieldDef(channelDef)) {
        const band = getBand(channel, channelDef, channel2Def, markDef, config, {isMidPoint: true});

        if (isBinning(channelDef.bin) || (band && channelDef.timeUnit)) {
          // Use middle only for x an y to place marks in the center between start and end of the bin range.
          // We do not use the mid point for other channels (e.g. size) so that properties of legends and marks match.
          if (contains([X, Y], channel) && contains([QUANTITATIVE, TEMPORAL], channelDef.type)) {
            if (stack && stack.impute) {
              // For stack, we computed bin_mid so we can impute.
              return fieldRef(channelDef, scaleName, {binSuffix: 'mid'}, {offset});
            }
            // For non-stack, we can just calculate bin mid on the fly using signal.
            return interpolatedSignalRef({scaleName, fieldDef: channelDef, band, offset});
          }
          return fieldRef(channelDef, scaleName, binRequiresRange(channelDef, channel) ? {binSuffix: 'range'} : {}, {
            offset
          });
        } else if (isBinned(channelDef.bin)) {
          if (isFieldDef(channel2Def)) {
            return interpolatedSignalRef({scaleName, fieldDef: channelDef, fieldDef2: channel2Def, band, offset});
          } else {
            const channel2 = channel === X ? X2 : Y2;
            log.warn(log.message.channelRequiredForBinned(channel2));
          }
        }
      }

      if (scale) {
        const scaleType = scale.get('type');
        if (hasDiscreteDomain(scaleType)) {
          if (scaleType === 'band') {
            // For band, to get mid point, need to offset by half of the band
            const band = getFirstDefined(isPositionFieldDef(channelDef) ? channelDef.band : undefined, 0.5);
            return fieldRef(channelDef, scaleName, {binSuffix: 'range'}, {band, offset});
          }
          return fieldRef(channelDef, scaleName, {binSuffix: 'range'}, {offset});
        }
      }
      return fieldRef(channelDef, scaleName, {}, {offset}); // no need for bin suffix
    } else if (isValueDef(channelDef)) {
      const value = channelDef.value;
      const offsetMixins = offset ? {offset} : {};

      return {...widthHeightValueRef(channel, value), ...offsetMixins};
    }

    // If channelDef is neither field def or value def, it's a condition-only def.
    // In such case, we will use default ref.
  }

  const ref = isFunction(defaultRef) ? {...defaultRef(), ...(offset ? {offset} : {})} : defaultRef;

  if (ref) {
    // for non-position, ref could be undefined.
    return {
      ...ref,
      // only include offset when it is non-zero (zero = no offset)
      ...(offset ? {offset} : {})
    };
  }
  return ref;
}

/**
 * Convert special "width" and "height" values in Vega-Lite into Vega value ref.
 */
export function widthHeightValueRef(channel: Channel, value: ValueOrGradientOrText) {
  if (contains(['x', 'x2'], channel) && value === 'width') {
    return {field: {group: 'width'}};
  } else if (contains(['y', 'y2'], channel) && value === 'height') {
    return {field: {group: 'height'}};
  }
  return {value};
}

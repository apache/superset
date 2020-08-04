import {isBinning} from '../../bin';
import {Channel, isColorChannel, isScaleChannel, rangeType} from '../../channel';
import {TypedFieldDef} from '../../channeldef';
import * as log from '../../log';
import {Mark} from '../../mark';
import {channelSupportScaleType, Scale, ScaleType, scaleTypeSupportDataType} from '../../scale';
import * as util from '../../util';
import {normalizeTimeUnit} from '../../timeunit';

export type RangeType = 'continuous' | 'discrete' | 'flexible' | undefined;

/**
 * Determine if there is a specified scale type and if it is appropriate,
 * or determine default type if type is unspecified or inappropriate.
 */
// NOTE: CompassQL uses this method.
export function scaleType(
  specifiedScale: Scale,
  channel: Channel,
  fieldDef: TypedFieldDef<string>,
  mark: Mark
): ScaleType {
  const defaultScaleType = defaultType(channel, fieldDef, mark);
  const {type} = specifiedScale;

  if (!isScaleChannel(channel)) {
    // There is no scale for these channels
    return null;
  }
  if (type !== undefined) {
    // Check if explicitly specified scale type is supported by the channel
    if (!channelSupportScaleType(channel, type)) {
      log.warn(log.message.scaleTypeNotWorkWithChannel(channel, type, defaultScaleType));
      return defaultScaleType;
    }

    // Check if explicitly specified scale type is supported by the data type
    if (!scaleTypeSupportDataType(type, fieldDef.type)) {
      log.warn(log.message.scaleTypeNotWorkWithFieldDef(type, defaultScaleType));
      return defaultScaleType;
    }

    return type;
  }

  return defaultScaleType;
}

/**
 * Determine appropriate default scale type.
 */
// NOTE: Voyager uses this method.
function defaultType(channel: Channel, fieldDef: TypedFieldDef<string>, mark: Mark): ScaleType {
  switch (fieldDef.type) {
    case 'nominal':
    case 'ordinal':
      if (isColorChannel(channel) || rangeType(channel) === 'discrete') {
        if (channel === 'shape' && fieldDef.type === 'ordinal') {
          log.warn(log.message.discreteChannelCannotEncode(channel, 'ordinal'));
        }
        return 'ordinal';
      }

      if (util.contains(['x', 'y'], channel)) {
        if (util.contains(['rect', 'bar', 'image', 'rule'], mark)) {
          // The rect/bar mark should fit into a band.
          // For rule, using band scale to make rule align with axis ticks better https://github.com/vega/vega-lite/issues/3429
          return 'band';
        }
      }
      // Otherwise, use ordinal point scale so we can easily get center positions of the marks.
      return 'point';

    case 'temporal':
      if (isColorChannel(channel)) {
        return 'time';
      } else if (rangeType(channel) === 'discrete') {
        log.warn(log.message.discreteChannelCannotEncode(channel, 'temporal'));
        // TODO: consider using quantize (equivalent to binning) once we have it
        return 'ordinal';
      } else if (fieldDef.timeUnit && normalizeTimeUnit(fieldDef.timeUnit).utc) {
        return 'utc';
      }
      return 'time';

    case 'quantitative':
      if (isColorChannel(channel)) {
        if (isBinning(fieldDef.bin)) {
          return 'bin-ordinal';
        }

        return 'linear';
      } else if (rangeType(channel) === 'discrete') {
        log.warn(log.message.discreteChannelCannotEncode(channel, 'quantitative'));
        // TODO: consider using quantize (equivalent to binning) once we have it
        return 'ordinal';
      }

      return 'linear';

    case 'geojson':
      return undefined;
  }

  /* istanbul ignore next: should never reach this */
  throw new Error(log.message.invalidFieldType(fieldDef.type));
}

import {Align, AxisOrient, SignalRef} from 'vega';
import {Axis} from '../../axis';
import {isBinning} from '../../bin';
import {PositionScaleChannel, X, Y} from '../../channel';
import {isDiscrete, TypedFieldDef, valueArray} from '../../channeldef';
import * as log from '../../log';
import {Mark} from '../../mark';
import {hasDiscreteDomain, ScaleType} from '../../scale';
import {NOMINAL, ORDINAL} from '../../type';
import {contains, normalizeAngle} from '../../util';
import {UnitModel} from '../unit';
import {getAxisConfig} from './config';
import {normalizeTimeUnit} from '../../timeunit';

// TODO: we need to refactor this method after we take care of config refactoring
/**
 * Default rules for whether to show a grid should be shown for a channel.
 * If `grid` is unspecified, the default value is `true` for ordinal scales that are not binned
 */
export function defaultGrid(scaleType: ScaleType, fieldDef: TypedFieldDef<string>) {
  return !hasDiscreteDomain(scaleType) && !isBinning(fieldDef.bin);
}

export function gridScale(model: UnitModel, channel: PositionScaleChannel) {
  const gridChannel: PositionScaleChannel = channel === 'x' ? 'y' : 'x';
  if (model.getScaleComponent(gridChannel)) {
    return model.scaleName(gridChannel);
  }
  return undefined;
}

export function labelAngle(
  model: UnitModel,
  specifiedAxis: Axis,
  channel: PositionScaleChannel,
  fieldDef: TypedFieldDef<string>
) {
  // try axis value
  if (specifiedAxis.labelAngle !== undefined) {
    return normalizeAngle(specifiedAxis.labelAngle);
  } else {
    // try axis config value
    const angle = getAxisConfig(
      'labelAngle',
      model.config,
      channel,
      orient(channel),
      model.getScaleComponent(channel).get('type')
    );
    if (angle !== undefined) {
      return normalizeAngle(angle);
    } else {
      // get default value
      if (channel === X && contains([NOMINAL, ORDINAL], fieldDef.type)) {
        return 270;
      }
      // no default
      return undefined;
    }
  }
}

export function defaultLabelBaseline(angle: number, axisOrient: AxisOrient) {
  if (angle !== undefined) {
    angle = normalizeAngle(angle);
    if (axisOrient === 'top' || axisOrient === 'bottom') {
      if (angle <= 45 || 315 <= angle) {
        return axisOrient === 'top' ? 'bottom' : 'top';
      } else if (135 <= angle && angle <= 225) {
        return axisOrient === 'top' ? 'top' : 'bottom';
      } else {
        return 'middle';
      }
    } else {
      if (angle <= 45 || 315 <= angle || (135 <= angle && angle <= 225)) {
        return 'middle';
      } else if (45 <= angle && angle <= 135) {
        return axisOrient === 'left' ? 'top' : 'bottom';
      } else {
        return axisOrient === 'left' ? 'bottom' : 'top';
      }
    }
  }
  return undefined;
}

export function defaultLabelAlign(angle: number, axisOrient: AxisOrient): Align {
  if (angle !== undefined) {
    angle = normalizeAngle(angle);
    if (axisOrient === 'top' || axisOrient === 'bottom') {
      if (angle % 180 === 0) {
        return 'center';
      } else if (0 < angle && angle < 180) {
        return axisOrient === 'top' ? 'right' : 'left';
      } else {
        return axisOrient === 'top' ? 'left' : 'right';
      }
    } else {
      if ((angle + 90) % 180 === 0) {
        return 'center';
      } else if (90 <= angle && angle < 270) {
        return axisOrient === 'left' ? 'left' : 'right';
      } else {
        return axisOrient === 'left' ? 'right' : 'left';
      }
    }
  }
  return undefined;
}

export function defaultLabelFlush(fieldDef: TypedFieldDef<string>, channel: PositionScaleChannel) {
  if (channel === 'x' && contains(['quantitative', 'temporal'], fieldDef.type)) {
    return true;
  }
  return undefined;
}

export function defaultLabelOverlap(fieldDef: TypedFieldDef<string>, scaleType: ScaleType) {
  // do not prevent overlap for nominal data because there is no way to infer what the missing labels are
  if (fieldDef.type !== 'nominal') {
    if (scaleType === 'log') {
      return 'greedy';
    }
    return true;
  }
  return undefined;
}

export function orient(channel: PositionScaleChannel) {
  switch (channel) {
    case X:
      return 'bottom';
    case Y:
      return 'left';
  }
  /* istanbul ignore next: This should never happen. */
  throw new Error(log.message.INVALID_CHANNEL_FOR_AXIS);
}

export function defaultTickCount({
  fieldDef,
  scaleType,
  size
}: {
  fieldDef: TypedFieldDef<string>;
  scaleType: ScaleType;
  size?: SignalRef;
}) {
  if (
    !hasDiscreteDomain(scaleType) &&
    scaleType !== 'log' &&
    !contains(['month', 'hours', 'day', 'quarter'], normalizeTimeUnit(fieldDef.timeUnit)?.unit)
  ) {
    if (isBinning(fieldDef.bin)) {
      // for binned data, we don't want more ticks than maxbins
      return {signal: `ceil(${size.signal}/10)`};
    }
    return {signal: `ceil(${size.signal}/40)`};
  }

  return undefined;
}

export function values(specifiedAxis: Axis, model: UnitModel, fieldDef: TypedFieldDef<string>) {
  const vals = specifiedAxis.values;

  if (vals) {
    return valueArray(fieldDef, vals);
  }

  return undefined;
}

export function defaultZindex(mark: Mark, fieldDef: TypedFieldDef<string>) {
  if (mark === 'rect' && isDiscrete(fieldDef)) {
    return 1;
  }
  return 0;
}

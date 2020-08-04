import {getMainRangeChannel, PositionChannel, X, X2, Y2} from '../../../channel';
import {isFieldDef, isPositionFieldDef} from '../../../channeldef';
import * as log from '../../../log';
import {ScaleType} from '../../../scale';
import {contains, getFirstDefined} from '../../../util';
import {VgValueRef} from '../../../vega.schema';
import {getMarkConfig} from '../../common';
import {ScaleComponent} from '../../scale/component';
import {UnitModel} from '../../unit';
import {getOffset} from './offset';
import * as ref from './valueref';

/**
 * Return encode for point (non-band) position channels.
 */
export function pointPosition(
  channel: 'x' | 'y',
  model: UnitModel,
  {defaultPos, vgChannel}: {defaultPos: 'mid' | 'zeroOrMin' | 'zeroOrMax'; vgChannel?: 'x' | 'y' | 'xc' | 'yc'}
) {
  // TODO: refactor how refer to scale as discussed in https://github.com/vega/vega-lite/pull/1613

  const {encoding, markDef, config, stack} = model;

  const channelDef = encoding[channel];
  const channel2Def = encoding[channel === X ? X2 : Y2];
  const scaleName = model.scaleName(channel);
  const scale = model.getScaleComponent(channel);

  const offset = getOffset(channel, markDef);

  // Get default position or position from mark def
  const defaultRef = pointPositionDefaultRef({
    model,
    defaultPos,
    channel,
    scaleName,
    scale,
    checkBarAreaWithoutZero: !channel2Def // only check for non-ranged marks
  });

  const valueRef =
    !channelDef && (encoding.latitude || encoding.longitude)
      ? // use geopoint output if there are lat/long and there is no point position overriding lat/long.
        {field: model.getName(channel)}
      : positionRef({
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
        });

  return {
    [vgChannel ?? channel]: valueRef
  };
}

// TODO: we need to find a way to refactor these so that scaleName is a part of scale
// but that's complicated. For now, this is a huge step moving forward.

/**
 * @return Vega ValueRef for normal x- or y-position without projection
 */
function positionRef(
  params: ref.MidPointParams & {
    channel: 'x' | 'y';
  }
): VgValueRef | VgValueRef[] {
  const {channel, channelDef, scaleName, stack, offset} = params;

  // This isn't a part of midPoint because we use midPoint for non-position too
  if (isFieldDef(channelDef) && stack && channel === stack.fieldChannel) {
    if (isPositionFieldDef(channelDef) && channelDef.band !== undefined) {
      return ref.interpolatedSignalRef({
        scaleName,
        fieldDef: channelDef,
        startSuffix: 'start',
        band: channelDef.band,
        offset: 0
      });
    }
    // x or y use stack_end so that stacked line's point mark use stack_end too.
    return ref.fieldRef(channelDef, scaleName, {suffix: 'end'}, {offset});
  }

  return ref.midPointRefWithPositionInvalidTest(params);
}

export function pointPositionDefaultRef({
  model,
  defaultPos,
  channel,
  scaleName,
  scale,
  checkBarAreaWithoutZero: checkBarAreaWithZero
}: {
  model: UnitModel;
  defaultPos: 'mid' | 'zeroOrMin' | 'zeroOrMax';
  channel: PositionChannel;
  scaleName: string;
  scale: ScaleComponent;
  checkBarAreaWithoutZero: boolean;
}) {
  const {mark, markDef, config} = model;
  return () => {
    const mainChannel = getMainRangeChannel(channel);

    const definedValueOrConfig = getFirstDefined(markDef[channel], getMarkConfig(channel, markDef, config));
    if (definedValueOrConfig !== undefined) {
      return ref.widthHeightValueRef(channel, definedValueOrConfig);
    }

    if (defaultPos === 'zeroOrMin' || defaultPos === 'zeroOrMax') {
      if (scaleName) {
        const scaleType = scale.get('type');
        if (contains([ScaleType.LOG, ScaleType.TIME, ScaleType.UTC], scaleType)) {
          // Log scales cannot have zero.
          // Zero in time scale is arbitrary, and does not affect ratio.
          // (Time is an interval level of measurement, not ratio).
          // See https://en.wikipedia.org/wiki/Level_of_measurement for more info.
          if (checkBarAreaWithZero && (mark === 'bar' || mark === 'area')) {
            log.warn(log.message.nonZeroScaleUsedWithLengthMark(mark, mainChannel, {scaleType}));
          }
        } else {
          if (scale.domainDefinitelyIncludesZero()) {
            return {
              scale: scaleName,
              value: 0
            };
          }
          if (checkBarAreaWithZero && (mark === 'bar' || mark === 'area')) {
            log.warn(
              log.message.nonZeroScaleUsedWithLengthMark(mark, mainChannel, {zeroFalse: scale.explicit.zero === false})
            );
          }
        }
      }

      if (defaultPos === 'zeroOrMin') {
        return mainChannel === 'x' ? {value: 0} : {field: {group: 'height'}};
      } else {
        // zeroOrMax
        return mainChannel === 'x' ? {field: {group: 'width'}} : {value: 0};
      }
    } else {
      // mid
      const sizeRef = model[mainChannel === 'x' ? 'width' : 'height'];
      return {...sizeRef, mult: 0.5};
    }
  };
}

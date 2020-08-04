import {isFieldDef} from '../../../channeldef';
import {MarkConfig} from '../../../mark';
import {getFirstDefined} from '../../../util';
import {VgEncodeEntry, VgValueRef} from '../../../vega.schema';
import {getStyleConfig} from '../../common';
import {UnitModel} from '../../unit';
import {getOffset} from './offset';
import {alignedPositionChannel} from './position-align';
import {pointPosition, pointPositionDefaultRef} from './position-point';
import * as ref from './valueref';

/**
 * Utility for area/rule position, which can be either point or range. (One of the axes should be point and the other should be range.)
 */
export function pointOrRangePosition(
  channel: 'x' | 'y',
  model: UnitModel,
  {
    defaultPos,
    defaultPos2,
    range
  }: {
    defaultPos: 'zeroOrMin' | 'zeroOrMax' | 'mid';
    defaultPos2: 'zeroOrMin' | 'zeroOrMax';
    range: boolean;
  }
) {
  if (range) {
    return rangePosition(channel, model, {defaultPos, defaultPos2});
  }
  return pointPosition(channel, model, {defaultPos});
}

export function rangePosition(
  channel: 'x' | 'y',
  model: UnitModel,
  {
    defaultPos,
    defaultPos2
  }: {
    defaultPos: 'zeroOrMin' | 'zeroOrMax' | 'mid';
    defaultPos2: 'zeroOrMin' | 'zeroOrMax';
  }
) {
  const {markDef, config} = model;
  const channel2 = channel === 'x' ? 'x2' : 'y2';
  const sizeChannel = channel === 'x' ? 'width' : 'height';

  const pos2Mixins = pointPosition2(model, defaultPos2, channel2);

  // If there is width/height, we need to position the marks based on the alignment.
  const vgChannel = pos2Mixins[sizeChannel] ? alignedPositionChannel(channel, markDef, config) : channel;

  return {
    ...pointPosition(channel, model, {defaultPos, vgChannel}),
    ...pos2Mixins
  };
}

/**
 * Return encode for x2, y2.
 * If channel is not specified, return one channel based on orientation.
 */
function pointPosition2(model: UnitModel, defaultPos: 'zeroOrMin' | 'zeroOrMax', channel: 'x2' | 'y2') {
  const {encoding, mark, markDef, stack, config} = model;

  const baseChannel = channel === 'x2' ? 'x' : 'y';
  const sizeChannel = channel === 'x2' ? 'width' : 'height';

  const channelDef = encoding[baseChannel];
  const scaleName = model.scaleName(baseChannel);
  const scale = model.getScaleComponent(baseChannel);

  const offset = getOffset(channel, model.markDef);

  if (!channelDef && (encoding.latitude || encoding.longitude)) {
    // use geopoint output if there are lat2/long2 and there is no point position2 overriding lat2/long2.
    return {[channel]: {field: model.getName(channel)}};
  }

  const valueRef = position2Ref({
    channel,
    channelDef,
    channel2Def: encoding[channel],
    markDef,
    config,
    scaleName,
    scale,
    stack,
    offset,
    defaultRef: undefined
  });

  if (valueRef !== undefined) {
    return {[channel]: valueRef};
  }

  const defaultRef = pointPositionDefaultRef({
    model,
    defaultPos,
    channel,
    scaleName,
    scale,
    checkBarAreaWithoutZero: !encoding[channel] // only check for non-ranged marks
  })();

  // TODO: check width/height encoding here once we add them

  // no x2/y2 encoding, then try to read x2/y2 or width/height based on precedence:
  // markDef > config.style > mark-specific config (config[mark]) > general mark config (config.mark)
  return getFirstDefined<VgEncodeEntry>(
    position2orSize(channel, markDef),
    position2orSize(channel, {
      [channel]: getStyleConfig(channel, markDef, config.style),
      [sizeChannel]: getStyleConfig(sizeChannel, markDef, config.style)
    }),
    position2orSize(channel, config[mark]),
    position2orSize(channel, config.mark),
    {
      [channel]: defaultRef
    }
  );
}

function position2Ref({
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
}: ref.MidPointParams & {
  channel: 'x2' | 'y2';
}): VgValueRef | VgValueRef[] {
  if (
    isFieldDef(channelDef) &&
    stack &&
    // If fieldChannel is X and channel is X2 (or Y and Y2)
    channel.charAt(0) === stack.fieldChannel.charAt(0)
  ) {
    return ref.fieldRef(channelDef, scaleName, {suffix: 'start'}, {offset});
  }
  return ref.midPointRefWithPositionInvalidTest({
    channel,
    channelDef: channel2Def,
    scaleName,
    scale,
    stack,
    markDef,
    config,
    offset,
    defaultRef
  });
}

function position2orSize(channel: 'x2' | 'y2', markDef: MarkConfig) {
  const sizeChannel = channel === 'x2' ? 'width' : 'height';
  if (markDef[channel]) {
    return {[channel]: ref.widthHeightValueRef(channel, markDef[channel])};
  } else if (markDef[sizeChannel]) {
    return {[sizeChannel]: {value: markDef[sizeChannel]}};
  }
  return undefined;
}

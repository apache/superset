import {NonPositionScaleChannel} from '../../../channel';
import {FieldDef, ValueOrGradient} from '../../../channeldef';
import {getFirstDefined} from '../../../util';
import {VgEncodeChannel, VgEncodeEntry, VgValueRef} from '../../../vega.schema';
import {getMarkConfig} from '../../common';
import {UnitModel} from '../../unit';
import {wrapCondition} from './conditional';
import * as ref from './valueref';

/**
 * Return encode for non-positional channels with scales. (Text doesn't have scale.)
 */
export function nonPosition(
  channel: NonPositionScaleChannel,
  model: UnitModel,
  opt: {
    defaultValue?: ValueOrGradient;
    vgChannel?: VgEncodeChannel;
    defaultRef?: VgValueRef;
  } = {}
): VgEncodeEntry {
  const {markDef, encoding, config} = model;
  const {vgChannel = channel} = opt;
  let {defaultRef, defaultValue} = opt;

  if (defaultRef === undefined) {
    // prettier-ignore
    defaultValue = defaultValue ??
      (vgChannel === channel
        ? // When vl channel is the same as Vega's, no need to read from config as Vega will apply them correctly
        markDef[channel]
        : // However, when they are different (e.g, vl's text size is vg fontSize), need to read "size" from configs
        getFirstDefined(markDef[channel], markDef[vgChannel], getMarkConfig(channel, markDef, config, {vgChannel})));

    defaultRef = defaultValue ? {value: defaultValue} : undefined;
  }

  const channelDef = encoding[channel];

  return wrapCondition<FieldDef<string>, ValueOrGradient>(model, channelDef, vgChannel, cDef => {
    return ref.midPoint({
      channel,
      channelDef: cDef,
      markDef,
      config,
      scaleName: model.scaleName(channel),
      scale: model.getScaleComponent(channel),
      stack: null, // No need to provide stack for non-position as it does not affect mid point
      defaultRef
    });
  });
}

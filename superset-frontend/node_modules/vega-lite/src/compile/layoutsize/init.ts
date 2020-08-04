import {getSizeType, POSITION_SCALE_CHANNELS} from '../../channel';
import {getFieldDef, isContinuous, PositionFieldDef} from '../../channeldef';
import {Encoding} from '../../encoding';
import * as log from '../../log';
import {isStep, LayoutSizeMixins} from '../../spec/base';

export function initLayoutSize({encoding, size}: {encoding: Encoding<string>; size: LayoutSizeMixins}) {
  for (const channel of POSITION_SCALE_CHANNELS) {
    const sizeType = getSizeType(channel);
    const fieldDef = getFieldDef(encoding[channel]) as PositionFieldDef<string>;
    if (isStep(size[sizeType])) {
      if (fieldDef) {
        if (isContinuous(fieldDef)) {
          delete size[sizeType];
          log.warn(log.message.stepDropped(sizeType));
        }
      }
    }
  }

  return size;
}

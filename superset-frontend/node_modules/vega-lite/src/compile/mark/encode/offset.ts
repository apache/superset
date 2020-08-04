/**
 * Utility files for producing Vega ValueRef for marks
 */
import {PositionChannel} from '../../../channel';
import {MarkDef} from '../../../mark';

export function getOffset(channel: PositionChannel, markDef: MarkDef) {
  const offsetChannel = (channel + 'Offset') as 'xOffset' | 'yOffset' | 'x2Offset' | 'y2Offset'; // Need to cast as the type can't be inferred automatically

  // TODO: in the future read from encoding channel too
  const markDefOffsetValue = markDef[offsetChannel];
  if (markDefOffsetValue) {
    return markDefOffsetValue;
  }

  return undefined;
}

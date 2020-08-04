import {Align} from 'vega';
import {Config} from '../../../config';
import {MarkDef} from '../../../mark';
import {getFirstDefined} from '../../../util';
import {VgEncodeChannel} from '../../../vega.schema';
import {getMarkConfig} from '../../common';

const ALIGNED_X_CHANNEL: {[a in Align]: VgEncodeChannel} = {
  left: 'x',
  center: 'xc',
  right: 'x2'
} as const;

const BASELINED_Y_CHANNEL = {
  top: 'y',
  middle: 'yc',
  bottom: 'y2'
} as const;

export function alignedPositionChannel(channel: 'x' | 'y', markDef: MarkDef, config: Config) {
  const alignChannel = channel === 'x' ? 'align' : 'baseline';
  const align = getFirstDefined(markDef[alignChannel], getMarkConfig(alignChannel, markDef, config));
  if (channel === 'x') {
    return ALIGNED_X_CHANNEL[align ?? 'center'];
  } else {
    return BASELINED_Y_CHANNEL[align ?? 'middle'];
  }
}

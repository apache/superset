import {ChannelDefWithCondition, FieldDef, format, isTypedFieldDef, isValueDef, Value} from '../../../channeldef';
import {Config} from '../../../config';
import {VgValueRef} from '../../../vega.schema';
import {formatSignalRef} from '../../common';
import {UnitModel} from '../../unit';
import {wrapCondition} from './conditional';

export function text(model: UnitModel, channel: 'text' | 'href' | 'url' = 'text') {
  const channelDef = model.encoding[channel];
  return wrapCondition(model, channelDef, channel, cDef => textRef(cDef, model.config));
}

export function textRef(
  channelDef: ChannelDefWithCondition<FieldDef<string>, Value | string[]>,
  config: Config,
  expr: 'datum' | 'datum.datum' = 'datum'
): VgValueRef {
  // text
  if (channelDef) {
    if (isValueDef(channelDef)) {
      return {value: channelDef.value};
    }
    if (isTypedFieldDef(channelDef)) {
      return formatSignalRef(channelDef, format(channelDef), expr, config);
    }
  }
  return undefined;
}

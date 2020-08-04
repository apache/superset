import {array, isArray, isObject, isString, stringValue} from 'vega-util';
import {isBinned} from '../../../bin';
import {Channel, getMainRangeChannel} from '../../../channel';
import {
  format,
  getFieldDef,
  hasConditionalFieldDef,
  isFieldDef,
  isTypedFieldDef,
  SecondaryFieldDef,
  title,
  TypedFieldDef,
  vgField
} from '../../../channeldef';
import {Config} from '../../../config';
import {Encoding, forEach} from '../../../encoding';
import {getFirstDefined} from '../../../util';
import {binFormatExpression, getMarkConfig} from '../../common';
import {UnitModel} from '../../unit';
import {wrapCondition} from './conditional';
import {textRef} from './text';

export function tooltip(model: UnitModel, opt: {reactiveGeom?: boolean} = {}) {
  const {encoding, markDef, config} = model;
  const channelDef = encoding.tooltip;
  if (isArray(channelDef)) {
    return {tooltip: tooltipRefForEncoding({tooltip: channelDef}, config, opt)};
  } else {
    return wrapCondition(model, channelDef, 'tooltip', cDef => {
      // use valueRef based on channelDef first
      const tooltipRefFromChannelDef = textRef(cDef, model.config, opt.reactiveGeom ? 'datum.datum' : 'datum');
      if (tooltipRefFromChannelDef) {
        return tooltipRefFromChannelDef;
      }

      if (cDef === null) {
        // Allow using encoding.tooltip = null to disable tooltip
        return undefined;
      }

      // If tooltipDef does not exist, then use value from markDef or config
      let markTooltip = getFirstDefined(markDef.tooltip, getMarkConfig('tooltip', markDef, config));

      if (markTooltip === true) {
        markTooltip = {content: 'encoding'};
      }

      if (isString(markTooltip)) {
        return {value: markTooltip};
      } else if (isObject(markTooltip)) {
        // `tooltip` is `{fields: 'encodings' | 'fields'}`
        if (markTooltip.content === 'encoding') {
          return tooltipRefForEncoding(encoding, config, opt);
        } else {
          return {signal: 'datum'};
        }
      }

      return undefined;
    });
  }
}

export function tooltipRefForEncoding(
  encoding: Encoding<string>,
  config: Config,
  {reactiveGeom}: {reactiveGeom?: boolean} = {}
) {
  const keyValues: string[] = [];
  const usedKey = {};
  const toSkip = {};
  const expr = reactiveGeom ? 'datum.datum' : 'datum';
  const tooltipTuples: {channel: Channel; key: string; value: string}[] = [];

  function add(fDef: TypedFieldDef<string> | SecondaryFieldDef<string>, channel: Channel) {
    const mainChannel = getMainRangeChannel(channel);

    const fieldDef: TypedFieldDef<string> = isTypedFieldDef(fDef)
      ? fDef
      : {
          ...fDef,
          type: encoding[mainChannel].type // for secondary field def, copy type from main channel
        };

    const key = array(title(fieldDef, config, {allowDisabling: false})).join(', ');

    let value = textRef(fieldDef, config, expr).signal;

    if (channel === 'x' || channel === 'y') {
      const channel2 = channel === 'x' ? 'x2' : 'y2';
      const fieldDef2 = getFieldDef(encoding[channel2]);

      if (isBinned(fieldDef.bin) && fieldDef2) {
        const startField = vgField(fieldDef, {expr});
        const endField = vgField(fieldDef2, {expr});
        value = binFormatExpression(startField, endField, format(fieldDef), config);
        toSkip[channel2] = true;
      }
    }

    tooltipTuples.push({channel, key, value});
  }

  forEach(encoding, (channelDef, channel) => {
    if (isFieldDef(channelDef)) {
      add(channelDef, channel);
    } else if (hasConditionalFieldDef(channelDef)) {
      add(channelDef.condition, channel);
    }
  });

  for (const {channel, key, value} of tooltipTuples) {
    if (!toSkip[channel] && !usedKey[key]) {
      keyValues.push(`${stringValue(key)}: ${value}`);
      usedKey[key] = true;
    }
  }

  return keyValues.length > 0 ? {signal: `{${keyValues.join(', ')}}`} : undefined;
}

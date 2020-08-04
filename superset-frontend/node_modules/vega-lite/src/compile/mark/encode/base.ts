import {array} from 'vega-util';
import {Channel, ScaleChannel, SCALE_CHANNELS} from '../../../channel';
import {isPathMark, MarkDef} from '../../../mark';
import {hasContinuousDomain} from '../../../scale';
import {Dict, keys} from '../../../util';
import {VgEncodeEntry, VgValueRef, VG_MARK_CONFIGS} from '../../../vega.schema';
import {getMarkPropOrConfig} from '../../common';
import {UnitModel} from '../../unit';
import {color} from './color';
import {nonPosition} from './nonposition';
import {text} from './text';
import {tooltip} from './tooltip';
import {fieldInvalidPredicate} from './valueref';

export {color} from './color';
export {wrapCondition} from './conditional';
export {nonPosition} from './nonposition';
export {pointPosition} from './position-point';
export {pointOrRangePosition, rangePosition} from './position-range';
export {rectPosition} from './position-rect';
export {text} from './text';
export {tooltip} from './tooltip';

export type Ignore = Record<'color' | 'size' | 'orient' | 'align' | 'baseline', 'ignore' | 'include'>;

export function baseEncodeEntry(model: UnitModel, ignore: Ignore) {
  const {fill = undefined, stroke = undefined} = ignore.color === 'include' ? color(model) : {};
  return {
    ...markDefProperties(model.markDef, ignore),
    ...wrapAllFieldsInvalid(model, 'fill', fill),
    ...wrapAllFieldsInvalid(model, 'stroke', stroke),
    ...nonPosition('opacity', model),
    ...nonPosition('fillOpacity', model),
    ...nonPosition('strokeOpacity', model),
    ...nonPosition('strokeWidth', model),
    ...tooltip(model),
    ...text(model, 'href')
  };
}

// TODO: mark VgValueRef[] as readonly after https://github.com/vega/vega/pull/1987
function wrapAllFieldsInvalid(model: UnitModel, channel: Channel, valueRef: VgValueRef | VgValueRef[]): VgEncodeEntry {
  const {config, mark, markDef} = model;

  const invalid = getMarkPropOrConfig('invalid', markDef, config);

  if (invalid === 'hide' && valueRef && !isPathMark(mark)) {
    // For non-path marks, we have to exclude invalid values (null and NaN) for scales with continuous domains.
    // For path marks, we will use "defined" property and skip these values instead.
    const test = allFieldsInvalidPredicate(model, {invalid: true, channels: SCALE_CHANNELS});
    if (test) {
      return {
        [channel]: [
          // prepend the invalid case
          // TODO: support custom value
          {test, value: null},
          ...array(valueRef)
        ]
      };
    }
  }
  return valueRef ? {[channel]: valueRef} : {};
}

function markDefProperties(mark: MarkDef, ignore: Ignore) {
  return VG_MARK_CONFIGS.reduce((m, prop) => {
    if (mark[prop] !== undefined && ignore[prop] !== 'ignore') {
      m[prop] = {value: mark[prop]};
    }
    return m;
  }, {});
}

function allFieldsInvalidPredicate(
  model: UnitModel,
  {invalid = false, channels}: {invalid?: boolean; channels: ScaleChannel[]}
) {
  const filterIndex = channels.reduce((aggregator: Dict<true>, channel) => {
    const scaleComponent = model.getScaleComponent(channel);
    if (scaleComponent) {
      const scaleType = scaleComponent.get('type');
      const field = model.vgField(channel, {expr: 'datum'});

      // While discrete domain scales can handle invalid values, continuous scales can't.
      if (field && hasContinuousDomain(scaleType)) {
        aggregator[field] = true;
      }
    }
    return aggregator;
  }, {});

  const fields = keys(filterIndex);
  if (fields.length > 0) {
    const op = invalid ? '||' : '&&';
    return fields.map(field => fieldInvalidPredicate(field, invalid)).join(` ${op} `);
  }
  return undefined;
}

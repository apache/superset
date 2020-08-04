import {ScaleChannel} from '../../../channel';
import {Value} from '../../../channeldef';
import {hasContinuousDomain} from '../../../scale';
import {Dict, keys} from '../../../util';
import {VgEncodeEntry} from '../../../vega.schema';
import {getMarkPropOrConfig} from '../../common';
import {UnitModel} from '../../unit';
import {fieldInvalidPredicate} from './valueref';

export function defined(model: UnitModel): VgEncodeEntry {
  const {config, markDef} = model;

  const invalid = getMarkPropOrConfig('invalid', markDef, config);
  if (invalid) {
    const signal = allFieldsInvalidPredicate(model, {channels: ['x', 'y']});

    if (signal) {
      return {defined: {signal}};
    }
  }
  return {};
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

export function valueIfDefined(prop: string, value: Value): VgEncodeEntry {
  if (value !== undefined) {
    return {[prop]: {value: value}};
  }
  return undefined;
}

import {PositionScaleChannel} from '../../channel';
import {isTimeFormatFieldDef} from '../../channeldef';
import {ScaleType} from '../../scale';
import {keys} from '../../util';
import {timeFormatExpression} from '../common';
import {UnitModel} from '../unit';
import {normalizeTimeUnit} from '../../timeunit';

export function labels(model: UnitModel, channel: PositionScaleChannel, specifiedLabelsSpec: any) {
  const fieldDef =
    model.fieldDef(channel) ??
    (channel === 'x' ? model.fieldDef('x2') : channel === 'y' ? model.fieldDef('y2') : undefined);
  const axis = model.axis(channel);

  let labelsSpec: any = {};

  // We use a label encoding instead of setting the `format` property because Vega does not let us determine how the format should be interpreted.
  if (isTimeFormatFieldDef(fieldDef)) {
    const isUTCScale = model.getScaleComponent(channel).get('type') === ScaleType.UTC;

    const expr = timeFormatExpression(
      'datum.value',
      normalizeTimeUnit(fieldDef.timeUnit)?.unit,
      axis.format,
      null,
      isUTCScale
    );

    if (expr) {
      labelsSpec.text = {signal: expr};
    }
  }

  labelsSpec = {
    ...labelsSpec,
    ...specifiedLabelsSpec
  };

  return keys(labelsSpec).length === 0 ? undefined : labelsSpec;
}

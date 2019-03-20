import { cloneDeep } from 'lodash';
import { Axis } from 'vega-lite/build/src/axis';
import { ChannelDef, isPositionFieldDef, Formatter } from '../types/FieldDef';
import extractFormat from './extractFormat';
import { PlainObject } from '../types/Data';

export function isXYChannel(channelName: string) {
  return channelName === 'x' || channelName === 'y';
}

function isAxis(axis: Axis | null | undefined | false): axis is Axis {
  return axis !== false && axis !== null && axis !== undefined;
}

export default function extractAxis(
  channelName: string,
  definition: ChannelDef,
  defaultFormatter: Formatter,
) {
  if (isXYChannel(channelName) && isPositionFieldDef(definition)) {
    const { type, axis } = definition;
    if (isAxis(axis)) {
      const parsedAxis: PlainObject = cloneDeep(axis);
      const { labels } = parsedAxis;
      const { format } = labels;
      parsedAxis.format = format
        ? extractFormat({ field: definition.field, format: axis.format, type })
        : defaultFormatter;

      return parsedAxis;
    }
  }

  return undefined;
}

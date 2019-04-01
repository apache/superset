import { getNumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';
import { Type } from 'vega-lite/build/src/type';
import { isTypedFieldDef, ChannelDef } from '../types/ChannelDef';

const fallbackFormatter = (v: any) => `${v}`;

export function extractFormatFromTypeAndFormat(type: Type, format: string) {
  if (type === 'quantitative') {
    const formatter = getNumberFormatter(format);

    return (value: any) => formatter(value);
  } else if (type === 'temporal') {
    const formatter = getTimeFormatter(format);

    return (value: any) => formatter(value);
  }

  return fallbackFormatter;
}

export function extractFormatFromChannelDef(definition: ChannelDef) {
  if (isTypedFieldDef(definition)) {
    const { type } = definition;
    const format =
      'format' in definition && definition.format !== undefined ? definition.format : '';

    return extractFormatFromTypeAndFormat(type, format);
  }

  return fallbackFormatter;
}

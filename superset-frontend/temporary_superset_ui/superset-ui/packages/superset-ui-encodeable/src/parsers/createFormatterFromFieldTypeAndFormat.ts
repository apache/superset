import { getNumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';
import { Type } from '../types/VegaLite';
import { Formatter } from '../types/ChannelDef';
import fallbackFormatter from './fallbackFormatter';

export default function createFormatterFromFieldTypeAndFormat(
  type: Type,
  format: string,
): Formatter {
  if (type === 'quantitative') {
    const formatter = getNumberFormatter(format);

    return (value: any) => formatter(value);
  } else if (type === 'temporal') {
    const formatter = getTimeFormatter(format);

    return (value: any) => formatter(value);
  }

  return fallbackFormatter;
}

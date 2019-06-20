import { format as d3Format, formatLocale, FormatLocaleDefinition } from 'd3-format';
import { isRequired } from '@superset-ui/core';
import NumberFormatter from '../NumberFormatter';
import { NumberFormatFunction } from '../types';

export default function createD3NumberFormatter(config: {
  description?: string;
  formatString: string;
  label?: string;
  locale?: FormatLocaleDefinition;
}) {
  const { description, formatString = isRequired('config.formatString'), label, locale } = config;

  let formatFunc: NumberFormatFunction;
  let isInvalid = false;

  try {
    formatFunc =
      typeof locale === 'undefined'
        ? d3Format(formatString)
        : formatLocale(locale).format(formatString);
  } catch (e) {
    formatFunc = value => `${value} (Invalid format: ${formatString})`;
    isInvalid = true;
  }

  return new NumberFormatter({
    description,
    formatFunc,
    id: formatString,
    isInvalid,
    label,
  });
}

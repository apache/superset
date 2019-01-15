import { format as d3Format } from 'd3-format';
import { isRequired } from '@superset-ui/core';
import NumberFormatter from '../NumberFormatter';
import { NumberFormatFunction } from '../types';

export default function createD3NumberFormatter(config: {
  description?: string;
  formatString: string;
  label?: string;
}) {
  const { description, formatString = isRequired('config.formatString'), label } = config;

  let formatFunc: NumberFormatFunction;
  let isInvalid = false;

  try {
    formatFunc = d3Format(formatString);
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

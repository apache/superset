import { format as d3Format } from 'd3-format';
import { isRequired } from '@superset-ui/core';
import NumberFormatter from '../NumberFormatter';

export default function createD3NumberFormatter({
  description,
  formatString = isRequired('formatString'),
  label,
} = {}) {
  let formatFunc;
  let isInvalid = false;

  try {
    formatFunc = d3Format(formatString);
  } catch (e) {
    formatFunc = value => `${value} (Invalid format: ${formatString})`;
    isInvalid = true;
  }

  const id = formatString;

  return new NumberFormatter({
    description,
    formatFunc,
    id,
    isInvalid,
    label,
  });
}

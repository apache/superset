import { parse, codegen } from 'vega-expression';
import { dateTimeExpr } from 'vega-lite/build/src/datetime';
import { DateTime } from '../types/VegaLite';

export default function parseDateTime(dateTime: string | number | DateTime) {
  if (typeof dateTime === 'number' || typeof dateTime === 'string') {
    return new Date(dateTime);
  }

  const expression = dateTimeExpr(dateTime, true) as string;
  const code = codegen({ globalvar: 'window' })(parse(expression)).code as string;
  // Technically the "code" here is safe to eval(),
  // but we will use more conservative approach and manually parse at the moment.
  const isUtc = code.startsWith('Date.UTC');

  const dateParts = code
    .replace(/^(Date[.]UTC|new[ ]Date)\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((chunk: string) => Number(chunk.trim())) as [
    number, // year
    number, // month
    number, // date
    number, // hours
    number, // minutes
    number, // seconds
    number, // milliseconds
  ];

  return isUtc ? new Date(Date.UTC(...dateParts)) : new Date(...dateParts);
}

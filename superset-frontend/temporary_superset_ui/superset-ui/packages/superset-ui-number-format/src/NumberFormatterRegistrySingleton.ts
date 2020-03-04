import { makeSingleton } from '@superset-ui/core';
import NumberFormatterRegistry from './NumberFormatterRegistry';

const getInstance = makeSingleton(NumberFormatterRegistry);

export default getInstance;

export function getNumberFormatter(format?: string) {
  return getInstance().get(format);
}

export function formatNumber(format: string | undefined, value: number | null | undefined) {
  return getInstance().format(format, value);
}

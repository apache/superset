import { makeSingleton } from '@superset-ui/core';
import TimeFormatterRegistry from './TimeFormatterRegistry';

const getInstance = makeSingleton(TimeFormatterRegistry);

export default getInstance;

export function getTimeFormatter(formatId: string) {
  return getInstance().get(formatId);
}

export function formatTime(formatId: string, value: Date | null | undefined) {
  return getInstance().format(formatId, value);
}

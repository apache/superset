import { makeSingleton } from '@superset-ui/core';
import TimeFormatterRegistry from './TimeFormatterRegistry';

const getInstance = makeSingleton(TimeFormatterRegistry);

export default getInstance;

export function getTimeFormatter(formatId) {
  return getInstance().get(formatId);
}

export function formatTime(formatId, value) {
  return getInstance().format(formatId, value);
}

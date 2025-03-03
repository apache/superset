// DODO was here
import { makeSingleton } from '../utils';
import TimeFormatterRegistry from './TimeFormatterRegistry';
import TimeFormatter from './TimeFormatter';
// import TimeFormatsForGranularity from './TimeFormatsForGranularity'; // DODO commented out 45525377
import { LOCAL_PREFIX } from './TimeFormats';
import { TimeGranularity } from './types';
import createTimeRangeFromGranularity from './utils/createTimeRangeFromGranularity';
import TimeRangeFormatter from './TimeRangeFormatter';
import { SMART_DATE_DOT_DDMMYYYY_ID } from './formatters/smartDate'; // DODO added 45525377
import { getTimeFormatsForGranularity } from './utils/getTimeFormatsForGranularity'; // DODO added 45525377

const getInstance = makeSingleton(TimeFormatterRegistry);

export default getInstance;

export function getTimeRangeFormatter(formatId?: string) {
  return new TimeRangeFormatter({
    id: formatId || 'undefined',
    formatFunc: (range: (Date | number | null | undefined)[]) => {
      const format = getInstance().get(formatId);
      const [start, end] = range.map(value => format(value));
      return start === end ? start : [start, end].join(' — ');
    },
    useLocalTime: formatId?.startsWith(LOCAL_PREFIX),
  });
}

export function formatTimeRange(
  formatId: string | undefined,
  range: (Date | null | undefined)[],
) {
  return getTimeRangeFormatter(formatId)(range);
}

export function getTimeFormatter(
  formatId?: string,
  granularity?: TimeGranularity,
) {
  if (granularity) {
    // DODO added start 45525377
    const isDateReversed = formatId === SMART_DATE_DOT_DDMMYYYY_ID;
    const TimeFormatsForGranularity =
      getTimeFormatsForGranularity(isDateReversed);
    // DODO added stop 45525377
    // const formatString = formatId || TimeFormatsForGranularity[granularity];
    const formatString = TimeFormatsForGranularity[granularity] || formatId; // DODO changed 45525377
    const timeRangeFormatter = getTimeRangeFormatter(formatString);

    return new TimeFormatter({
      id: [formatString, granularity].join('/'),
      formatFunc: (value: Date) =>
        timeRangeFormatter.format(
          createTimeRangeFromGranularity(
            value,
            granularity,
            timeRangeFormatter.useLocalTime,
          ),
        ),
      useLocalTime: timeRangeFormatter.useLocalTime,
    });
  }

  return getInstance().get(formatId);
}

/**
 * Syntactic sugar for backward compatibility
 * TODO: will be deprecated in a future version
 * @param granularity
 */
export function getTimeFormatterForGranularity(granularity?: TimeGranularity) {
  return getTimeFormatter(undefined, granularity);
}

export function formatTime(
  formatId: string | undefined,
  value: Date | number | null | undefined,
  granularity?: TimeGranularity,
) {
  return getTimeFormatter(formatId, granularity)(value);
}

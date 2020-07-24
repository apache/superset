import { TimeRangeEndpoints } from '@superset-ui/query';

const SEPARATOR = ' : ';

export const buildTimeRangeString = (since: string, until: string): string =>
  `${since}${SEPARATOR}${until}`;

const formatDateEndpoint = (dttm: string, isStart?: boolean): string =>
  dttm.replace('T00:00:00', '') || (isStart ? '-∞' : '∞');

export const formatTimeRange = (
  timeRange: string,
  endpoints?: TimeRangeEndpoints,
) => {
  const splitDateRange = timeRange.split(SEPARATOR);
  if (splitDateRange.length === 1) return timeRange;
  const formattedEndpoints = (
    endpoints || ['unknown', 'unknown']
  ).map((endpoint: string) => (endpoint === 'inclusive' ? '≤' : '<'));

  return `${formatDateEndpoint(splitDateRange[0], true)} ${
    formattedEndpoints[0]
  } col ${formattedEndpoints[1]} ${formatDateEndpoint(splitDateRange[1])}`;
};

// DODO was here
import rison from 'rison';
import { SupersetClient, NO_TIME_RANGE, JsonObject } from '@superset-ui/core';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { useSelector } from 'react-redux';
import { API_HANDLER } from 'src/Superstructure/api';
import {
  COMMON_RANGE_VALUES_SET,
  CALENDAR_RANGE_VALUES_SET,
  customTimeRangeDecode,
  dttmToMoment,
} from '.';
import { FrameType } from '../types';
import { MOMENT_FORMAT_UI_DODO } from '../../../../../DodoExtensions/explore/components/controls/DateFilterControl/utils/constants';

export const SEPARATOR = ' : ';

export const buildTimeRangeString = (since: string, until: string): string =>
  `${since}${SEPARATOR}${until}`;

const formatDateEndpoint = (dttm: string, isStart?: boolean): string =>
  dttm.replace('T00:00:00', '') || (isStart ? '-∞' : '∞');

export const formatTimeRange = (
  timeRange: string,
  columnPlaceholder = 'col',
) => {
  const splitDateRange = timeRange.split(SEPARATOR);
  if (splitDateRange.length === 1) return timeRange;
  return `${formatDateEndpoint(
    splitDateRange[0],
    true,
  )} ≤ ${columnPlaceholder} < ${formatDateEndpoint(splitDateRange[1])}`;
};

export const guessFrame = (timeRange: string): FrameType => {
  if (COMMON_RANGE_VALUES_SET.has(timeRange)) {
    return 'Common';
  }
  if (CALENDAR_RANGE_VALUES_SET.has(timeRange)) {
    return 'Calendar';
  }
  if (timeRange === NO_TIME_RANGE) {
    return 'No filter';
  }
  if (customTimeRangeDecode(timeRange).matchedFlag) {
    return 'Custom';
  }
  return 'Advanced';
};

export const fetchTimeRange = async (
  timeRange: string,
  columnPlaceholder = 'col',
) => {
  const query = rison.encode_uri(timeRange);
  const endpoint = `/api/v1/time_range/?q=${query}`;
  try {
    if (process.env.type === undefined) {
      const response = await SupersetClient.get({ endpoint });
      // DODO added start #11681438
      const since = dttmToMoment(response?.json?.result?.since).format(
        MOMENT_FORMAT_UI_DODO,
      );
      const until = dttmToMoment(response?.json?.result?.until).format(
        MOMENT_FORMAT_UI_DODO,
      );
      // DODO added stop #11681438
      const timeRangeString = buildTimeRangeString(since, until); // DODO changed #11681438

      return {
        value: formatTimeRange(timeRangeString, columnPlaceholder),
      };
    }
    const response = await API_HANDLER.SupersetClient({
      method: 'get',
      url: endpoint,
    });
    // DODO added start #11681438
    const since = dttmToMoment(response?.json?.result?.since).format(
      MOMENT_FORMAT_UI_DODO,
    );
    const until = dttmToMoment(response?.json?.result?.until).format(
      MOMENT_FORMAT_UI_DODO,
    );
    // DODO added stop #11681438
    const timeRangeString = buildTimeRangeString(since, until); // DODO changed #11681438

    return {
      value: formatTimeRange(timeRangeString, columnPlaceholder),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error || response.statusText,
    };
  }
};

export function useDefaultTimeFilter() {
  return (
    useSelector(
      (state: JsonObject) => state?.common?.conf?.DEFAULT_TIME_FILTER,
    ) ?? NO_TIME_RANGE
  );
}

// DODO was here
import {
  NO_TIME_RANGE,
  JsonObject,
  customTimeRangeDecode,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import {
  COMMON_RANGE_VALUES_SET,
  CALENDAR_RANGE_VALUES_SET,
  CURRENT_RANGE_VALUES_SET,
} from '.';
import { FrameType } from '../types';

export const guessFrame = (timeRange: string): FrameType => {
  if (COMMON_RANGE_VALUES_SET.has(timeRange)) {
    return 'Common';
  }
  if (CALENDAR_RANGE_VALUES_SET.has(timeRange)) {
    return 'Calendar';
  }
  if (CURRENT_RANGE_VALUES_SET.has(timeRange)) {
    return 'Current';
  }
  if (timeRange === NO_TIME_RANGE) {
    return 'No filter';
  }
  // DODO commented out 44211759
  // if (customTimeRangeDecode(timeRange).matchedFlag) {
  //   return 'Custom';
  // }

  // DODO added start 44211759
  const decode = customTimeRangeDecode(timeRange);

  if (decode.matchedFlag) {
    if (
      decode.customRange.untilMode === 'specific' &&
      decode.customRange.untilDatetime
    ) {
      const until = new Date(decode.customRange.untilDatetime);
      if (
        until.getHours() === 23 &&
        until.getMinutes() === 59 &&
        until.getSeconds() === 59
      ) {
        return 'CustomUntilInclude';
      }
    }
  }
  // DODO added stop 44211759
  return 'Advanced';
};

export function useDefaultTimeFilter() {
  return (
    useSelector(
      (state: JsonObject) => state?.common?.conf?.DEFAULT_TIME_FILTER,
    ) ?? NO_TIME_RANGE
  );
}

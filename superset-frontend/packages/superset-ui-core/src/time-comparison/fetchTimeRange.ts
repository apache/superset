/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import rison from 'rison';
import { isEmpty } from 'lodash-es';
import {
  SupersetClient,
  getClientErrorObject,
  ensureIsArray,
  getTimeFormatter,
} from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';

export const SEPARATOR = ' : ';

export const buildTimeRangeString = (since: string, until: string): string =>
  `${since}${SEPARATOR}${until}`;

const formatDateEndpoint = (
  dttm: string,
  isStart?: boolean,
  dateFormat?: string,
): string => {
  if (!dttm) return isStart ? '-∞' : '∞';
  if (dateFormat) {
    const parsedDttm = extendedDayjs.utc(dttm);
    if (parsedDttm.isValid()) {
      return getTimeFormatter(dateFormat)(parsedDttm.toDate());
    }
  }
  return dttm.replace('T00:00:00', '');
};

export const formatTimeRange = (
  timeRange: string,
  columnPlaceholder = 'col',
  dateFormat?: string,
) => {
  const splitDateRange = timeRange.split(SEPARATOR);
  if (splitDateRange.length === 1) return timeRange;
  return `${formatDateEndpoint(
    splitDateRange[0],
    true,
    dateFormat,
  )} ≤ ${columnPlaceholder} < ${formatDateEndpoint(
    splitDateRange[1],
    false,
    dateFormat,
  )}`;
};

export const formatTimeRangeComparison = (
  initialTimeRange: string,
  shiftedTimeRange: string,
  columnPlaceholder = 'col',
) => {
  const splitInitialDateRange = initialTimeRange.split(SEPARATOR);
  const splitShiftedDateRange = shiftedTimeRange.split(SEPARATOR);
  return `${columnPlaceholder}: ${formatDateEndpoint(
    splitInitialDateRange[0],
    true,
  )} to ${formatDateEndpoint(splitInitialDateRange[1])} vs
  ${formatDateEndpoint(splitShiftedDateRange[0], true)} to ${formatDateEndpoint(
    splitShiftedDateRange[1],
  )}`;
};

type EvaluatedTimeRange = { since?: string; until?: string };

// True when an evaluated start and end are the same instant, which matches no
// rows. The API returns ISO strings, so comparing them directly keeps
// sub-millisecond precision; an empty string means an open endpoint.
const hasEmptyTimeRange = (ranges: EvaluatedTimeRange[]): boolean =>
  ranges.some(({ since, until }) => Boolean(since && until && since === until));

export const fetchTimeRange = async (
  timeRange: string,
  columnPlaceholder = 'col',
  shifts?: string[],
  dateFormat?: string,
) => {
  let query;
  let endpoint;
  if (!isEmpty(shifts)) {
    const timeRanges = ensureIsArray(shifts).map(shift => ({
      timeRange,
      shift,
    }));
    query = rison.encode_uri([{ timeRange }, ...timeRanges]);
    endpoint = `/api/v1/time_range/?q=${query}`;
  } else {
    query = rison.encode_uri(timeRange);
    endpoint = `/api/v1/time_range/?q=${query}`;
  }
  try {
    const response = await SupersetClient.get({ endpoint });
    if (isEmpty(shifts)) {
      const since = response?.json?.result[0]?.since || '';
      const until = response?.json?.result[0]?.until || '';
      const timeRangeString = buildTimeRangeString(since, until);
      return {
        value: formatTimeRange(timeRangeString, columnPlaceholder, dateFormat),
        isEmpty: hasEmptyTimeRange([{ since, until }]),
      };
    }
    const timeRanges = response?.json?.result.map((result: any) =>
      buildTimeRangeString(result.since, result.until),
    );
    return {
      value: timeRanges
        .slice(1)
        .map((timeRange: string) =>
          formatTimeRangeComparison(
            timeRanges[0],
            timeRange,
            columnPlaceholder,
          ),
        ),
      isEmpty: hasEmptyTimeRange(ensureIsArray(response?.json?.result)),
    };
  } catch (caught) {
    // Forward-compat: TS 6.0 types caught values as `unknown`; cast to the
    // shape getClientErrorObject accepts and narrow for statusText access.
    const response = caught as Parameters<typeof getClientErrorObject>[0];
    const clientError = await getClientErrorObject(response);
    return {
      error:
        clientError.message ||
        clientError.error ||
        (response as { statusText?: string }).statusText,
    };
  }
};

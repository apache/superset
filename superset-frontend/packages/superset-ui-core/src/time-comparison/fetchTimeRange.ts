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
  type RequestConfig,
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
      const timeRangeString = buildTimeRangeString(
        response?.json?.result[0]?.since || '',
        response?.json?.result[0]?.until || '',
      );
      return {
        value: formatTimeRange(timeRangeString, columnPlaceholder, dateFormat),
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

export type ResolvedTimeRange = {
  since: string | null;
  until: string | null;
};

export type ResolvedTimeRanges = {
  range: ResolvedTimeRange;
  today: string;
  now: string;
  shifts: (ResolvedTimeRange & { shift: string })[];
};

type TimeRangeResult = {
  since?: string;
  until?: string;
};

const resolved = (result?: TimeRangeResult): ResolvedTimeRange => ({
  since: result?.since || null,
  until: result?.until || null,
});

export type TimeRangeError = {
  error: string;
  timedOut?: boolean;
  status?: number;
};

export type TimeRangeRequestOptions = Pick<
  RequestConfig,
  'timeout' | 'fetchRetryOptions'
>;

export const fetchTimeRanges = async (
  timeRange: string,
  shifts: string[] = [],
  options?: TimeRangeRequestOptions,
): Promise<ResolvedTimeRanges | TimeRangeError> => {
  const query = rison.encode_uri([
    { timeRange },
    { timeRange: 'today : now' },
    ...shifts.map(shift => ({ timeRange, shift })),
  ]);
  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/time_range/?q=${query}`,
      ...options,
    });
    const results: TimeRangeResult[] = response?.json?.result ?? [];
    const [range, clock, ...shifted] = results;
    return {
      range: resolved(range),
      today: clock?.since ?? '',
      now: clock?.until ?? '',
      shifts: shifts.map((shift, index) => ({
        shift,
        ...resolved(shifted[index]),
      })),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error || response.statusText,
      ...(response?.statusText === 'timeout' ? { timedOut: true } : {}),
      ...(response?.status ? { status: response.status } : {}),
    };
  }
};

export const formatResolvedTimeRange = (
  { since, until }: ResolvedTimeRange,
  dateFormat?: string,
): string =>
  formatTimeRange(
    buildTimeRangeString(since ?? '', until ?? ''),
    'col',
    dateFormat,
  );

export type ResolvedTimeRangeList = {
  today: string;
  now: string;
  ranges: ResolvedTimeRange[];
};

export const fetchTimeRangeList = async (
  timeRanges: string[],
  options?: TimeRangeRequestOptions,
): Promise<ResolvedTimeRangeList | TimeRangeError> => {
  const query = rison.encode_uri([
    ...timeRanges.map(timeRange => ({ timeRange })),
    { timeRange: 'today : now' },
  ]);
  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/time_range/?q=${query}`,
      ...options,
    });
    const results: TimeRangeResult[] = response?.json?.result ?? [];
    const clock = results[timeRanges.length];
    return {
      today: clock?.since ?? '',
      now: clock?.until ?? '',
      ranges: timeRanges.map((_, index) => resolved(results[index])),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error || response.statusText,
      ...(response?.statusText === 'timeout' ? { timedOut: true } : {}),
      ...(response?.status ? { status: response.status } : {}),
    };
  }
};

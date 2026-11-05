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

import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  SupersetClient,
  fetchTimeRange,
  fetchTimeRangeList,
  fetchTimeRanges,
  formatResolvedTimeRange,
} from '@superset-ui/core';
import {
  buildTimeRangeString,
  formatTimeRange,
  formatTimeRangeComparison,
} from '../../src/time-comparison/fetchTimeRange';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());

afterEach(() => fetchMock.clearHistory().removeRoutes());

test('generates proper time range string', () => {
  expect(
    buildTimeRangeString('2010-07-30T00:00:00', '2020-07-30T00:00:00'),
  ).toBe('2010-07-30T00:00:00 : 2020-07-30T00:00:00');
  expect(buildTimeRangeString('', '2020-07-30T00:00:00')).toBe(
    ' : 2020-07-30T00:00:00',
  );
  expect(buildTimeRangeString('', '')).toBe(' : ');
});

test('generates a readable time range', () => {
  expect(formatTimeRange('Last 7 days')).toBe('Last 7 days');
  expect(formatTimeRange('No filter')).toBe('No filter');
  expect(formatTimeRange('Yesterday : Tomorrow')).toBe(
    'Yesterday ≤ col < Tomorrow',
  );
  expect(formatTimeRange('2010-07-30T00:00:00 : 2020-07-30T00:00:00')).toBe(
    '2010-07-30 ≤ col < 2020-07-30',
  );
  expect(formatTimeRange('2010-07-30T01:00:00 : ')).toBe(
    '2010-07-30T01:00:00 ≤ col < ∞',
  );
  expect(formatTimeRange(' : 2020-07-30T00:00:00')).toBe(
    '-∞ ≤ col < 2020-07-30',
  );
  expect(formatTimeRange('')).toBe('');
});

test('formatTimeRange applies an optional D3 date format to both endpoints without reinterpreting the timezone', () => {
  // jest.config.js pins the test runner to America/New_York, so if the
  // implementation ever parsed these naive ISO strings as local time
  // instead of UTC, the formatted date/time below would shift.
  expect(
    formatTimeRange(
      '2019-01-14T23:30:00 : 2019-01-21T08:15:00',
      'col',
      '%Y-%m-%d %H:%M',
    ),
  ).toBe('2019-01-14 23:30 ≤ col < 2019-01-21 08:15');

  expect(
    formatTimeRange(
      '2019-01-14T01:32:10 : 2019-01-21T01:32:10',
      'col',
      '%d-%m-%Y %H:%M:%S',
    ),
  ).toBe('14-01-2019 01:32:10 ≤ col < 21-01-2019 01:32:10');
});

test('formatTimeRange preserves the -∞/∞ placeholders when a date format is set', () => {
  expect(formatTimeRange('2019-01-14T00:00:00 : ', 'col', '%d-%m-%Y')).toBe(
    '14-01-2019 ≤ col < ∞',
  );
  expect(formatTimeRange(' : 2019-01-21T00:00:00', 'col', '%d-%m-%Y')).toBe(
    '-∞ ≤ col < 21-01-2019',
  );
});

test('formatTimeRange leaves human-readable values untouched even when a date format is set', () => {
  expect(formatTimeRange('Last week', 'col', '%d-%m-%Y')).toBe('Last week');
  expect(formatTimeRange('No filter', 'col', '%d-%m-%Y')).toBe('No filter');
  expect(formatTimeRange('Yesterday : Tomorrow', 'col', '%d-%m-%Y')).toBe(
    'Yesterday ≤ col < Tomorrow',
  );
});

test('returns a formatted time range from response', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=%27Last+day%27', {
    result: [
      {
        since: '2021-04-13T00:00:00',
        until: '2021-04-14T00:00:00',
        timeRange: 'Last day',
      },
    ],
  });

  const timeRange = await fetchTimeRange('Last day', 'temporal_col');
  expect(timeRange).toEqual({
    value: '2021-04-13 ≤ temporal_col < 2021-04-14',
  });
});

test('returns a formatted time range from response using a custom date format', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=%27Last+day%27', {
    result: [
      {
        since: '2021-04-13T00:00:00',
        until: '2021-04-14T00:00:00',
        timeRange: 'Last day',
      },
    ],
  });

  const timeRange = await fetchTimeRange(
    'Last day',
    'temporal_col',
    undefined,
    '%d/%m/%Y',
  );
  expect(timeRange).toEqual({
    value: '13/04/2021 ≤ temporal_col < 14/04/2021',
  });
});

test('returns a formatted time range from empty response', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=%27Last+day%27', {
    result: [],
  });

  const timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    value: '-∞ ≤ col < ∞',
  });
});

test('returns a formatted error message from response', async () => {
  const getTimeRangeUrl = 'glob:*/api/v1/time_range/?q=%27Last+day%27';
  fetchMock.get(
    getTimeRangeUrl,
    {
      throws: new Response(JSON.stringify({ message: 'Network error' })),
    },
    { name: getTimeRangeUrl },
  );
  let timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Network error',
  });

  fetchMock.removeRoute(getTimeRangeUrl);
  fetchMock.get(
    getTimeRangeUrl,
    {
      throws: new Error('Internal Server Error'),
    },
    { name: getTimeRangeUrl },
  );
  timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Internal Server Error',
  });

  fetchMock.removeRoute(getTimeRangeUrl);
  fetchMock.get(
    getTimeRangeUrl,
    {
      throws: new Response(JSON.stringify({ statusText: 'Network error' }), {
        statusText: 'Network error',
      }),
    },
    { name: getTimeRangeUrl },
  );
  timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Network error',
  });
});

test('fetchTimeRange with shift', async () => {
  fetchMock.getOnce(
    'glob:*/api/v1/time_range/?q=!((timeRange:%27Last+day%27),(shift%3A%27last%20month%27%2CtimeRange%3A%27Last%20day%27))',
    {
      result: [
        {
          since: '2021-04-13T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last day',
          shift: null,
        },
        {
          since: '2021-03-13T00:00:00',
          until: '2021-03-14T00:00:00',
          timeRange: 'Last day',
          shift: 'last month',
        },
      ],
    },
  );

  const timeRange = await fetchTimeRange('Last day', 'temporal_col', [
    'last month',
  ]);

  expect(timeRange).toEqual({
    value: [
      'temporal_col: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14',
    ],
  });
});

test('formatTimeRangeComparison', () => {
  expect(
    formatTimeRangeComparison(
      '2021-04-13T00:00:00 : 2021-04-14T00:00:00',
      '2021-03-13T00:00:00 : 2021-03-14T00:00:00',
    ),
  ).toEqual('col: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14');

  expect(
    formatTimeRangeComparison(
      '2021-04-13T00:00:00 : 2021-04-14T00:00:00',
      '2021-03-13T00:00:00 : 2021-03-14T00:00:00',
      'col_name',
    ),
  ).toEqual(
    'col_name: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14',
  );
});

const timeRangeQuery = () => {
  const url = new URL(fetchMock.callHistory.lastCall()!.url);
  return rison.decode(url.searchParams.get('q')!);
};

test('fetchTimeRanges resolves the range, the server clock and every shift in one request', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    result: [
      {
        since: '2025-02-28T00:00:00',
        until: '2025-05-31T00:00:00',
        timeRange: 'Last 3 months',
        shift: null,
      },
      {
        since: '2025-05-31T00:00:00',
        until: '2025-05-31T14:30:00',
        timeRange: 'today : now',
        shift: null,
      },
      {
        since: '2024-02-28T00:00:00',
        until: '2024-05-31T00:00:00',
        timeRange: 'Last 3 months',
        shift: '1 year ago',
      },
      {
        since: '2025-02-21T00:00:00',
        until: '2025-05-24T00:00:00',
        timeRange: 'Last 3 months',
        shift: '1 week ago',
      },
    ],
  });

  const result = await fetchTimeRanges('Last 3 months', [
    '1 year ago',
    '1 week ago',
  ]);

  expect(fetchMock.callHistory.calls()).toHaveLength(1);
  expect(timeRangeQuery()).toEqual([
    { timeRange: 'Last 3 months' },
    { timeRange: 'today : now' },
    { timeRange: 'Last 3 months', shift: '1 year ago' },
    { timeRange: 'Last 3 months', shift: '1 week ago' },
  ]);
  expect(result).toEqual({
    range: { since: '2025-02-28T00:00:00', until: '2025-05-31T00:00:00' },
    today: '2025-05-31T00:00:00',
    now: '2025-05-31T14:30:00',
    shifts: [
      {
        shift: '1 year ago',
        since: '2024-02-28T00:00:00',
        until: '2024-05-31T00:00:00',
      },
      {
        shift: '1 week ago',
        since: '2025-02-21T00:00:00',
        until: '2025-05-24T00:00:00',
      },
    ],
  });
});

test('fetchTimeRanges returns an open end as null', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    result: [
      { since: '2025-05-01T00:00:00', until: '', timeRange: '...' },
      {
        since: '2025-05-31T00:00:00',
        until: '2025-05-31T14:30:00',
        timeRange: 'today : now',
      },
    ],
  });

  const result = await fetchTimeRanges('2025-05-01T00:00:00 : ');

  expect(timeRangeQuery()).toEqual([
    { timeRange: '2025-05-01T00:00:00 : ' },
    { timeRange: 'today : now' },
  ]);
  expect(result).toEqual({
    range: { since: '2025-05-01T00:00:00', until: null },
    today: '2025-05-31T00:00:00',
    now: '2025-05-31T14:30:00',
    shifts: [],
  });
});

test('fetchTimeRanges returns the server message when the call fails', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    status: 400,
    body: {
      message: 'Unexpected time range: From date cannot be larger than to date',
    },
  });

  const result = await fetchTimeRanges(
    '2025-06-01T00:00:00 : 2025-05-01T00:00:00',
    ['1 year ago'],
  );

  expect(result).toEqual({
    error: 'Unexpected time range: From date cannot be larger than to date',
    status: 400,
  });
});

test('formatResolvedTimeRange formats a resolved range as the "Actual time range" text', () => {
  expect(
    formatResolvedTimeRange({
      since: '2025-05-24T00:00:00',
      until: '2025-05-31T00:00:00',
    }),
  ).toBe('2025-05-24 ≤ col < 2025-05-31');
  expect(
    formatResolvedTimeRange({ since: '2025-01-01T00:00:00', until: null }),
  ).toBe('2025-01-01 ≤ col < ∞');
  expect(formatResolvedTimeRange({ since: null, until: null })).toBe(
    '-∞ ≤ col < ∞',
  );
  expect(
    formatResolvedTimeRange({
      since: '2025-05-31T08:30:00',
      until: '2025-05-31T14:30:00',
    }),
  ).toBe('2025-05-31T08:30:00 ≤ col < 2025-05-31T14:30:00');
});

test('formatResolvedTimeRange applies an optional date format', () => {
  expect(
    formatResolvedTimeRange(
      { since: '2025-05-24T00:00:00', until: '2025-05-31T00:00:00' },
      '%d-%m-%Y',
    ),
  ).toBe('24-05-2025 ≤ col < 31-05-2025');
  expect(
    formatResolvedTimeRange(
      { since: '2025-01-01T00:00:00', until: null },
      '%d-%m-%Y',
    ),
  ).toBe('01-01-2025 ≤ col < ∞');
});

test('fetchTimeRangeList resolves every range and the server clock in one request', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    result: [
      {
        since: '2024-05-31T00:00:00',
        until: '2025-05-31T00:00:00',
        timeRange: 'Last year',
        shift: null,
      },
      {
        since: '2025-05-26T00:00:00',
        until: '2025-06-02T00:00:00',
        timeRange: 'Current week',
        shift: null,
      },
      {
        since: '2025-05-31T00:00:00',
        until: '2025-05-31T14:30:00',
        timeRange: 'today : now',
        shift: null,
      },
    ],
  });

  const result = await fetchTimeRangeList(['Last year', 'Current week']);

  expect(fetchMock.callHistory.calls()).toHaveLength(1);
  expect(timeRangeQuery()).toEqual([
    { timeRange: 'Last year' },
    { timeRange: 'Current week' },
    { timeRange: 'today : now' },
  ]);
  expect(result).toEqual({
    today: '2025-05-31T00:00:00',
    now: '2025-05-31T14:30:00',
    ranges: [
      { since: '2024-05-31T00:00:00', until: '2025-05-31T00:00:00' },
      { since: '2025-05-26T00:00:00', until: '2025-06-02T00:00:00' },
    ],
  });
});

test('fetchTimeRangeList returns the server message when the call fails', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    status: 400,
    body: { message: 'Unexpected time range: banana' },
  });

  expect(await fetchTimeRangeList(['Last year'])).toEqual({
    error: 'Unexpected time range: banana',
    status: 400,
  });
});

test('fetchTimeRanges and fetchTimeRangeList pass the request options on, and none by default', async () => {
  fetchMock.get('glob:*/api/v1/time_range/?q=*', { result: [] });
  const get = jest.spyOn(SupersetClient, 'get');
  const options = { timeout: 10000, fetchRetryOptions: { retries: 0 } };

  await fetchTimeRanges('Last week');
  await fetchTimeRangeList(['Last week']);
  await fetchTimeRanges('Last week', [], options);
  await fetchTimeRangeList(['Last week'], options);

  const sent = get.mock.calls.map(([request]) => request);
  expect(sent.map(request => Object.keys(request))).toEqual([
    ['endpoint'],
    ['endpoint'],
    ['endpoint', 'timeout', 'fetchRetryOptions'],
    ['endpoint', 'timeout', 'fetchRetryOptions'],
  ]);
  expect(sent[2]).toMatchObject(options);
  expect(sent[3]).toMatchObject(options);
  get.mockRestore();
});

test('fetchTimeRanges and fetchTimeRangeList flag a timeout, and no other failure', async () => {
  const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue({
    error: 'Request timed out',
    statusText: 'timeout',
    timeout: 10000,
  });

  expect(await fetchTimeRanges('Last week')).toEqual({
    error: 'Request timed out',
    timedOut: true,
  });
  expect(await fetchTimeRangeList(['Last week'])).toEqual({
    error: 'Request timed out',
    timedOut: true,
  });

  get.mockRejectedValue({ error: 'Bad gateway', statusText: 'Bad Gateway' });

  expect(await fetchTimeRanges('Last week')).toEqual({ error: 'Bad Gateway' });
  get.mockRestore();
});

test('fetchTimeRanges and fetchTimeRangeList pass the HTTP status of a failure on', async () => {
  const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue({
    error: 'Service Unavailable',
    statusText: 'Service Unavailable',
    status: 503,
  });

  expect(await fetchTimeRanges('Last week')).toEqual({
    error: 'Service Unavailable',
    status: 503,
  });
  expect(await fetchTimeRangeList(['Last week'])).toEqual({
    error: 'Service Unavailable',
    status: 503,
  });
  get.mockRestore();
});

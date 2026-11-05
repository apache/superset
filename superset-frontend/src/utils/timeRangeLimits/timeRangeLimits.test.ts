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
import { readFileSync } from 'fs';
import fetchMock from 'fetch-mock';
import path from 'path';
import 'dayjs/locale/fr';
import { SupersetClient } from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import {
  allFailures,
  allowedUnits,
  bindingSpan,
  checkTimeRange,
  completeRule,
  CHART_RANGES_MAX_CHARTS,
  ChartRange,
  ChartRangesCall,
  ChartRangesEntry,
  fetchChartRanges,
  judgeChartRanges,
  dashboardLimitLevels,
  describeFailure,
  describeFirstFailure,
  describeLimit,
  describeLimitParts,
  describeLimits,
  describeRuleValue,
  describeSpanLength,
  EffectiveLimits,
  effectiveConstraints,
  effectiveLimits,
  effectiveRuleLabel,
  grainLength,
  hasLimits,
  isEndDayDisabled,
  isStartDayDisabled,
  Level,
  looserThanGlobal,
  neverLonger,
  NO_LIMITS,
  parseServerDate,
  Policy,
  Rule,
  ruleDescriptions,
  ruleLabels,
  RuleValue,
  ruleShapeErrors,
  sameFamily,
  stricterThan,
  zeroWindowError,
} from '.';

const TODAY = '2025-05-31T00:00:00';
const NOW = '2025-05-31T14:30:00';

const date = (value: string) => parseServerDate(value)!;
const iso = (value: { format: (template: string) => string } | undefined) =>
  value?.format('YYYY-MM-DDTHH:mm:ss');

const rule = (quantity: number, timeGrain: string): Rule => ({
  quantity,
  time_grain: timeGrain,
});

const policy = (rules: Partial<Policy> = {}): Policy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});

const POLICY_A = policy({
  max_span: rule(3, 'P1M'),
  max_look_back: rule(13, 'P1M'),
  max_look_forward: rule(0, 'P1D'),
});

const limitsFor = (
  levels: Level[],
  today = TODAY,
  now = NOW,
): EffectiveLimits => {
  const limits = effectiveLimits(levels, date(today), date(now));
  if (limits === null || 'unavailable' in limits) {
    throw new Error('expected effective limits');
  }
  return limits;
};

const check = (
  since: string | null,
  until: string | null,
  limits: EffectiveLimits,
  options: { timeOffset?: string; dashboardId?: number } = {},
) =>
  allFailures(
    { since: parseServerDate(since), until: parseServerDate(until) },
    limits,
    options,
  );

const summary = (failures: ReturnType<typeof check>) =>
  failures.map(({ reason, field, limit, message }) => ({
    reason,
    field,
    source: limit?.source ?? null,
    message,
  }));

const globalA = () => limitsFor([{ source: 'global', policy: POLICY_A }]);

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2031-01-15T03:00:00Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

test('"Last 3 months" on a month end breaks policy A\'s span, counted from the start', () => {
  expect(
    summary(check('2025-02-28T00:00:00', '2025-05-31T00:00:00', globalA())),
  ).toEqual([
    {
      reason: 'MAX_SPAN_EXCEEDED',
      field: 'range',
      source: 'global',
      message:
        "Range can't be longer than 3 months. This one is 3 months and 3 days.",
    },
  ]);
  expect(
    check('2025-02-28T00:00:00', '2025-05-28T00:00:00', globalA()),
  ).toEqual([]);
});

test('"Last 3 months" a year ago breaks the span and the look-back, both with the comparison prefix', () => {
  const failures = check(
    '2024-02-28T00:00:00',
    '2024-05-31T00:00:00',
    globalA(),
    { timeOffset: '1 year ago' },
  );

  expect(summary(failures)).toEqual([
    {
      reason: 'MAX_SPAN_EXCEEDED',
      field: 'range',
      source: 'global',
      message:
        'Time comparison "1 year ago": Range can\'t be longer than 3 months. This one is 3 months and 3 days.',
    },
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'global',
      message:
        'Time comparison "1 year ago": Start can\'t be earlier than Apr 30, 2024 (13 months ago).',
    },
  ]);
  expect(failures[0]).toMatchObject({
    rule: 'max_span',
    limit: { source: 'global', quantity: 3, time_grain: 'P1M' },
  });
  expect(iso(failures[0].bound)).toBe('2024-05-28T00:00:00');
  expect(iso(failures[1].bound)).toBe('2024-04-30T00:00:00');
});

test('"Current quarter" only breaks the look-forward', () => {
  const failures = check(
    '2025-04-01T00:00:00',
    '2025-07-01T00:00:00',
    globalA(),
  );

  expect(summary(failures)).toEqual([
    {
      reason: 'MAX_LOOK_FORWARD_EXCEEDED',
      field: 'end',
      source: 'global',
      message: "End can't be later than today.",
    },
  ]);
  expect(failures[0].rule).toBe('max_look_forward');
  expect(iso(failures[0].bound)).toBe('2025-06-01T00:00:00');
});

test('"previous calendar quarter" passes policy A', () => {
  expect(
    check('2025-01-01T00:00:00', '2025-04-01T00:00:00', globalA()),
  ).toEqual([]);
});

test('sub-day look-back allows one second of slack', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(6, 'PT1H') }) },
  ]);

  expect(check('2025-05-31T08:30:00', NOW, limits)).toEqual([]);
  expect(check('2025-05-31T08:29:59', NOW, limits)).toEqual([]);
  expect(summary(check('2025-05-31T08:29:58', NOW, limits))).toEqual([
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'global',
      message: "Start can't be earlier than May 31, 2025 08:30 (6 hours ago).",
    },
  ]);
});

test('day bounds have no slack', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_look_forward: rule(0, 'P1D') }) },
  ]);

  expect(iso(limits.latestEnd?.value)).toBe('2025-06-01T00:00:00');
  expect(check(TODAY, '2025-06-01T00:00:00', limits)).toEqual([]);
  expect(summary(check(TODAY, '2025-06-01T00:00:01', limits))).toEqual([
    {
      reason: 'MAX_LOOK_FORWARD_EXCEEDED',
      field: 'end',
      source: 'global',
      message: "End can't be later than today.",
    },
  ]);
});

test('equal look-back bounds keep the lowest level', () => {
  const lookBack = policy({ max_look_back: rule(13, 'P1M') });
  const limits = limitsFor([
    { source: 'global', policy: lookBack },
    { source: 'dataset', policy: lookBack },
    { source: 'dashboard', policy: lookBack },
  ]);

  expect(limits.earliestStart?.limit.source).toBe('global');
  expect(
    summary(check('2024-04-29T00:00:00', '2024-05-01T00:00:00', limits)),
  ).toEqual([
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'global',
      message: "Start can't be earlier than Apr 30, 2024 (13 months ago).",
    },
  ]);
});

test('12 months and 1 year set the same bound, so the global level wins', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(12, 'P1M') }) },
    { source: 'dashboard', policy: policy({ max_look_back: rule(1, 'P1Y') }) },
  ]);

  expect(limits.earliestStart?.limit.source).toBe('global');
  expect(iso(limits.earliestStart?.value)).toBe('2024-05-31T00:00:00');
});

test('the strictest look-back wins across levels', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(13, 'P1M') }) },
    { source: 'dataset', policy: policy({ max_look_back: rule(6, 'P1M') }) },
    { source: 'dashboard', policy: policy({ max_look_back: rule(12, 'P1M') }) },
  ]);

  expect(summary(check('2024-11-01T00:00:00', TODAY, limits))).toEqual([
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'dataset',
      message: "Start can't be earlier than Nov 30, 2024 (6 months ago).",
    },
  ]);
});

test('only the binding span is reported when several spans apply', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_span: rule(90, 'P1D') }) },
    { source: 'dashboard', policy: policy({ max_span: rule(3, 'P1M') }) },
  ]);

  expect(
    summary(check('2025-02-28T00:00:00', '2025-05-31T00:00:00', limits)),
  ).toEqual([
    {
      reason: 'MAX_SPAN_EXCEEDED',
      field: 'range',
      source: 'dashboard',
      message:
        "Range can't be longer than 3 months. This one is 3 months and 3 days.",
    },
  ]);
});

test('only one span failure is reported when every span is broken', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_span: rule(90, 'P1D') }) },
    { source: 'dashboard', policy: policy({ max_span: rule(2, 'P1M') }) },
  ]);

  expect(
    summary(check('2025-02-28T00:00:00', '2025-05-31T00:00:00', limits)),
  ).toEqual([
    {
      reason: 'MAX_SPAN_EXCEEDED',
      field: 'range',
      source: 'dashboard',
      message:
        "Range can't be longer than 2 months. This one is 3 months and 3 days.",
    },
  ]);
});

test('calendar maths clamps month ends', () => {
  const threeMonths = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(3, 'P1M') }) },
  ]);
  expect(iso(threeMonths.earliestStart?.value)).toBe('2025-02-28T00:00:00');

  const oneYear = limitsFor(
    [{ source: 'global', policy: policy({ max_look_back: rule(1, 'P1Y') }) }],
    '2024-02-29T00:00:00',
    '2024-02-29T10:00:00',
  );
  expect(iso(oneYear.earliestStart?.value)).toBe('2023-02-28T00:00:00');
});

test('an open end only fails as unbounded, on the end field', () => {
  const failures = check('2025-05-01T00:00:00', null, globalA());

  expect(failures).toEqual([
    {
      reason: 'UNBOUNDED_RANGE',
      rule: null,
      field: 'end',
      limit: null,
      message: 'An end date is required.',
    },
  ]);
});

test('an open end on a dashboard uses the dashboard sentence', () => {
  expect(
    summary(check('2025-05-01T00:00:00', null, globalA(), { dashboardId: 7 })),
  ).toEqual([
    {
      reason: 'UNBOUNDED_RANGE',
      field: 'end',
      source: null,
      message:
        'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
    },
  ]);
});

test('"No filter" fails as unbounded on the range field', () => {
  expect(check(null, null, globalA())).toEqual([
    {
      reason: 'UNBOUNDED_RANGE',
      rule: null,
      field: 'range',
      limit: null,
      message: 'Choose a start and an end date. Time range limits are on.',
    },
  ]);
});

test('an impossible policy only fails as no valid range, even for an open range', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(0, 'PT1H') }) },
    {
      source: 'dashboard',
      policy: policy({ max_look_forward: rule(0, 'PT1H') }),
    },
  ]);
  const expected = [
    {
      reason: 'NO_VALID_RANGE',
      rule: null,
      field: 'range',
      limit: null,
      message:
        'No time range fits the limits: the earliest start (now) is not before the latest end (now). Ask an editor or admin to fix the limits.',
    },
  ];

  expect(check('2025-05-31T10:00:00', NOW, limits)).toEqual(expected);
  expect(check('2025-05-31T10:00:00', null, limits)).toEqual(expected);
  expect(check(null, null, limits)).toEqual(expected);
});

test('a start after the end throws, as the server does', () => {
  expect(() =>
    check('2025-06-01T00:00:00', '2025-05-01T00:00:00', globalA()),
  ).toThrow('since must not be later than until');
});

test('levels with no rule set mean no limits, so open ranges are allowed', () => {
  const empty = policy();

  expect(
    effectiveLimits(
      [
        { source: 'global', policy: empty },
        { source: 'dataset', policy: empty },
        { source: 'dashboard', policy: empty },
      ],
      date(TODAY),
      date(NOW),
    ),
  ).toBeNull();
  expect(
    effectiveLimits(
      [
        { source: 'global', policy: null },
        { source: 'dashboard', policy: empty },
      ],
      date(TODAY),
      date(NOW),
    ),
  ).toBeNull();
});

test('legacy grains and quarters use the server lengths', () => {
  expect(grainLength('PT0.5H')).toEqual({ count: 30, unit: 'minute' });
  expect(grainLength('P0.25Y')).toEqual({ count: 3, unit: 'month' });
  expect(grainLength('P3M')).toEqual({ count: 3, unit: 'month' });
  expect(grainLength('P1Q')).toBeNull();
  expect(grainLength('P1W/1970-01-03T00:00:00Z')).toBeNull();
  expect(describeLimit({ quantity: 1, time_grain: 'PT0.5H' })).toBe(
    '30 minutes',
  );
  expect(describeLimit({ quantity: 1, time_grain: 'P0.25Y' })).toBe(
    '1 quarter',
  );
  expect(describeLimit({ quantity: 9, time_grain: 'P1W' })).toBe('9 weeks');

  const halfHour = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(1, 'PT0.5H') }) },
  ]);
  expect(summary(check('2025-05-31T13:00:00', NOW, halfHour))).toEqual([
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'global',
      message:
        "Start can't be earlier than May 31, 2025 14:00 (30 minutes ago).",
    },
  ]);

  const quarterSpan = limitsFor([
    { source: 'global', policy: policy({ max_span: rule(1, 'P0.25Y') }) },
  ]);
  expect(
    summary(
      check('2024-02-28T00:00:00', '2024-05-31T00:00:00', quarterSpan, {
        timeOffset: '1 year ago',
      }),
    ),
  ).toEqual([
    {
      reason: 'MAX_SPAN_EXCEEDED',
      field: 'range',
      source: 'global',
      message:
        'Time comparison "1 year ago": Range can\'t be longer than 1 quarter. This one is 1 quarter and 3 days.',
    },
  ]);

  const quarters = limitsFor([
    { source: 'global', policy: policy({ max_look_back: rule(2, 'P3M') }) },
  ]);
  expect(summary(check('2024-11-01T00:00:00', TODAY, quarters))).toEqual([
    {
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      field: 'start',
      source: 'global',
      message: "Start can't be earlier than Nov 30, 2024 (2 quarters ago).",
    },
  ]);
});

test('dates keep English month names when the UI language is not English', () => {
  extendedDayjs.locale('fr');
  try {
    expect(
      summary(check('2024-04-29T00:00:00', '2024-05-01T00:00:00', globalA())),
    ).toEqual([
      {
        reason: 'MAX_LOOK_BACK_EXCEEDED',
        field: 'start',
        source: 'global',
        message: "Start can't be earlier than Apr 30, 2024 (13 months ago).",
      },
    ]);
  } finally {
    extendedDayjs.locale('en');
  }
});

test('an unknown grain makes the limits unavailable', () => {
  expect(
    effectiveLimits(
      [
        { source: 'global', policy: POLICY_A },
        { source: 'dashboard', policy: policy({ max_span: rule(1, 'P1Q') }) },
      ],
      date(TODAY),
      date(NOW),
    ),
  ).toEqual({ unavailable: true });
});

test('the browser clock is never read', () => {
  expect(Date.now()).toBe(Date.UTC(2031, 0, 15, 3));
  expect(
    summary(check('2025-04-01T00:00:00', '2025-07-01T00:00:00', globalA())),
  ).toEqual([
    {
      reason: 'MAX_LOOK_FORWARD_EXCEEDED',
      field: 'end',
      source: 'global',
      message: "End can't be later than today.",
    },
  ]);

  const sources = [
    ...['rules.ts', 'requests.ts', 'chartRanges.ts', 'editorRules.ts'].map(
      file => path.join(__dirname, file),
    ),
    path.resolve(
      __dirname,
      '../../..',
      'packages/superset-ui-core/src/time-comparison/fetchTimeRange.ts',
    ),
  ];
  const forbidden = [
    'Date.now',
    'new Date(',
    'Date.parse',
    'dayjs()',
    'extendedDayjs()',
    'extendedDayjs.utc()',
  ];
  sources.forEach(source => {
    const text = readFileSync(source, 'utf8');
    forbidden.forEach(word => expect(text).not.toContain(word));
  });
});

test('hasLimits is false without a level that sets a rule', () => {
  expect(hasLimits([])).toBe(false);
  expect(
    hasLimits([
      { source: 'global', policy: null },
      { source: 'dashboard', policy: policy() },
    ]),
  ).toBe(false);
  expect(
    hasLimits([
      { source: 'global', policy: null },
      { source: 'dataset', policy: policy({ max_span: rule(9, 'P1W') }) },
    ]),
  ).toBe(true);
});

test('bindingSpan picks the span with the earliest end', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_span: rule(90, 'P1D') }) },
    { source: 'dashboard', policy: policy({ max_span: rule(1, 'P1M') }) },
  ]);

  const span = bindingSpan(date(TODAY), limits.maxSpan);

  expect(span?.limit).toMatchObject({ source: 'dashboard', quantity: 1 });
  expect(iso(span?.end)).toBe('2025-06-30T00:00:00');
  expect(bindingSpan(date(TODAY), [])).toBeNull();
});

test('describeFailure gives the message alone, with no level sentence', () => {
  const span = (source: Level['source']) =>
    describeFailure(
      check(
        '2025-01-01T00:00:00',
        '2025-05-31T00:00:00',
        limitsFor([{ source, policy: policy({ max_span: rule(3, 'P1M') }) }]),
      )[0],
    );

  expect(span('dashboard')).toBe(
    "Range can't be longer than 3 months. This one is 4 months and 30 days.",
  );
  expect(span('dataset')).toBe(
    "Range can't be longer than 3 months. This one is 4 months and 30 days.",
  );
  expect(span('global')).toBe(
    "Range can't be longer than 3 months. This one is 4 months and 30 days.",
  );
  expect(describeFailure(check(null, null, globalA())[0])).toBe(
    'Choose a start and an end date. Time range limits are on.',
  );
});

test('describeFailure says "End is required on this dashboard" for a blank end on a dashboard only', () => {
  const [blankEnd] = check('2025-05-01T00:00:00', null, globalA());
  const [bothBlank] = check(null, null, globalA());

  expect(describeFailure(blankEnd, true)).toBe(
    'End is required on this dashboard',
  );
  expect(blankEnd.message).toBe('An end date is required.');
  expect(describeFailure(blankEnd)).toBe('An end date is required.');
  expect(describeFailure(bothBlank, true)).toBe(
    'Choose a start and an end date. Time range limits are on.',
  );
});

test('describeSpanLength gives a range length in the unit of the span limit', () => {
  const since = date('2024-01-01T00:00:00');
  const until = date('2025-01-01T00:00:00');

  expect(
    describeSpanLength(
      { source: 'dashboard', quantity: 90, time_grain: 'P1D' },
      since,
      until,
    ),
  ).toBe('366 days');
  expect(
    describeSpanLength(
      { source: 'dashboard', quantity: 3, time_grain: 'P1M' },
      since,
      until,
    ),
  ).toBe('12 months');
  expect(
    describeSpanLength(
      { source: 'global', quantity: 1, time_grain: 'P3M' },
      since,
      until,
    ),
  ).toBe('4 quarters');
});

test('describeFirstFailure gives the dashboard span text on a dashboard, with the length only for a range', () => {
  const limits = limitsFor([
    { source: 'dashboard', policy: policy({ max_span: rule(90, 'P1D') }) },
  ]);
  const since = date('2024-01-01T00:00:00');
  const until = date('2025-01-01T00:00:00');
  const failures = allFailures({ since, until }, limits);

  expect(describeFirstFailure(failures, true)).toBe(
    'Longer than this dashboard allows (90 days)',
  );
  expect(describeFirstFailure(failures, true, { since, until })).toBe(
    '366 days, longer than this dashboard allows (90 days)',
  );
  expect(describeFirstFailure(failures, false, { since, until })).toBe(
    "Range can't be longer than 90 days. This one is 366 days.",
  );
  expect(describeFirstFailure([], true)).toBeUndefined();
});

test('describeFirstFailure gives one reason for a range that breaks the span and the look-back', () => {
  const limits = limitsFor([
    {
      source: 'dashboard',
      policy: policy({
        max_span: rule(90, 'P1D'),
        max_look_back: rule(13, 'P1M'),
      }),
    },
  ]);
  const since = date('2024-01-01T00:00:00');
  const until = date('2025-01-01T00:00:00');
  const failures = allFailures({ since, until }, limits);

  expect(failures.map(failure => failure.reason)).toEqual([
    'MAX_SPAN_EXCEEDED',
    'MAX_LOOK_BACK_EXCEEDED',
  ]);
  expect(describeFirstFailure(failures, true, { since, until })).toBe(
    '366 days, longer than this dashboard allows (90 days)',
  );
  expect(describeFirstFailure(failures, false)).toBe(
    "Range can't be longer than 90 days. This one is 366 days.",
  );
  expect(describeFirstFailure(failures.slice(1), true)).toBe(
    "Start can't be earlier than Apr 30, 2024 (13 months ago).",
  );
});

test('describeLimits says the limits of one level in one line', () => {
  const dashboardA = limitsFor([{ source: 'dashboard', policy: POLICY_A }]);

  expect(describeLimits(dashboardA, date(TODAY), date(TODAY))).toEqual({
    line: 'Limit on this dashboard: up to 3 months, within the last 13 months, no future dates.',
    timezone: '',
  });
  expect(describeLimits(globalA(), null, date(TODAY)).line).toBe(
    'Admin limit: up to 3 months, within the last 13 months, no future dates.',
  );
  expect(
    describeLimits(
      limitsFor([{ source: 'dataset', policy: POLICY_A }]),
      null,
      date(TODAY),
      'Europe/Warsaw',
    ),
  ).toEqual({
    line: 'Limit on this dataset: up to 3 months, within the last 13 months, no future dates.',
    timezone: 'Times in Europe/Warsaw.',
  });
});

test('describeLimits on a dashboard says "Limit on this dashboard" for every level, with no full stop', () => {
  const limits = limitsFor([
    {
      source: 'global',
      policy: policy({
        max_look_back: rule(13, 'P1M'),
        max_look_forward: rule(1, 'P1W'),
      }),
    },
    { source: 'dashboard', policy: policy({ max_span: rule(90, 'P1D') }) },
  ]);

  expect(describeLimits(limits, null, date(TODAY), 'CET', true)).toEqual({
    line: 'Limit on this dashboard: up to 90 days, within the last 13 months, up to 1 week ahead',
    timezone: 'Times in CET.',
  });
  expect(describeLimits(globalA(), null, date(TODAY), undefined, true)).toEqual(
    {
      line: 'Limit on this dashboard: up to 3 months, within the last 13 months, no future dates',
      timezone: '',
    },
  );
  expect(describeLimits(NO_LIMITS, null, date(TODAY), 'CET', true)).toEqual({
    line: '',
    timezone: '',
  });
});

test('describeLimitParts gives the limit words without a prefix, as describeLimits uses them', () => {
  const global = limitsFor([
    {
      source: 'global',
      policy: policy({
        max_span: rule(1, 'P1Y'),
        max_look_back: rule(2, 'P1Y'),
      }),
    },
  ]);

  expect(describeLimitParts(global, null, date(TODAY))).toBe(
    'up to 1 year, within the last 2 years',
  );
  expect(describeLimits(global, null, date(TODAY)).line).toBe(
    `Admin limit: ${describeLimitParts(global, null, date(TODAY))}.`,
  );
  expect(describeLimitParts(globalA(), null, date(TODAY))).toBe(
    'up to 3 months, within the last 13 months, no future dates',
  );
  expect(describeLimitParts(NO_LIMITS, null, date(TODAY))).toBe('');
});

test('describeLimits says "Time range limit" for mixed levels', () => {
  const limits = limitsFor([
    {
      source: 'global',
      policy: policy({
        max_look_back: rule(13, 'P1M'),
        max_look_forward: rule(0, 'P1D'),
      }),
    },
    { source: 'dashboard', policy: policy({ max_span: rule(3, 'P1M') }) },
  ]);

  expect(describeLimits(limits, date(TODAY), date(TODAY)).line).toBe(
    'Time range limit: up to 3 months, within the last 13 months, no future dates.',
  );
});

test('describeLimits words zero and forward limits', () => {
  const line = (rules: Partial<Policy>) =>
    describeLimits(
      limitsFor([{ source: 'dashboard', policy: policy(rules) }]),
      null,
      date(TODAY),
    ).line;

  expect(line({ max_look_back: rule(0, 'P1D') })).toBe(
    'Limit on this dashboard: from today.',
  );
  expect(line({ max_look_back: rule(0, 'PT1H') })).toBe(
    'Limit on this dashboard: from now.',
  );
  expect(line({ max_look_forward: rule(0, 'PT1H') })).toBe(
    'Limit on this dashboard: up to now.',
  );
  expect(line({ max_look_forward: rule(2, 'P1W') })).toBe(
    'Limit on this dashboard: up to 2 weeks ahead.',
  );
});

test('describeLimits shows the span that binds a range from its start, or from today without a start', () => {
  const limits = limitsFor([
    { source: 'global', policy: policy({ max_span: rule(90, 'P1D') }) },
    { source: 'global', policy: policy({ max_span: rule(3, 'P1M') }) },
  ]);

  expect(describeLimits(limits, null, date(TODAY)).line).toBe(
    'Admin limit: up to 90 days.',
  );
  expect(
    describeLimits(limits, date('2025-02-01T00:00:00'), date(TODAY)).line,
  ).toBe('Admin limit: up to 3 months.');
});

// Calendar cells are browser-local; the same wall-clock day must give the
// same answer whatever the zone and the time of day of the cell.
const cells = (day: string) => [
  extendedDayjs(`${day}T00:00:00`),
  extendedDayjs(`${day}T23:59:59`),
];

const startDay = (day: string, limits: EffectiveLimits) => {
  const results = cells(day).map(cell => isStartDayDisabled(cell, limits));
  expect(new Set(results).size).toBe(1);
  return results[0] ? 'disabled' : 'enabled';
};

const endDay = (day: string, limits: EffectiveLimits) => {
  const results = cells(day).map(cell => isEndDayDisabled(cell, limits));
  expect(new Set(results).size).toBe(1);
  return results[0] ? 'disabled' : 'enabled';
};

test('greyed days follow the look-back and look-forward', () => {
  process.stdout.write(
    `greyed days zone ${process.env.TZ} offset ${new Date(2025, 4, 31).getTimezoneOffset()}\n`,
  );
  const limits = limitsFor([
    {
      source: 'global',
      policy: policy({
        max_look_back: rule(13, 'P1M'),
        max_look_forward: rule(0, 'P1D'),
      }),
    },
  ]);

  expect({
    start20240429: startDay('2024-04-29', limits),
    start20240430: startDay('2024-04-30', limits),
    end20240429: endDay('2024-04-29', limits),
    end20240430: endDay('2024-04-30', limits),
    end20250601: endDay('2025-06-01', limits),
    end20250602: endDay('2025-06-02', limits),
  }).toEqual({
    start20240429: 'disabled',
    start20240430: 'enabled',
    end20240429: 'disabled',
    end20240430: 'enabled',
    end20250601: 'enabled',
    end20250602: 'disabled',
  });
});

test('calendar days inside absolute limits stay enabled regardless of span', () => {
  const limits = globalA();

  expect({
    start20250227: startDay('2025-02-27', limits),
    start20250228: startDay('2025-02-28', limits),
    start20250301: startDay('2025-03-01', limits),
    end20250528: endDay('2025-05-28', limits),
    end20250529: endDay('2025-05-29', limits),
    end20250530: endDay('2025-05-30', limits),
    end20250531: endDay('2025-05-31', limits),
    end20250601: endDay('2025-06-01', limits),
    end20250602: endDay('2025-06-02', limits),
  }).toEqual({
    start20250227: 'enabled',
    start20250228: 'enabled',
    start20250301: 'enabled',
    end20250528: 'enabled',
    end20250529: 'enabled',
    end20250530: 'enabled',
    end20250531: 'enabled',
    end20250601: 'enabled',
    end20250602: 'disabled',
  });
});

test('calendar availability does not imply a valid range span', () => {
  const limits = globalA();
  expect(startDay('2025-02-27', limits)).toBe('enabled');
  expect(
    check('2025-02-27T23:59:59', '2025-05-31T00:00:00', limits),
  ).not.toHaveLength(0);
  expect(endDay('2025-05-29', limits)).toBe('enabled');
  expect(
    check('2025-02-28T00:00:00', '2025-05-29T00:00:00', limits),
  ).not.toHaveLength(0);
  expect(endDay('2025-06-02', limits)).toBe('disabled');
});

test('dashboardLimitLevels: global, each dataset with a policy, then dashboard', () => {
  const span = {
    max_span: rule(4, 'P1W'),
    max_look_back: null,
    max_look_forward: null,
  };
  const levels = dashboardLimitLevels({
    global: { max_span: null, max_look_back: null, max_look_forward: null },
    dashboard: {
      max_span: rule(3, 'P1M'),
      max_look_back: null,
      max_look_forward: null,
    },
    datasets: [{ id: 7, name: 'calls', policy: span }],
    timezone: 'Europe/Warsaw',
  });

  expect(levels).toEqual([
    {
      source: 'global',
      policy: { max_span: null, max_look_back: null, max_look_forward: null },
    },
    { source: 'dataset', policy: span },
    {
      source: 'dashboard',
      policy: {
        max_span: rule(3, 'P1M'),
        max_look_back: null,
        max_look_forward: null,
      },
    },
  ]);
  expect(hasLimits(levels)).toBe(true);
});

test('dashboardLimitLevels: unset levels and no datasets have no limits', () => {
  const unset = { max_span: null, max_look_back: null, max_look_forward: null };
  const levels = dashboardLimitLevels({
    global: unset,
    dashboard: unset,
    datasets: [],
  });

  expect(levels.map(level => level.source)).toEqual(['global', 'dashboard']);
  expect(hasLimits(levels)).toBe(false);
});

const warsawLimits = (rules: Partial<Policy>, now: string) =>
  limitsFor(
    dashboardLimitLevels({
      global: policy(rules),
      dashboard: policy(),
      datasets: [],
      timezone: 'Europe/Warsaw',
    }),
    `${now.slice(0, 10)}T00:00:00`,
    now,
  );

const dstBounds = () => ({
  springHoursBack: iso(
    warsawLimits({ max_look_back: rule(6, 'PT1H') }, '2026-03-29T08:00:00')
      .earliestStart?.value,
  ),
  autumnHoursBack: iso(
    warsawLimits({ max_look_back: rule(6, 'PT1H') }, '2026-10-25T05:00:00')
      .earliestStart?.value,
  ),
  springHoursForward: iso(
    warsawLimits({ max_look_forward: rule(2, 'PT1H') }, '2026-03-29T00:30:00')
      .latestEnd?.value,
  ),
  springDayBack: iso(
    warsawLimits({ max_look_back: rule(1, 'P1D') }, '2026-03-29T14:30:00')
      .earliestStart?.value,
  ),
  springOneCalendarDay: check(
    '2026-03-29T00:00:00',
    '2026-03-30T00:00:00',
    warsawLimits({ max_span: rule(1, 'P1D') }, '2026-03-29T14:30:00'),
  ),
  springDayBackAcrossTheChange: iso(
    warsawLimits({ max_look_back: rule(1, 'P1D') }, '2026-03-30T10:00:00')
      .earliestStart?.value,
  ),
  autumnOneCalendarDay: check(
    '2026-10-25T00:00:00',
    '2026-10-26T00:00:00',
    warsawLimits({ max_span: rule(1, 'P1D') }, '2026-10-25T14:30:00'),
  ),
});

const DST_BOUNDS = {
  springHoursBack: '2026-03-29T02:00:00',
  autumnHoursBack: '2026-10-24T23:00:00',
  springHoursForward: '2026-03-29T02:30:00',
  springDayBack: '2026-03-28T00:00:00',
  springOneCalendarDay: [],
  springDayBackAcrossTheChange: '2026-03-29T00:00:00',
  autumnOneCalendarDay: [],
};

test('DST: sub-day bounds follow the server wall clock, days start at midnight', () => {
  expect(dstBounds()).toEqual(DST_BOUNDS);
});

test('a dataset level fails "Last quarter" with the dataset span', () => {
  const levels = dashboardLimitLevels({
    global: null,
    dashboard: null,
    datasets: [
      {
        id: 7,
        name: 'calls',
        policy: {
          max_span: rule(4, 'P1W'),
          max_look_back: null,
          max_look_forward: null,
        },
      },
    ],
  });
  const limits = effectiveLimits(
    levels,
    date(TODAY),
    date(NOW),
  ) as EffectiveLimits;
  const failures = allFailures(
    { since: date('2025-02-28T00:00:00'), until: date('2025-05-31T00:00:00') },
    limits,
  );

  expect(failures.map(failure => describeFailure(failure))).toEqual([
    "Range can't be longer than 4 weeks. This one is 13 weeks and 1 day.",
  ]);
  expect(failures[0].limit?.source).toBe('dataset');
});

const value = (quantity: number, timeGrain: string): RuleValue => ({
  quantity,
  time_grain: timeGrain,
});

// the rule table's comparison cases.
test.each([
  [value(90, 'P1D'), value(1, 'P1Y'), true],
  [value(12, 'P1M'), value(1, 'P1Y'), true],
  [value(52, 'P1W'), value(1, 'P1Y'), true],
  [value(365, 'P1D'), value(1, 'P1Y'), true],
  [value(366, 'P1D'), value(1, 'P1Y'), false],
  [value(4, 'P1W'), value(1, 'P1M'), true],
  [value(28, 'P1D'), value(1, 'P1M'), true],
  [value(31, 'P1D'), value(1, 'P1M'), false],
  [value(1, 'P3M'), value(3, 'P1M'), true],
  [value(3, 'P1M'), value(90, 'P1D'), false],
  [value(1, 'P1Y'), value(365, 'P1D'), false],
  [value(24, 'PT15M'), value(6, 'PT1H'), true],
  [value(48, 'PT1H'), value(2, 'P1D'), false],
  [value(2, 'P1D'), value(48, 'PT1H'), false],
  [value(12, 'P1W'), value(12, 'P1W'), true],
  [value(13, 'P1W'), value(12, 'P1W'), false],
  [value(4, 'P1W'), value(1, 'P1M'), true],
  [value(5, 'P1W'), value(1, 'P1M'), false],
  [value(4, 'P3M'), value(1, 'P1Y'), true],
  [value(1, 'P1Y'), value(4, 'P3M'), true],
  [value(2, 'PT30M'), value(1, 'PT1H'), true],
  [value(1, 'PT1H'), value(2, 'PT30M'), true],
  [value(2, 'PT0.5H'), value(1, 'PT1H'), true],
  [value(1, 'PT1H'), value(2, 'PT0.5H'), true],
  [value(4, 'P0.25Y'), value(1, 'P1Y'), true],
  [value(1, 'P1Y'), value(4, 'P0.25Y'), true],
  [value(0, 'P1D'), value(0, 'PT1H'), false],
  [value(1, 'PT1S'), value(9999, 'P1Y'), false],
  [value(1, 'P1D'), value(1, 'P1X'), false],
])('neverLonger(%o, %o) is %s', (rule, limit, expected) => {
  expect(neverLonger(rule, limit)).toBe(expected);
});

// The server's `_shift`: whole months from a day, clamped to the month's end.
const shiftMonths = (start: Date, months: number) => {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay));
};

test('neverLonger bounds hold against a brute-force day count', () => {
  const real = new Map<number, { min: number; max: number }>();
  const first = Date.UTC(2096, 0, 1);
  const last = Date.UTC(2104, 11, 31);
  for (let day = first; day <= last; day += 86_400_000) {
    const start = new Date(day);
    for (let months = 1; months <= 36; months += 1) {
      const found = real.get(months) ?? { min: Infinity, max: 0 };
      [shiftMonths(start, months), shiftMonths(start, -months)].forEach(end => {
        const days = Math.abs(end - day) / 86_400_000;
        found.min = Math.min(found.min, days);
        found.max = Math.max(found.max, days);
      });
      real.set(months, found);
    }
  }
  real.forEach(({ min, max }, months) => {
    const month = value(months, 'P1M');
    // The longest day count accepted under `months`, and the shortest
    // day limit `months` is accepted under: the bounds neverLonger uses.
    let minDays = 0;
    while (neverLonger(value(minDays + 1, 'P1D'), month)) {
      minDays += 1;
    }
    let maxDays = 0;
    while (!neverLonger(month, value(maxDays, 'P1D'))) {
      maxDays += 1;
    }
    expect(minDays).toBeLessThanOrEqual(min);
    expect(maxDays).toBeGreaterThanOrEqual(max);
    if (months <= 12) {
      expect([minDays, maxDays]).toEqual([min, max]);
    }
    for (let days = 1; days <= 1100; days += 1) {
      const dayRule = value(days, 'P1D');
      if (neverLonger(dayRule, month)) {
        expect(days).toBeLessThanOrEqual(min);
      }
      if (neverLonger(month, dayRule)) {
        expect(max).toBeLessThanOrEqual(days);
      }
      if (months <= 12) {
        expect(neverLonger(dayRule, month)).toBe(days <= min);
        expect(neverLonger(month, dayRule)).toBe(max <= days);
      }
    }
  });
});

test('sameFamily splits sub-day units from day units', () => {
  expect(sameFamily('P1D', 'P1Y')).toBe(true);
  expect(sameFamily('PT1S', 'PT1H')).toBe(true);
  expect(sameFamily('PT1H', 'P1D')).toBe(false);
});

const GRAINS = [
  { value: 'PT1S', label: 'Second' },
  { value: 'PT1H', label: 'Hour' },
  { value: 'P1D', label: 'Day' },
  { value: 'P1W', label: 'Week' },
  { value: 'P1M', label: 'Month' },
  { value: 'P1Y', label: 'Year' },
];

test('allowedUnits', () => {
  const values = (units: { value: string }[]) => units.map(unit => unit.value);
  expect(values(allowedUnits(rule(1, 'P1Y'), GRAINS))).toEqual([
    'P1D',
    'P1W',
    'P1M',
    'P1Y',
  ]);
  expect(values(allowedUnits(rule(6, 'PT1H'), GRAINS))).toEqual([
    'PT1S',
    'PT1H',
  ]);
  expect(allowedUnits(null, GRAINS)).toEqual(GRAINS);
  expect(allowedUnits(rule(2, 'P1D'), GRAINS, 'PT1H').at(-1)).toEqual({
    value: 'PT1H',
    label: 'Hour',
  });
  expect(allowedUnits(null, GRAINS, 'P1X').at(-1)).toEqual({
    value: 'P1X',
    label: 'P1X',
  });
  expect(allowedUnits(null, GRAINS, 'P1W')).toEqual(GRAINS);
  expect(allowedUnits(null, [], 'P1D', { P1D: 'Day' })).toEqual([
    { value: 'P1D', label: 'Day' },
  ]);
  expect(allowedUnits(null, [], 'P1D', {})).toEqual([
    { value: 'P1D', label: 'P1D' },
  ]);
});

test('looserThanGlobal', () => {
  expect(
    looserThanGlobal('max_span', value(13, 'P1W'), rule(12, 'P1W')),
  ).toEqual({
    field: 'quantity',
    message: "Can't be longer than the admin limit (12 weeks)",
  });
  expect(
    looserThanGlobal('max_span', value(366, 'P1D'), rule(1, 'P1Y')),
  ).toEqual({
    field: 'quantity',
    message: "Can't be longer than the admin limit (1 year)",
  });
  expect(
    looserThanGlobal('max_look_back', value(48, 'PT1H'), rule(2, 'P1D')),
  ).toEqual({
    field: 'time_grain',
    message: "Can't be earlier than the admin limit (2 days ago)",
  });
  expect(
    looserThanGlobal('max_look_forward', value(7, 'PT1H'), rule(6, 'PT1H')),
  ).toEqual({
    field: 'quantity',
    message: "Can't be later than the admin limit (6 hours from now)",
  });
  expect(
    looserThanGlobal('max_span', value(90, 'P1D'), rule(1, 'P1Y')),
  ).toBeNull();
  expect(looserThanGlobal('max_span', value(900, 'P1Y'), null)).toBeNull();
});

test('looserThanGlobal words each rule as the editor shows it', () => {
  expect(
    looserThanGlobal('max_look_back', value(3, 'P1Y'), rule(2, 'P1Y')),
  ).toEqual({
    field: 'quantity',
    message: "Can't be earlier than the admin limit (2 years ago)",
  });
  expect(
    looserThanGlobal('max_look_forward', value(2, 'P1W'), rule(1, 'P1W'))
      ?.message,
  ).toBe("Can't be later than the admin limit (1 week from now)");
  expect(
    looserThanGlobal('max_look_forward', value(1, 'P1D'), rule(0, 'P1D'))
      ?.message,
  ).toBe("Can't be later than the admin limit (Today)");
  expect(
    looserThanGlobal('max_span', value(3, 'P3M'), rule(2, 'P3M'))?.message,
  ).toBe("Can't be longer than the admin limit (2 quarters)");
});

test('ruleLabels and ruleDescriptions give the editor labels and descriptions', () => {
  expect(ruleLabels()).toEqual({
    max_span: 'Longest range',
    max_look_back: 'Earliest start',
    max_look_forward: 'Latest end',
  });
  expect(ruleDescriptions()).toEqual({
    max_span: 'Start-to-end duration.',
    max_look_back: 'Earliest start from now.',
    max_look_forward: 'Latest end from now.',
  });
});

test.each([
  ['max_span', rule(1, 'P1Y'), undefined, '1 year'],
  ['max_span', rule(2, 'P3M'), undefined, '2 quarters'],
  ['max_look_back', rule(2, 'P1Y'), undefined, '2 years ago'],
  ['max_look_back', rule(0, 'P1D'), undefined, 'Today'],
  ['max_look_back', rule(0, 'PT1H'), undefined, 'Now'],
  ['max_look_forward', rule(1, 'P1W'), undefined, '1 week from now'],
  ['max_look_forward', rule(0, 'P1W'), undefined, 'Today'],
  ['max_look_forward', rule(0, 'PT30M'), undefined, 'Now'],
  ['max_look_back', rule(5, 'P1Y'), 'five years', 'five years ago'],
  ['max_span', rule(30, 'PT1M'), '30 minutes', '30 minutes'],
] as const)(
  'describeRuleValue %s %o (%s) is %s',
  (name, limit, duration, label) => {
    expect(describeRuleValue(name, limit as RuleValue, duration)).toBe(label);
  },
);

test('effectiveRuleLabel words each part in the rule style', () => {
  expect(effectiveRuleLabel('max_look_back', rule(2, 'P1Y'), null)).toBe(
    '2 years ago',
  );
  expect(
    effectiveRuleLabel('max_look_back', rule(2, 'P1D'), rule(48, 'PT1H')),
  ).toBe('2 days ago and 48 hours ago; both enforced');
  expect(
    effectiveRuleLabel('max_look_forward', rule(1, 'P1W'), rule(0, 'P1D')),
  ).toBe('Today');
  expect(effectiveRuleLabel('max_look_forward', null, null)).toBe('No limit');
});

// Expected labels and sources from the server's `effective_rule`.
test.each([
  [rule(1, 'P1Y'), rule(90, 'P1D'), '90 days', ['dashboard']],
  [rule(1, 'P1Y'), rule(12, 'P1M'), '1 year', ['global']],
  [
    rule(2, 'P1D'),
    rule(48, 'PT1H'),
    '2 days and 48 hours; both enforced',
    ['global', 'dashboard'],
  ],
  [
    rule(3, 'P1M'),
    rule(90, 'P1D'),
    '3 months and 90 days; both enforced',
    ['global', 'dashboard'],
  ],
  [rule(2, 'P1M'), rule(9, 'P1W'), '2 months', ['global']],
  [rule(12, 'P1W'), rule(9, 'P1W'), '9 weeks', ['dashboard']],
  [rule(12, 'P1M'), rule(6, 'P1M'), '6 months', ['dashboard']],
  [rule(3, 'P1M'), rule(1, 'P1M'), '1 month', ['dashboard']],
  [null, rule(90, 'P1D'), '90 days', ['dashboard']],
  [rule(12, 'P1W'), null, '12 weeks', ['global']],
  [null, null, 'No limit', []],
  [rule(1, 'P3M'), rule(3, 'P1M'), '1 quarter', ['global']],
  [rule(6, 'PT1H'), rule(24, 'PT15M'), '6 hours', ['global']],
  [
    rule(1, 'P1M'),
    rule(30, 'P1D'),
    '1 month and 30 days; both enforced',
    ['global', 'dashboard'],
  ],
  [rule(1, 'P0.25Y'), rule(1, 'P3M'), '1 quarter', ['global']],
  [rule(2, 'PT0.5H'), rule(1, 'PT1H'), '60 minutes', ['global']],
])(
  'effectiveRuleLabel matches the server: %o and %o',
  (globalRule, dashboardRule, label, sources) => {
    expect(effectiveRuleLabel('max_span', globalRule, dashboardRule)).toBe(
      label,
    );
    expect(
      effectiveConstraints(globalRule, dashboardRule).map(item => item.source),
    ).toEqual(sources);
  },
);

test('stricterThan', () => {
  expect(stricterThan(value(4, 'P1W'), rule(90, 'P1D'))).toBe(true);
  expect(stricterThan(value(90, 'P1D'), rule(90, 'P1D'))).toBe(false);
  expect(stricterThan(value(12, 'P1M'), rule(1, 'P1Y'))).toBe(false);
  expect(stricterThan(value(120, 'P1D'), rule(90, 'P1D'))).toBe(false);
  expect(stricterThan(value(48, 'PT1H'), rule(90, 'P1D'))).toBeNull();
  expect(stricterThan(value(3, 'P1M'), rule(90, 'P1D'))).toBeNull();
  expect(stricterThan(value(90, 'P1D'), rule(3, 'P1M'))).toBeNull();
  expect(stricterThan(value(4, 'P1W'), null)).toBe(true);
});

test('completeRule keeps a draft with both parts and drops a partial or empty one', () => {
  expect(completeRule({ quantity: 13, time_grain: 'P1M' })).toEqual({
    quantity: 13,
    time_grain: 'P1M',
  });
  expect(completeRule({ quantity: 0, time_grain: 'P1D' })).toEqual({
    quantity: 0,
    time_grain: 'P1D',
  });
  expect(completeRule({ quantity: 3, time_grain: null })).toBeNull();
  expect(completeRule({ quantity: null, time_grain: 'P1W' })).toBeNull();
  expect(completeRule({ quantity: null, time_grain: null })).toBeNull();
});

test('effectiveConstraints', () => {
  expect(effectiveConstraints(rule(1, 'P1Y'), rule(90, 'P1D'))).toEqual([
    { source: 'dashboard', quantity: 90, time_grain: 'P1D' },
  ]);
  expect(effectiveConstraints(rule(3, 'P1M'), rule(90, 'P1D'))).toEqual([
    { source: 'global', quantity: 3, time_grain: 'P1M' },
    { source: 'dashboard', quantity: 90, time_grain: 'P1D' },
  ]);
  expect(effectiveConstraints(null, rule(4, 'P1W'), 'dataset')).toEqual([
    { source: 'dataset', quantity: 4, time_grain: 'P1W' },
  ]);
  expect(effectiveConstraints(null, null)).toEqual([]);
});

test('rule shape errors', () => {
  const draft = (quantity: number | null, timeGrain: string | null) => ({
    quantity,
    time_grain: timeGrain,
  });
  expect(ruleShapeErrors('max_span', draft(null, null))).toEqual({});
  expect(ruleShapeErrors('max_span', draft(1, 'P1D'))).toEqual({});
  expect(ruleShapeErrors('max_look_back', draft(0, 'P1D'))).toEqual({});
  expect(ruleShapeErrors('max_span', draft(9999, 'P1D'))).toEqual({});
  expect(ruleShapeErrors('max_span', draft(3, null))).toEqual({
    time_grain: 'Select a unit.',
  });
  expect(ruleShapeErrors('max_span', draft(null, 'P1D'))).toEqual({});
  expect(ruleShapeErrors('max_look_back', draft(null, 'P1D'))).toEqual({});
  expect(ruleShapeErrors('max_span', draft(0, 'P1D'))).toEqual({
    quantity: 'Enter a whole number from 1 to 9999.',
  });
  expect(ruleShapeErrors('max_look_forward', draft(10000, 'P1D'))).toEqual({
    quantity: 'Enter a whole number from 0 to 9999.',
  });
  expect(ruleShapeErrors('max_look_back', draft(1.5, 'P1D'))).toEqual({
    quantity: 'Enter a whole number from 0 to 9999.',
  });
});

test('zero window', () => {
  const message =
    "Look-back and look-forward can't both be 0: no time range would fit.";
  const zero = rule(0, 'P1D');
  expect(
    zeroWindowError(null, { max_look_back: zero, max_look_forward: zero }),
  ).toBe(message);
  expect(
    zeroWindowError(policy({ max_look_back: zero }), {
      max_look_back: rule(3, 'P1M'),
      max_look_forward: rule(0, 'PT1H'),
    }),
  ).toBe(message);
  expect(
    zeroWindowError(policy(), {
      max_look_back: zero,
      max_look_forward: rule(1, 'P1D'),
    }),
  ).toBeNull();
  expect(
    zeroWindowError(null, { max_look_back: null, max_look_forward: zero }),
  ).toBeNull();
});

// Chart ranges: the fixtures are endpoint answers from the integration tests.

const SERVER_NOW = '2026-10-30T12:00:00';
const SERVER_TODAY = '2026-10-30T00:00:00';
const SPAN_30 = policy({ max_span: rule(30, 'P1D') });
const SPAN_60 = policy({ max_span: rule(60, 'P1D') });

const range = (
  since: string | null,
  until: string | null,
  extra: Partial<ChartRange> = {},
): ChartRange => ({
  since,
  until,
  time_offset: null,
  source: [{ kind: 'adhoc_filter', query_index: 0, index: 0 }],
  ...extra,
});

const LAST_45_DAYS = range('2026-09-15T00:00:00', '2026-10-30T00:00:00');

const call = (
  charts: Record<string, unknown>[],
  keys = charts.map(chart => chart.key as string),
): ChartRangesCall => ({
  keys,
  result: {
    now: SERVER_NOW,
    today: SERVER_TODAY,
    timezone: 'UTC',
    charts: charts.map(chart => ({
      status: 'ok',
      dataset_id: 7,
      dashboard_id: null,
      ...chart,
    })) as never,
  },
});

test('judgeChartRanges: each chart with its own dataset, the dashboard only when the server applies it', () => {
  const judgements = judgeChartRanges(
    [
      call([
        { key: 'on', ranges: [LAST_45_DAYS], dashboard_id: 1 },
        { key: 'probe N', ranges: [LAST_45_DAYS] },
        { key: 'strict dataset', ranges: [LAST_45_DAYS], dataset_id: 8 },
      ]),
    ],
    {
      global: SPAN_60,
      dashboard: SPAN_30,
      datasets: [
        { id: 7, name: 'events', policy: policy() },
        { id: 8, name: 'strict', policy: SPAN_30 },
      ],
    },
  );

  expect(judgements['probe N']).toEqual({ status: 'valid' });
  expect(judgements.on).toMatchObject({
    status: 'invalid',
    failures: [
      {
        reason: 'MAX_SPAN_EXCEEDED',
        limit: { source: 'dashboard' },
        message: "Range can't be longer than 30 days. This one is 45 days.",
        range: LAST_45_DAYS,
      },
    ],
  });
  expect(judgements['strict dataset']).toMatchObject({
    status: 'invalid',
    failures: [{ reason: 'MAX_SPAN_EXCEEDED', limit: { source: 'dataset' } }],
  });
});

test('judgeChartRanges: no limit for the chart runs it, an open range too', () => {
  const judgements = judgeChartRanges(
    [
      call([
        { key: 'open', ranges: [range(null, null, { source: null })] },
        { key: 'other dataset', ranges: [range(null, null)], dataset_id: 9 },
      ]),
    ],
    {
      global: null,
      dashboard: SPAN_30,
      datasets: [{ id: 8, name: 'strict', policy: SPAN_30 }],
    },
  );

  expect(judgements).toEqual({
    open: { status: 'valid' },
    'other dataset': { status: 'valid' },
  });
});

test('judgeChartRanges: open at both ends is unbounded, open at one end invalid', () => {
  const judgements = judgeChartRanges(
    [
      call([
        { key: 'K', ranges: [range(null, null, { source: null })] },
        { key: 'J', ranges: [range(null, null)], dashboard_id: 1 },
        { key: 'no end', ranges: [range('2026-10-23T00:00:00', null)] },
        { key: 'no start', ranges: [range(null, '2026-10-30T00:00:00')] },
      ]),
    ],
    { global: SPAN_60, dashboard: policy() },
  );

  expect(judgements.K).toMatchObject({
    status: 'unbounded',
    failures: [
      {
        reason: 'UNBOUNDED_RANGE',
        message: 'Choose a start and an end date. Time range limits are on.',
      },
    ],
  });
  expect(judgements.J).toMatchObject({
    status: 'unbounded',
    failures: [
      {
        message:
          'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
      },
    ],
  });
  expect(judgements['no end']).toMatchObject({
    status: 'invalid',
    failures: [
      {
        reason: 'UNBOUNDED_RANGE',
        field: 'end',
        message: 'An end date is required.',
      },
    ],
  });
  expect(judgements['no start']).toMatchObject({
    status: 'invalid',
    failures: [{ reason: 'UNBOUNDED_RANGE', field: 'range' }],
  });
});

test('judgeChartRanges: every failure of every range, offsets named, first failure first', () => {
  const offset = range('2020-01-01T00:00:00', '2020-01-08T00:00:00', {
    time_offset: '2020-01-01',
    source: [{ kind: 'time_comparison', query_index: 0, index: 0 }],
  });
  const judgements = judgeChartRanges(
    [
      call([
        {
          key: 'D3',
          ranges: [range('2026-10-23T00:00:00', '2026-10-30T00:00:00'), offset],
        },
        {
          key: 'two rules',
          ranges: [range('2024-01-01T00:00:00', '2026-10-30T00:00:00')],
        },
      ]),
    ],
    {
      global: policy({
        max_span: rule(60, 'P1D'),
        max_look_back: rule(400, 'P1D'),
      }),
    },
  );

  expect(judgements.D3).toMatchObject({
    status: 'invalid',
    failures: [
      {
        reason: 'MAX_LOOK_BACK_EXCEEDED',
        message:
          'Time comparison "2020-01-01": Start can\'t be earlier than Sep 25, 2025 (400 days ago).',
        range: offset,
      },
    ],
  });
  expect(
    (
      judgements['two rules'] as { failures: { reason: string }[] }
    ).failures.map(failure => failure.reason),
  ).toEqual(['MAX_SPAN_EXCEEDED', 'MAX_LOOK_BACK_EXCEEDED']);
});

test('judgeChartRanges: the server clock decides, not the browser clock', () => {
  const lastWeek = range('2026-10-23T00:00:00', '2026-10-30T00:00:00');
  const judge = (now: string, today: string) =>
    judgeChartRanges(
      [
        {
          keys: ['c'],
          result: {
            now,
            today,
            timezone: 'UTC',
            charts: [
              {
                key: 'c',
                status: 'ok',
                ranges: [lastWeek],
                dataset_id: null,
                dashboard_id: null,
              },
            ],
          },
        },
      ],
      { global: policy({ max_look_back: rule(10, 'P1D') }) },
    ).c.status;

  expect(judge(SERVER_NOW, SERVER_TODAY)).toBe('valid');
  expect(judge('2026-11-20T12:00:00', '2026-11-20T00:00:00')).toBe('invalid');
});

test('judgeChartRanges: an unknown time grain or a failed call is unavailable', () => {
  const judgements = judgeChartRanges(
    [
      call([{ key: 'odd grain', ranges: [LAST_45_DAYS] }]),
      { keys: ['a', 'b'], failed: true },
      call([], ['lost']),
    ],
    {
      global: policy({ max_span: rule(1, 'P2Q') }),
    },
  );

  expect(judgements).toEqual({
    'odd grain': { status: 'unavailable' },
    a: { status: 'unavailable' },
    b: { status: 'unavailable' },
    lost: { status: 'unavailable' },
  });
});

test('judgeChartRanges: a chart the server could not read gets its route error', () => {
  const error = {
    status: 403,
    body: { errors: [{ error_type: 'DATASOURCE_SECURITY_ACCESS_ERROR' }] },
  };
  const judgements = judgeChartRanges(
    [
      {
        keys: ['denied', 'good'],
        result: {
          now: SERVER_NOW,
          today: SERVER_TODAY,
          timezone: 'UTC',
          charts: [
            { key: 'denied', status: 'error', error },
            {
              key: 'good',
              status: 'ok',
              ranges: [range('2026-10-23T00:00:00', '2026-10-30T00:00:00')],
              dataset_id: 7,
              dashboard_id: null,
            },
          ],
        },
      },
    ],
    { global: SPAN_60 },
  );

  expect(judgements).toEqual({
    denied: { status: 'error', error },
    good: { status: 'valid' },
  });
});

const CHART_RANGES_URL = 'glob:*/api/v1/time_range_limits/chart_ranges/';

const entries = (count: number): ChartRangesEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `c${index}`,
    query_context: { datasource: { id: 7, type: 'table' }, queries: [] },
  }));

const withClient = async (run: () => Promise<void>) => {
  jest.useRealTimers();
  fetchMock.mockGlobal();
  fetchMock.get('glob:*/api/v1/security/csrf_token/', { result: 'token' });
  SupersetClient.reset();
  await SupersetClient.configure({
    protocol: 'http:',
    host: 'localhost',
  }).init();
  try {
    await run();
  } finally {
    fetchMock.hardReset();
    jest.useFakeTimers().setSystemTime(new Date('2031-01-15T03:00:00Z'));
  }
};

const answer = (charts: ChartRangesEntry[]) => ({
  result: {
    now: SERVER_NOW,
    today: SERVER_TODAY,
    timezone: 'UTC',
    charts: charts.map(chart => ({
      key: chart.key,
      status: 'ok',
      ranges: [],
      dataset_id: 7,
      dashboard_id: null,
    })),
  },
});

test('fetchChartRanges: one POST per 50 entries, with no retry and a 10 s timeout', async () => {
  await withClient(async () => {
    const post = jest.spyOn(SupersetClient, 'post');
    fetchMock.post(CHART_RANGES_URL, ({ options }) =>
      answer(JSON.parse(String(options.body)).charts),
    );

    const calls = await fetchChartRanges(entries(230));

    expect(CHART_RANGES_MAX_CHARTS).toBe(50);
    expect(calls.map(item => item.keys.length)).toEqual([50, 50, 50, 50, 30]);
    expect(calls.every(item => 'result' in item)).toBe(true);
    expect(post).toHaveBeenCalledTimes(5);
    expect(post.mock.calls[0][0]).toMatchObject({
      endpoint: '/api/v1/time_range_limits/chart_ranges/',
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    });
    const sent = fetchMock.callHistory
      .calls(CHART_RANGES_URL)
      .map(item => JSON.parse(String(item.options.body)).charts.length);
    expect(sent).toEqual([50, 50, 50, 50, 30]);
    expect(fetchMock.callHistory.calls('glob:*/api/v1/time_range/*')).toEqual(
      [],
    );
    post.mockRestore();
  });
});

const TIME_RANGE_URL = 'glob:*/api/v1/time_range/*';

const timeRangeResult = {
  result: [
    { since: '2025-05-24T00:00:00', until: '2025-05-31T00:00:00' },
    { since: TODAY, until: NOW },
  ],
};

const SPAN_RULE: Level[] = [{ source: 'global', policy: SPAN_60 }];

test('checkTimeRange: with limits on the call has a 10 s timeout and no retry', async () => {
  await withClient(async () => {
    const get = jest.spyOn(SupersetClient, 'get');
    fetchMock.get(TIME_RANGE_URL, timeRangeResult);

    const check = await checkTimeRange('Last week', SPAN_RULE);

    expect(check.status).toBe('checked');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toMatchObject({
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    });
    get.mockRestore();
  });
});

test('checkTimeRange: a timeout is an unavailable check, another failure an error one', async () => {
  await withClient(async () => {
    const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue({
      error: 'Request timed out',
      statusText: 'timeout',
      timeout: 10000,
    });

    const check = await checkTimeRange('Last week', SPAN_RULE);

    expect(check).toEqual({ timeRange: 'Last week', status: 'unavailable' });

    get.mockRejectedValue({ error: 'Server error', statusText: 'Bad Gateway' });

    expect(await checkTimeRange('Last week', SPAN_RULE)).toEqual({
      timeRange: 'Last week',
      status: 'error',
      message: 'Bad Gateway',
    });
    get.mockRestore();
  });
});

test('checkTimeRange: a 5xx response is an unavailable check, a 400 an error one', async () => {
  await withClient(async () => {
    const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue({
      error: 'Service Unavailable',
      statusText: 'Service Unavailable',
      status: 503,
    });

    expect(await checkTimeRange('Last week', SPAN_RULE)).toEqual({
      timeRange: 'Last week',
      status: 'unavailable',
    });

    get.mockRejectedValue({
      error: 'Bad request',
      statusText: 'Bad Request',
      status: 400,
    });

    expect(await checkTimeRange('Last week', SPAN_RULE)).toEqual({
      timeRange: 'Last week',
      status: 'error',
      message: 'Bad Request',
    });
    get.mockRestore();
  });
});

test('checkTimeRange: with no limit the call is the plain request', async () => {
  await withClient(async () => {
    const get = jest.spyOn(SupersetClient, 'get');
    fetchMock.get(TIME_RANGE_URL, timeRangeResult);

    await checkTimeRange('Last week', [{ source: 'global', policy: null }]);

    expect(get).toHaveBeenCalledTimes(1);
    expect(Object.keys(get.mock.calls[0][0])).toEqual(['endpoint']);
    get.mockRestore();
  });
});

test.each([
  [50, [50]],
  [51, [50, 1]],
  [100, [50, 50]],
  [101, [50, 50, 1]],
])('fetchChartRanges: %i entries go in calls of %j', async (count, sizes) => {
  await withClient(async () => {
    fetchMock.post(CHART_RANGES_URL, ({ options }) =>
      answer(JSON.parse(String(options.body)).charts),
    );

    const calls = await fetchChartRanges(entries(count));

    expect(calls.map(item => item.keys.length)).toEqual(sizes);
    expect(
      fetchMock.callHistory
        .calls(CHART_RANGES_URL)
        .map(item => JSON.parse(String(item.options.body)).charts.length),
    ).toEqual(sizes);
  });
});

test('fetchChartRanges: a failed call fails only its own keys', async () => {
  await withClient(async () => {
    let count = 0;
    fetchMock.post(CHART_RANGES_URL, ({ options }) => {
      count += 1;
      return count === 2
        ? { status: 500, body: { errors: [] } }
        : answer(JSON.parse(String(options.body)).charts);
    });

    const calls = await fetchChartRanges(entries(150));
    const judgements = judgeChartRanges(calls, { global: SPAN_60 });

    expect('failed' in calls[1]).toBe(true);
    expect(judgements.c0).toEqual({ status: 'valid' });
    expect(judgements.c70).toEqual({ status: 'unavailable' });
    expect(judgements.c120).toEqual({ status: 'valid' });
    expect(await fetchChartRanges([])).toEqual([]);
  });
});

test('a month span steps the month count down when the last month is short', () => {
  expect(
    describeSpanLength(
      { source: 'dashboard', quantity: 1, time_grain: 'P1M' },
      date('2025-01-31T00:00:00'),
      date('2025-03-30T00:00:00'),
    ),
  ).toBe('1 month and 30 days');
});

test('calendar ordering does not disable Start at an exclusive midnight End', () => {
  const limits = limitsFor([
    { source: 'dashboard', policy: policy({ max_span: rule(1, 'P1M') }) },
  ]);
  expect(startDay('2026-10-13', limits)).toBe('enabled');
  expect(startDay('2026-10-12', limits)).toBe('enabled');
});

test('calendar ordering permits End before or on the Start day', () => {
  const limits = limitsFor([
    { source: 'dashboard', policy: policy({ max_span: rule(1, 'P1M') }) },
  ]);
  expect(endDay('2026-10-13', limits)).toBe('enabled');
  expect(endDay('2026-10-12', limits)).toBe('enabled');
});

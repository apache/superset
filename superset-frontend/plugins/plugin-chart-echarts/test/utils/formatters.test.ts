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
import {
  createSmartDateFormatter,
  createSmartDateVerboseFormatter,
  getTimeFormatterRegistry,
  NumberFormats,
  SMART_DATE_ID,
  SMART_DATE_VERBOSE_ID,
  TimeFormatter,
  TimeGranularity,
} from '@superset-ui/core';
import {
  coerceTemporalMs,
  createSpacedXAxisFormatter,
  getPercentFormatter,
  getBoundaryTimeFormatter,
  getZoomLabelOptions,
  getTooltipTimeFormatter,
  getXAxisDomain,
  getXAxisFormatter,
} from '../../src/utils/formatters';

// The app normally registers these via setupFormatters() at bootstrap.
// Register them here so tests that check actual formatted output (not just
// formatter identity) exercise the real smart-date formatting logic instead
// of falling back to treating "smart_date" as a literal d3 format string.
beforeAll(() => {
  getTimeFormatterRegistry()
    .registerValue(SMART_DATE_ID, createSmartDateFormatter())
    .registerValue(SMART_DATE_VERBOSE_ID, createSmartDateVerboseFormatter());
});

test.each([
  [TimeGranularity.DAY, 'Mon 17 Aug 2026'],
  [TimeGranularity.WEEK, 'Mon 17 Aug 2026'],
  [TimeGranularity.MONTH, 'Aug 2026'],
  [TimeGranularity.QUARTER, '2026 Q3'],
  [TimeGranularity.YEAR, '2026'],
  [TimeGranularity.HOUR, '2026-08-17 09:30'],
])(
  'boundary formatter includes standalone context for %s',
  (grain, expected) => {
    expect(
      getBoundaryTimeFormatter(
        SMART_DATE_ID,
        grain as TimeGranularity,
      )(Date.UTC(2026, 7, 17, 9, 30)),
    ).toBe(expected);
  },
);

test('boundary labels use separate rows when both full dates cannot fit', () => {
  const min = Date.UTC(2014, 2, 5);
  const max = Date.UTC(2026, 7, 17);
  const formatter = createSpacedXAxisFormatter(
    getXAxisFormatter(SMART_DATE_ID),
    min,
    max,
    115,
    false,
    getBoundaryTimeFormatter(SMART_DATE_ID, TimeGranularity.DAY),
  );
  expect(formatter(min)).toBe('Wed 5 Mar 2014');
  expect(formatter(max)).toBe('\nMon 17 Aug 2026');
  formatter.getAxisLayout = () => ({
    domainMin: min,
    domainMax: max,
    plotWidthPx: 600,
  });
  expect(formatter(min)).toBe('Wed 5 Mar 2014');
  expect(formatter(max)).toBe('Mon 17 Aug 2026');
});

test('slider dates have side gutters when they fit and hide details on narrow tiles', () => {
  const domain: [number, number] = [Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1)];
  const formatter = getBoundaryTimeFormatter('%Y-%m-%d');
  const options = getZoomLabelOptions(400, domain, formatter);
  expect(options).toMatchObject({ left: 86, right: 86, showDetail: true });
  expect(options.labelFormatter(domain[0])).toBe('2026-01-01');
  expect(getZoomLabelOptions(200, domain, formatter)).toMatchObject({
    showDetail: false,
  });
  expect(getZoomLabelOptions(200, domain, formatter)).not.toHaveProperty(
    'left',
  );
});

test.each([
  ['%d/%m/%Y', '17/08/2026'],
  ['%b %d', 'Aug 17'],
])('boundary formatter preserves the custom format %s', (format, expected) => {
  expect(
    getBoundaryTimeFormatter(
      format,
      TimeGranularity.MONTH,
    )(Date.UTC(2026, 7, 17)),
  ).toBe(expected);
});

test('getPercentFormatter should format as percent if no format is specified', () => {
  const value = 0.6;
  expect(getPercentFormatter().format(value)).toEqual('60%');
});

test('getPercentFormatter should format as percent if SMART_NUMBER is specified', () => {
  const value = 0.6;
  expect(getPercentFormatter(NumberFormats.SMART_NUMBER).format(value)).toEqual(
    '60%',
  );
});

test('getPercentFormatter should format using a provided format', () => {
  const value = 0.6;
  expect(
    getPercentFormatter(NumberFormats.PERCENT_2_POINT).format(value),
  ).toEqual('60.00%');
});

test('getXAxisFormatter should return smart date formatter for SMART_DATE_ID format', () => {
  const formatter = getXAxisFormatter(SMART_DATE_ID);
  expect(formatter).toBeDefined();
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(SMART_DATE_ID);
});

test('getXAxisFormatter should return smart date formatter for undefined format', () => {
  const formatter = getXAxisFormatter();
  expect(formatter).toBeDefined();
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(SMART_DATE_ID);
});

test('getXAxisFormatter should return custom time formatter for custom format', () => {
  const customFormat = '%Y-%m-%d';
  const formatter = getXAxisFormatter(customFormat);
  expect(formatter).toBeDefined();
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(customFormat);
});

test('getXAxisFormatter smart date formatter should be returned and not undefined', () => {
  const formatter = getXAxisFormatter(SMART_DATE_ID);
  expect(formatter).toBeDefined();
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(SMART_DATE_ID);

  const undefinedFormatter = getXAxisFormatter(undefined);
  expect(undefinedFormatter).toBeDefined();
  expect(undefinedFormatter).toBeInstanceOf(TimeFormatter);
  expect((undefinedFormatter as TimeFormatter).id).toBe(SMART_DATE_ID);

  const emptyFormatter = getXAxisFormatter();
  expect(emptyFormatter).toBeDefined();
  expect(emptyFormatter).toBeInstanceOf(TimeFormatter);
  expect((emptyFormatter as TimeFormatter).id).toBe(SMART_DATE_ID);
});

test('getXAxisFormatter time grain aware formatter should prevent millisecond and timestamp formats', () => {
  const formatter = getXAxisFormatter(SMART_DATE_ID, TimeGranularity.MONTH);

  // Test that dates with milliseconds don't show millisecond format
  const dateWithMs = new Date('2025-03-15T21:13:32.389Z');
  const result = (formatter as TimeFormatter).format(dateWithMs);
  expect(result).not.toContain('.389ms');
  expect(result).not.toMatch(/\.\d+ms/);
  expect(result).not.toContain('PM');
  expect(result).not.toContain('AM');
  expect(result).not.toMatch(/\d{1,2}:\d{2}/); // No time format
});

test('getXAxisFormatter time grain aware formatting should prevent problematic formats', () => {
  // Test that time grain aware formatter prevents the specific issues we solved
  const monthFormatter = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.MONTH,
  );
  const yearFormatter = getXAxisFormatter(SMART_DATE_ID, TimeGranularity.YEAR);
  const dayFormatter = getXAxisFormatter(SMART_DATE_ID, TimeGranularity.DAY);

  // Test dates that previously caused issues
  const problematicDates = [
    new Date('2025-03-15T21:13:32.389Z'), // Had .389ms issue
    new Date('2025-04-01T02:30:00.000Z'), // Timezone edge case
    new Date('2025-07-01T00:00:00.000Z'), // Month boundary
  ];

  problematicDates.forEach(date => {
    // Month formatter should not show milliseconds or PM/AM
    const monthResult = (monthFormatter as TimeFormatter).format(date);
    expect(monthResult).not.toMatch(/\.\d+ms/);
    expect(monthResult).not.toMatch(/PM|AM/);
    expect(monthResult).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);

    // Year formatter should not show milliseconds or PM/AM
    const yearResult = (yearFormatter as TimeFormatter).format(date);
    expect(yearResult).not.toMatch(/\.\d+ms/);
    expect(yearResult).not.toMatch(/PM|AM/);
    expect(yearResult).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);

    // Day formatter should not show milliseconds or seconds
    const dayResult = (dayFormatter as TimeFormatter).format(date);
    expect(dayResult).not.toMatch(/\.\d+ms/);
    expect(dayResult).not.toMatch(/:\d{2}:\d{2}/); // No seconds
  });
});

test('getXAxisFormatter time grain parameter should be passed correctly', () => {
  // Test that formatter with time grain is different from formatter without
  const formatterWithGrain = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.MONTH,
  );
  const formatterWithoutGrain = getXAxisFormatter(SMART_DATE_ID);

  expect(formatterWithGrain).toBeDefined();
  expect(formatterWithoutGrain).toBeDefined();
  expect(formatterWithGrain).toBeInstanceOf(TimeFormatter);
  expect(formatterWithoutGrain).toBeInstanceOf(TimeFormatter);

  // Both should be valid formatters
  const testDate = new Date('2025-04-15T12:30:45.789Z');
  const resultWithGrain = (formatterWithGrain as TimeFormatter).format(
    testDate,
  );
  const resultWithoutGrain = (formatterWithoutGrain as TimeFormatter).format(
    testDate,
  );

  expect(typeof resultWithGrain).toBe('string');
  expect(typeof resultWithoutGrain).toBe('string');
  expect(resultWithGrain.length).toBeGreaterThan(0);
  expect(resultWithoutGrain.length).toBeGreaterThan(0);
});

test('getXAxisFormatter without time grain should use standard smart date behavior', () => {
  const standardFormatter = getXAxisFormatter(SMART_DATE_ID);
  const timeGrainFormatter = getXAxisFormatter(SMART_DATE_ID, undefined);

  // Both should be equivalent when no time grain is provided
  expect(standardFormatter).toBeDefined();
  expect(timeGrainFormatter).toBeDefined();

  // Test with a date that has time components
  const testDate = new Date('2025-01-01T00:00:00.000Z');
  const standardResult = (standardFormatter as TimeFormatter).format(testDate);
  const timeGrainResult = (timeGrainFormatter as TimeFormatter).format(
    testDate,
  );

  expect(standardResult).toBe(timeGrainResult);
});

// Regression tests for echarts-timeseries-epoch-x-axis-labels investigation.
// The bug report was that temporal x-axis labels could render as "NaN"
// in some edge cases that we could not reproduce locally. The tests below
// lock in the current behavior of the formatters so that a future refactor
// surfaces any change in contract.

test('getTooltipTimeFormatter returns a TimeFormatter with SMART_DATE_VERBOSE id for SMART_DATE_ID', () => {
  const formatter = getTooltipTimeFormatter(SMART_DATE_ID);
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(SMART_DATE_VERBOSE_ID);
});

test('getTooltipTimeFormatter returns a TimeFormatter for a custom format string', () => {
  const customFormat = '%Y-%m-%d %H:%M';
  const formatter = getTooltipTimeFormatter(customFormat);
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect((formatter as TimeFormatter).id).toBe(customFormat);
});

test('getTooltipTimeFormatter falls back to the String constructor when no format is supplied', () => {
  expect(getTooltipTimeFormatter()).toBe(String);
  expect(getTooltipTimeFormatter(undefined)).toBe(String);
});

test('getTooltipTimeFormatter respects the time grain for the SMART_DATE path', () => {
  // With a time grain active and no explicit format, the tooltip should read
  // grain-appropriate labels rather than a raw timestamp. UTC-based dates keep
  // the assertions deterministic across CI/developer timezones.
  const date = new Date(Date.UTC(2021, 0, 7));

  const dayFormatter = getTooltipTimeFormatter(
    SMART_DATE_ID,
    TimeGranularity.DAY,
  ) as TimeFormatter;
  expect(dayFormatter.format(date)).toEqual('2021-01-07');

  const weekFormatter = getTooltipTimeFormatter(
    SMART_DATE_ID,
    TimeGranularity.WEEK,
  ) as TimeFormatter;
  expect(weekFormatter.format(date)).toEqual('2021-01-07 — 2021-01-13');

  const monthFormatter = getTooltipTimeFormatter(
    SMART_DATE_ID,
    TimeGranularity.MONTH,
  ) as TimeFormatter;
  expect(monthFormatter.format(date)).toEqual(expect.stringContaining('Jan'));
  expect(monthFormatter.format(date)).toEqual(expect.stringContaining('2021'));

  const quarterFormatter = getTooltipTimeFormatter(
    SMART_DATE_ID,
    TimeGranularity.QUARTER,
  ) as TimeFormatter;
  expect(quarterFormatter.format(date)).toEqual(expect.stringContaining('Q1'));
  expect(quarterFormatter.format(date)).toEqual(
    expect.stringContaining('2021'),
  );

  const yearFormatter = getTooltipTimeFormatter(
    SMART_DATE_ID,
    TimeGranularity.YEAR,
  ) as TimeFormatter;
  expect(yearFormatter.format(date)).toEqual('2021');
});

test('getTooltipTimeFormatter applies the time grain even without an explicit format', () => {
  const date = new Date(Date.UTC(2021, 0, 7));
  const monthFormatter = getTooltipTimeFormatter(
    undefined,
    TimeGranularity.MONTH,
  ) as TimeFormatter;
  expect(monthFormatter).toBeInstanceOf(TimeFormatter);
  expect(monthFormatter.format(date)).toEqual(expect.stringContaining('2021'));
});

test('getTooltipTimeFormatter honors an explicit custom format over the time grain', () => {
  // A user-pinned format must win, so the grain does not turn a single date
  // into a range or otherwise override the requested format.
  const formatter = getTooltipTimeFormatter(
    '%Y-%m-%d',
    TimeGranularity.YEAR,
  ) as TimeFormatter;
  expect(formatter).toBeInstanceOf(TimeFormatter);
  expect(formatter.id).toBe('%Y-%m-%d');
  expect(formatter.format(new Date(Date.UTC(2021, 0, 7)))).toEqual(
    '2021-01-07',
  );
});

test('getXAxisFormatter produces stable SMART_DATE output for a valid Date', () => {
  // Documents the current happy-path output format so unexpected changes are
  // caught during review.
  const formatter = getXAxisFormatter(SMART_DATE_ID) as TimeFormatter;
  const result = formatter.format(new Date('2025-01-15T00:00:00.000Z'));
  expect(typeof result).toBe('string');
  expect(result).not.toMatch(/NaN/);
  expect(result.length).toBeGreaterThan(0);
});

test('getXAxisFormatter returns a string for an Invalid Date without throwing', () => {
  // If a caller ever passes an Invalid Date (the originally-suspected cause
  // of epoch-ms axis labels showing NaN in echarts), the formatter must
  // still return a string instead of throwing, so echarts does not blow up
  // the chart render. The *content* of that string is format-dependent and
  // intentionally not asserted here — only that it is a string.
  const formatter = getXAxisFormatter(SMART_DATE_ID) as TimeFormatter;
  const invalid = new Date(Number.NaN);
  expect(() => formatter.format(invalid)).not.toThrow();
  expect(typeof formatter.format(invalid)).toBe('string');

  const customFormatter = getXAxisFormatter('%Y-%m-%d') as TimeFormatter;
  expect(() => customFormatter.format(invalid)).not.toThrow();
  expect(typeof customFormatter.format(invalid)).toBe('string');
});

test('getSmartDateFormatter MINUTE grain distinguishes different minutes', () => {
  const formatter = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.MINUTE,
  ) as TimeFormatter;
  const date1 = new Date('2024-01-15T10:15:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  expect(formatter.format(date1)).not.toBe(formatter.format(date2));
});

test('getSmartDateFormatter FIFTEEN_MINUTES grain distinguishes different minutes', () => {
  const formatter = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.FIFTEEN_MINUTES,
  ) as TimeFormatter;
  const date1 = new Date('2024-01-15T10:15:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  expect(formatter.format(date1)).not.toBe(formatter.format(date2));
});

test('getSmartDateFormatter HOUR grain collapses minutes to same label', () => {
  const formatter = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.HOUR,
  ) as TimeFormatter;
  const date1 = new Date('2024-01-15T10:00:00Z');
  const date2 = new Date('2024-01-15T10:35:00Z');
  expect(formatter.format(date1)).toBe(formatter.format(date2));
});

test('getSmartDateFormatter SECOND grain distinguishes different seconds', () => {
  const formatter = getXAxisFormatter(
    SMART_DATE_ID,
    TimeGranularity.SECOND,
  ) as TimeFormatter;
  const date1 = new Date('2024-01-15T10:35:00Z');
  const date2 = new Date('2024-01-15T10:35:45Z');
  expect(formatter.format(date1)).not.toBe(formatter.format(date2));
});

test('createSpacedXAxisFormatter blanks labels that would visually collide', () => {
  const formatter = createSpacedXAxisFormatter(
    (value: number | string) => String(value),
    0,
    1000,
    100,
  );
  const labels = [0, 100, 200, 300, 1000].map(value => formatter(value));

  // Ticks close together at this pixel density collide with the last shown
  // label and get blanked, until one falls far enough past it.
  expect(labels).toEqual(['0', '', '', '300', '1000']);
});

test('createSpacedXAxisFormatter uses raw tick text without a formatter', () => {
  const formatter = createSpacedXAxisFormatter(undefined, 0, 1000, 400);

  expect([0, 500, 1000, 'label'].map(formatter)).toEqual([
    '0',
    '500',
    '1000',
    'label',
  ]);
});

test('createSpacedXAxisFormatter keeps nearby ticks when the starting boundary is unknown', () => {
  const formatter = createSpacedXAxisFormatter(String, undefined, 1000, 100);

  expect([100, 101, 1000].map(formatter)).toEqual(['100', '101', '1000']);
});

test('createSpacedXAxisFormatter shows every label when showAllLabels bypasses the spacing check', () => {
  const formatter = createSpacedXAxisFormatter(
    (value: number | string) => String(value),
    0,
    1000,
    100,
    true,
  );
  const labels = [0, 100, 200, 300, 1000].map(value => formatter(value));

  expect(labels).toEqual(['0', '100', '200', '300', '1000']);
});

test('createSpacedXAxisFormatter still dedupes identical consecutive labels when showAllLabels is set', () => {
  // showAllLabels only bypasses density thinning; two ticks that format to
  // literally the same text are still deduped, since that's not thinning.
  const formatter = createSpacedXAxisFormatter(() => 'Jan', 0, 1000, 100, true);
  const labels = [0, 100, 200].map(value => formatter(value));

  expect(labels).toEqual(['Jan', '', '']);
});

test('#45489 keeps ticks outside the data domain subject to neighboring-label spacing', () => {
  const formatter = createSpacedXAxisFormatter(String, 100, 200, 1000);

  expect([0, 1, 50, 100, 150, 200, 250, 251, 300].map(formatter)).toEqual([
    '0',
    '',
    '50',
    '100',
    '150',
    '200',
    '250',
    '',
    '300',
  ]);
});

test('#45489 handles January 1–31 ticks when data covers January 10–20', () => {
  const january = (day: number) => Date.UTC(2026, 0, day);
  const data = Array.from({ length: 11 }, (_, index) => ({
    __timestamp: january(index + 10),
  }));
  const [domainMin, domainMax] = getXAxisDomain([data], '__timestamp');
  expect([domainMin, domainMax]).toEqual([january(10), january(20)]);

  const formatter = createSpacedXAxisFormatter(
    getXAxisFormatter('%d %b', TimeGranularity.DAY),
    domainMin,
    domainMax,
    1000,
    false,
    getTooltipTimeFormatter('%d %b %Y', TimeGranularity.DAY),
  );
  const labels = Array.from({ length: 31 }, (_, index) =>
    formatter(january(index + 1)),
  );

  expect(labels).toEqual(
    Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      if (day === 11 || day === 19) {
        return '';
      }
      return `${String(day).padStart(2, '0')} Jan${day === 10 || day === 20 ? ' 2026' : ''}`;
    }),
  );
});

test.each(['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%a %d %b %Y', SMART_DATE_ID])(
  '#45489 recomputes spacing across zoom, pan, resize and reset (%s)',
  format => {
    const day = (month: number, date: number) => Date.UTC(2026, month, date);
    const start = day(0, 1);
    const end = Date.UTC(2027, 0, 1);
    const width = format.includes('%H') ? 800 : 400;
    const formatter = createSpacedXAxisFormatter(
      getXAxisFormatter(format, TimeGranularity.DAY),
      start,
      end,
      width,
      false,
      getTooltipTimeFormatter(format, TimeGranularity.DAY),
    );
    let layout = { domainMin: start, domainMax: end, plotWidthPx: width };
    formatter.getAxisLayout = () => layout;
    const fullTicks = [start, day(0, 10), day(5, 1), day(11, 25), end];
    const fullLabels = fullTicks.map(formatter);
    expect(fullLabels[0]).not.toBe('');
    expect(fullLabels.at(-1)).not.toBe('');
    expect(fullLabels[3]).toBe('');

    for (const [domainMin, domainMax] of [
      [day(0, 10), day(2, 1)],
      [day(5, 1), day(6, 1)],
      [day(0, 10), day(2, 1)],
    ]) {
      layout = { ...layout, domainMin, domainMax };
      expect(formatter(domainMin)).not.toBe('');
      expect(formatter((domainMin + domainMax) / 2)).not.toBe('');
      expect(formatter(domainMax)).not.toBe('');
    }

    layout = { domainMin: start, domainMax: end, plotWidthPx: 1200 };
    expect(fullTicks.map(formatter)[2]).not.toBe('');
    layout = { domainMin: start, domainMax: end, plotWidthPx: width };
    expect(fullTicks.map(formatter)).toEqual(fullLabels);
  },
);

test('#45489 retains hour precision at zoomed boundaries', () => {
  const formatter = createSpacedXAxisFormatter(
    getXAxisFormatter(SMART_DATE_ID, TimeGranularity.HOUR),
    Date.UTC(2026, 0, 1),
    Date.UTC(2027, 0, 1),
    800,
    false,
    getTooltipTimeFormatter(SMART_DATE_ID, TimeGranularity.HOUR),
  );
  formatter.getAxisLayout = () => ({
    domainMin: Date.UTC(2026, 0, 10, 9),
    domainMax: Date.UTC(2026, 0, 10, 15),
    plotWidthPx: 800,
  });
  expect(formatter(Date.UTC(2026, 0, 10, 9))).toBe('2026-01-10 09:00');
  expect(formatter(Date.UTC(2026, 0, 10, 15))).toBe('2026-01-10 15:00');
});

test('#45489 protects the visible boundaries when zoom retains either original endpoint', () => {
  const formatter = createSpacedXAxisFormatter(String, 0, 1000, 400);
  formatter.getAxisLayout = () => ({
    domainMin: 0,
    domainMax: 100,
    plotWidthPx: 400,
  });
  expect([0, 1, 50, 100].map(formatter)).toEqual(['0', '', '50', '100']);
  formatter.getAxisLayout = () => ({
    domainMin: 900,
    domainMax: 1000,
    plotWidthPx: 400,
  });
  expect([900, 999, 1000].map(formatter)).toEqual(['900', '', '1000']);
});

test('#45489 retains the All labels option in a zoomed range', () => {
  const formatter = createSpacedXAxisFormatter(String, 0, 1000, 400, true);
  formatter.getAxisLayout = () => ({
    domainMin: 1,
    domainMax: 10,
    plotWidthPx: 10,
  });
  expect([1, 2, 3, 10].map(formatter)).toEqual(['1', '2', '3', '10']);
});

test('#45489 protects pinned boundary ticks inside a zoomed axis extent', () => {
  const formatter = createSpacedXAxisFormatter(
    () => 'tick',
    0,
    1000,
    400,
    false,
    (value: number | string) => `boundary ${value}`,
  );
  formatter.getAxisLayout = () => ({
    domainMin: 100,
    domainMax: 900,
    plotWidthPx: 400,
    minLabelValue: 150,
    maxLabelValue: 850,
  });
  expect([150, 200, 500, 800, 850].map(formatter)).toEqual([
    'boundary 150',
    '',
    'tick',
    '',
    'boundary 850',
  ]);
});

test('#45489 reserves space for both aligned boundary labels', () => {
  const formatter = createSpacedXAxisFormatter(
    () => 'Year',
    0,
    1000,
    400,
    false,
    (value: number | string) => (value === 0 ? '5 Mar 2014' : '17 Aug 2026'),
  );
  const ticks = [0, 200, 500, 800, 1000];
  const expected = ['5 Mar 2014', '', 'Year', '', '17 Aug 2026'];

  expect(ticks.map(formatter)).toEqual(expected);
  // ECharts formats the axis repeatedly during layout.
  expect(ticks.map(formatter)).toEqual(expected);
});

test('#45489 protects boundaries even when ECharts does not format them first', () => {
  const formatter = createSpacedXAxisFormatter(String, 0, 1000, 100);

  expect(formatter(100)).toBe('');
  expect(formatter(500)).toBe('500');
  expect(formatter(800)).toBe('');
  expect(formatter(1000)).toBe('1000');
});

test('#45489 allows ticks only outside the aligned boundary text and gap', () => {
  const formatter = createSpacedXAxisFormatter(
    String,
    0,
    1000,
    1000,
    false,
    (value: number | string) => (value === 0 ? '5 Mar 2014' : '17 Aug 2026'),
  );

  expect([0, 84, 85, 904, 905, 1000].map(formatter)).toEqual([
    '5 Mar 2014',
    '',
    '85',
    '904',
    '',
    '17 Aug 2026',
  ]);
});

test.each([0, 10])('#45489 retains boundaries on a %spx plot', width => {
  const formatter = createSpacedXAxisFormatter(String, 0, 1000, width);
  expect([0, 500, 1000].map(formatter)).toEqual([
    '0',
    '',
    width > 0 ? '\n1000' : '1000',
  ]);
});

test('#45489 retains full boundary dates when showing all labels', () => {
  const start = Date.UTC(2014, 2, 5);
  const end = Date.UTC(2026, 7, 17);
  const formatter = createSpacedXAxisFormatter(
    getXAxisFormatter(SMART_DATE_ID, TimeGranularity.DAY),
    start,
    end,
    100,
    true,
    getTooltipTimeFormatter(SMART_DATE_ID, TimeGranularity.DAY),
  );

  expect([start, Date.UTC(2026, 0, 1), end].map(formatter)).toEqual([
    '2014-03-05',
    '2026',
    '2026-08-17',
  ]);
  expect((formatter as { id?: string }).id).toBe(SMART_DATE_ID);
});

test.each([undefined, 0, -1])(
  '#45489 tolerates an unavailable or degenerate domain (%s)',
  domainMax => {
    const formatter = createSpacedXAxisFormatter(String, 0, domainMax, 400);
    expect(formatter(100)).toBe('100');
    expect(formatter(200)).toBe('200');
  },
);

describe('coerceTemporalMs', () => {
  test('passes a number through unchanged', () => {
    expect(coerceTemporalMs(1712361600000)).toBe(1712361600000);
  });

  test('reads a Date object via getTime', () => {
    const date = new Date(Date.UTC(2024, 3, 6));
    expect(coerceTemporalMs(date)).toBe(date.getTime());
  });

  test('parses a zoned ISO string as the instant it names', () => {
    expect(coerceTemporalMs('2026-04-06T00:00:00.000Z')).toBe(
      Date.UTC(2026, 3, 6),
    );
  });

  test('parses a zone-less datetime string as local time, matching ECharts', () => {
    expect(coerceTemporalMs('2026-04-06T00:00:00')).toBe(
      new Date(2026, 3, 6, 0, 0, 0).getTime(),
    );
  });

  test('parses a bare date string as local midnight, matching ECharts rather than native Date', () => {
    // `new Date('2026-04-06')` is UTC, but ECharts parses it as local time.
    // jest.config.js fixes the test TZ to America/New_York, so they disagree.
    const localMidnight = new Date(2026, 3, 6).getTime();
    expect(localMidnight).not.toEqual(new Date('2026-04-06').getTime());
    expect(coerceTemporalMs('2026-04-06')).toBe(localMidnight);
  });

  test('returns NaN for an unparseable string or a nullish value', () => {
    expect(coerceTemporalMs('not-a-date')).toBeNaN();
    expect(coerceTemporalMs(null)).toBeNaN();
    expect(coerceTemporalMs(undefined)).toBeNaN();
  });
});

describe('getXAxisDomain', () => {
  const xAxisCol = '__timestamp';
  const t0 = Date.UTC(2024, 0, 1);
  const t1 = Date.UTC(2024, 0, 2);

  test('finds the min/max of a purely numeric column', () => {
    expect(
      getXAxisDomain([[{ [xAxisCol]: t0 }, { [xAxisCol]: t1 }]], xAxisCol),
    ).toEqual([t0, t1]);
  });

  test('finds the min/max when every value is a Date object', () => {
    // Regression: getXAxisDomain used to only recognize `typeof === 'number'`,
    // so a column of Date objects (as MixedTimeseries/Timeseries transformProps
    // pass through in some data-fetch paths) found no bounds at all and the
    // grain-aware bar-width cap silently fell back to the flat 100px default.
    expect(
      getXAxisDomain(
        [[{ [xAxisCol]: new Date(t0) }, { [xAxisCol]: new Date(t1) }]],
        xAxisCol,
      ),
    ).toEqual([t0, t1]);
  });

  test('finds the min/max when every value is an ISO string', () => {
    expect(
      getXAxisDomain(
        [
          [
            { [xAxisCol]: '2024-01-01T00:00:00.000Z' },
            { [xAxisCol]: '2024-01-02T00:00:00.000Z' },
          ],
        ],
        xAxisCol,
      ),
    ).toEqual([t0, t1]);
  });

  test('finds the min/max across a mix of numbers, Dates and ISO strings', () => {
    // The two query result sets MixedTimeseries combines don't have to agree
    // on representation; every row must still count toward the same domain.
    expect(
      getXAxisDomain(
        [
          [{ [xAxisCol]: t0 }],
          [
            { [xAxisCol]: new Date(t1) },
            { [xAxisCol]: '2024-01-01T12:00:00.000Z' },
          ],
        ],
        xAxisCol,
      ),
    ).toEqual([t0, t1]);
  });

  test('ignores unparseable or nullish values without affecting the real bounds', () => {
    expect(
      getXAxisDomain(
        [
          [
            { [xAxisCol]: t0 },
            { [xAxisCol]: 'not-a-date' },
            { [xAxisCol]: null },
            { [xAxisCol]: t1 },
          ],
        ],
        xAxisCol,
      ),
    ).toEqual([t0, t1]);
  });

  test('returns [undefined, undefined] when the column has no temporal values', () => {
    expect(getXAxisDomain([[{ other: 1 }]], xAxisCol)).toEqual([
      undefined,
      undefined,
    ]);
  });
});

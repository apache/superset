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
  NumberFormats,
  SMART_DATE_ID,
  TimeFormatter,
  TimeGranularity,
} from '@superset-ui/core';
import {
  getPercentFormatter,
  getXAxisFormatter,
} from '../../src/utils/formatters';

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

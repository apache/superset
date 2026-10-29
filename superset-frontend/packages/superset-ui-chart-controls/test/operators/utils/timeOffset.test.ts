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
  getOriginalSeries,
  getTimeOffset,
  hasTimeOffset,
} from '@superset-ui/chart-controls';

test('getOriginalSeries returns the series name when time compare is empty', () => {
  const seriesName = 'sum';
  expect(getOriginalSeries(seriesName, [])).toEqual(seriesName);
});

test('getOriginalSeries returns the original series name with __ pattern', () => {
  const seriesName = 'sum__1_month_ago';
  const timeCompare = ['1_month_ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual('sum');
});

test('getOriginalSeries returns the original series name with <offset>, pattern', () => {
  const seriesName = '1 year ago, groupby_value';
  const timeCompare = ['1 year ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual('groupby_value');
});

test('getOriginalSeries returns the original series name with , <offset> pattern', () => {
  const seriesName = 'AVG(price_each), 1 year ago';
  const timeCompare = ['1 year ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual('AVG(price_each)');
});

test('getOriginalSeries handles multiple time compares', () => {
  const seriesName = 'count, 1 year ago';
  const timeCompare = ['1 month ago', '1 year ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual('count');
});

test('getOriginalSeries strips offset in the middle with dimension', () => {
  const seriesName = 'SUM(sales), 28 days ago, Medium';
  const timeCompare = ['28 days ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual(
    'SUM(sales), Medium',
  );
});

test('getOriginalSeries strips offset in the middle with multiple dimensions', () => {
  const seriesName = 'SUM(sales), 1 year ago, Medium, 11';
  const timeCompare = ['1 year ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual(
    'SUM(sales), Medium, 11',
  );
});

test('getTimeOffset returns undefined when no time offset pattern matches', () => {
  const series = { name: 'count' };
  const timeCompare = ['1 year ago'];
  expect(getTimeOffset(series, timeCompare)).toBeUndefined();
});

test('getTimeOffset detects __ pattern', () => {
  const series = { name: 'count__1 year ago' };
  const timeCompare = ['1 year ago'];
  expect(getTimeOffset(series, timeCompare)).toEqual('1 year ago');
});

test('getTimeOffset detects <offset>, pattern', () => {
  const series = { name: '1 year ago, groupby_value' };
  const timeCompare = ['1 year ago'];
  expect(getTimeOffset(series, timeCompare)).toEqual('1 year ago');
});

test('getTimeOffset detects , <offset> pattern', () => {
  const series = { name: 'AVG(price_each), 1 year ago' };
  const timeCompare = ['1 year ago'];
  expect(getTimeOffset(series, timeCompare)).toEqual('1 year ago');
});

test('getTimeOffset detects , <offset>, pattern (offset in middle)', () => {
  const series = { name: 'SUM(sales), 28 days ago, Medium' };
  const timeCompare = ['28 days ago'];
  expect(getTimeOffset(series, timeCompare)).toEqual('28 days ago');
});

test('hasTimeOffset returns false for original series', () => {
  const series = { name: 'count' };
  const timeCompare = ['1 year ago'];
  expect(hasTimeOffset(series, timeCompare)).toBe(false);
});

test('hasTimeOffset returns true for derived series with , <offset> pattern', () => {
  const series = { name: 'AVG(price_each), 1 year ago' };
  const timeCompare = ['1 year ago'];
  expect(hasTimeOffset(series, timeCompare)).toBe(true);
});

test('hasTimeOffset returns false when series name is not a string', () => {
  const series = { name: 123 };
  const timeCompare = ['1 year ago'];
  expect(hasTimeOffset(series, timeCompare)).toBe(false);
});

test('getTimeOffset correctly matches offsets that share a numeric prefix', () => {
  const timeCompare = ['1 year ago', '11 year ago'];
  expect(
    getTimeOffset({ name: '11 year ago, Alexander' }, timeCompare),
  ).toEqual('11 year ago');
  expect(getTimeOffset({ name: '1 year ago, Alexander' }, timeCompare)).toEqual(
    '1 year ago',
  );
  expect(getTimeOffset({ name: 'Births__11 year ago' }, timeCompare)).toEqual(
    '11 year ago',
  );
});

test('getOriginalSeries correctly strips offsets that share a numeric prefix', () => {
  const timeCompare = ['1 year ago', '11 year ago'];
  expect(getOriginalSeries('11 year ago, Alexander', timeCompare)).toEqual(
    'Alexander',
  );
  expect(getOriginalSeries('1 year ago, Alexander', timeCompare)).toEqual(
    'Alexander',
  );
});

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

import { mergeCustomEChartOptions } from './mergeCustomEChartOptions';
import type { CustomEChartOptions } from './echartOptionsTypes';

test('mergeCustomEChartOptions returns base options when custom is undefined', () => {
  const base = { title: { text: 'Base Title' } };
  const result = mergeCustomEChartOptions(base, undefined);

  expect(result).toEqual(base);
});

test('mergeCustomEChartOptions merges simple properties', () => {
  const base = { backgroundColor: '#fff' };
  const custom: CustomEChartOptions = { backgroundColor: '#000' };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.backgroundColor).toBe('#000');
});

test('mergeCustomEChartOptions deep merges nested objects', () => {
  const base = {
    title: {
      text: 'Base Title',
      textStyle: {
        color: '#333',
        fontSize: 14,
      },
    },
  };
  const custom: CustomEChartOptions = {
    title: {
      textStyle: {
        color: '#ff0000',
      },
    },
  };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.title).toEqual({
    text: 'Base Title',
    textStyle: {
      color: '#ff0000',
      fontSize: 14,
    },
  });
});

test('mergeCustomEChartOptions replaces arrays entirely', () => {
  const base = {
    series: [{ name: 'A', type: 'line' }],
  };
  const custom: CustomEChartOptions = {
    series: [
      { name: 'B', type: 'bar' },
      { name: 'C', type: 'pie' },
    ],
  };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.series).toEqual([
    { name: 'B', type: 'bar' },
    { name: 'C', type: 'pie' },
  ]);
});

test('mergeCustomEChartOptions does not mutate original base object', () => {
  const base = {
    title: { text: 'Original' },
    grid: { top: 10 },
  };
  const originalBase = JSON.parse(JSON.stringify(base));
  const custom: CustomEChartOptions = {
    title: { text: 'Modified' },
  };

  mergeCustomEChartOptions(base, custom);

  expect(base).toEqual(originalBase);
});

test('mergeCustomEChartOptions handles complex nested structures', () => {
  const base = {
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', axisLine: { lineStyle: { color: '#999' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'solid' } } },
    tooltip: { trigger: 'axis' },
  };
  const custom: CustomEChartOptions = {
    grid: { top: 50 },
    xAxis: { axisLine: { lineStyle: { width: 2 } } },
    tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
  };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.grid).toEqual({
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true,
    top: 50,
  });
  expect(result.xAxis).toEqual({
    type: 'category',
    axisLine: { lineStyle: { color: '#999', width: 2 } },
  });
  expect(result.tooltip).toEqual({
    trigger: 'axis',
    backgroundColor: 'rgba(0,0,0,0.8)',
  });
});

test('mergeCustomEChartOptions handles null values in custom options', () => {
  const base = { title: { text: 'Title' }, legend: { show: true } };
  const custom: CustomEChartOptions = { title: { text: 'New Title' } };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.title).toEqual({ text: 'New Title' });
  expect(result.legend).toEqual({ show: true });
});

test('mergeCustomEChartOptions adds new properties from custom', () => {
  const base = { title: { text: 'Title' } };
  const custom: CustomEChartOptions = {
    legend: { show: true, orient: 'horizontal' },
  };

  const result = mergeCustomEChartOptions(base, custom);

  expect(result.title).toEqual({ text: 'Title' });
  expect(result.legend).toEqual({ show: true, orient: 'horizontal' });
});

test('mergeCustomEChartOptions handles empty custom options', () => {
  const base = { title: { text: 'Title' } };
  const custom: CustomEChartOptions = {};

  const result = mergeCustomEChartOptions(base, custom);

  expect(result).toEqual(base);
});

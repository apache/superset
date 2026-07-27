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
import { mergeEchartsThemeOverrides } from './themeOverrides';

// =============================================================================
// Basic Deep Merge Behavior
// =============================================================================

test('merges nested objects correctly', () => {
  const baseOptions = {
    grid: { left: '5%', right: '5%', top: '10%' },
    xAxis: { type: 'category', axisLabel: { fontSize: 12 } },
  };

  const overrides = {
    grid: { left: '10%', bottom: '15%' },
    xAxis: { axisLabel: { color: '#333', rotate: 45 } },
  };

  const result = mergeEchartsThemeOverrides(baseOptions, overrides);

  expect(result).toEqual({
    grid: {
      left: '10%', // overridden
      right: '5%', // preserved
      top: '10%', // preserved
      bottom: '15%', // added
    },
    xAxis: {
      type: 'category', // preserved
      axisLabel: {
        fontSize: 12, // preserved
        color: '#333', // added
        rotate: 45, // added
      },
    },
  });
});

test('handles override precedence correctly (rightmost wins)', () => {
  const baseTheme = { textStyle: { color: '#000', fontSize: 12 } };
  const pluginOptions = {
    textStyle: { fontSize: 14 },
    title: { text: 'Chart' },
  };
  const globalOverrides = {
    textStyle: { color: '#333' },
    grid: { left: '10%' },
  };
  const chartOverrides = { textStyle: { color: '#666', fontWeight: 'bold' } };

  const result = mergeEchartsThemeOverrides(
    baseTheme,
    pluginOptions,
    globalOverrides,
    chartOverrides,
  );

  expect(result).toEqual({
    textStyle: {
      color: '#666', // chart override wins
      fontSize: 14, // from plugin options
      fontWeight: 'bold', // from chart override
    },
    title: { text: 'Chart' },
    grid: { left: '10%' },
  });
});

test('handles null values correctly', () => {
  const base = { grid: { left: '5%', right: '5%' } };
  const overrides = { grid: { left: null, bottom: '20%' } };

  const result = mergeEchartsThemeOverrides(base, overrides);

  expect(result.grid).toEqual({
    left: null,
    right: '5%',
    bottom: '20%',
  });
});

test('handles function values correctly', () => {
  const original = (v: number) => `${v}%`;
  const override = (v: number) => `$${v}`;

  const base = { yAxis: { axisLabel: { formatter: original } } };
  const overrides = { yAxis: { axisLabel: { formatter: override } } };

  const result = mergeEchartsThemeOverrides(base, overrides);

  expect(result.yAxis.axisLabel.formatter).toBe(override);
  expect(result.yAxis.axisLabel.formatter(100)).toBe('$100');
});

// =============================================================================
// Array Replacement (Backward Compatibility)
// =============================================================================

test('replaces arrays entirely when override is an array', () => {
  const base = {
    series: [
      { name: 'Series 1', type: 'line' },
      { name: 'Series 2', type: 'bar' },
    ],
  };

  const overrides = {
    series: [{ name: 'New Series', type: 'pie' }],
  };

  const result = mergeEchartsThemeOverrides(base, overrides);

  expect(result.series).toEqual([{ name: 'New Series', type: 'pie' }]);
  expect(result.series).toHaveLength(1);
});

test('empty array override replaces existing array', () => {
  const base = { series: [{ name: 'Test', data: [1, 2, 3] }] };
  const overrides = { series: [] };

  const result = mergeEchartsThemeOverrides(base, overrides);

  expect(result.series).toEqual([]);
});

// =============================================================================
// Object-to-Array Merging (NEW FEATURE)
// =============================================================================

test('merges object override into each series array item', () => {
  const chartOptions = {
    series: [
      { type: 'bar', name: 'Revenue', data: [1, 2, 3] },
      { type: 'bar', name: 'Profit', data: [4, 5, 6] },
    ],
  };

  const override = {
    series: { itemStyle: { borderRadius: 4 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.series).toHaveLength(2);
  expect(result.series[0]).toEqual({
    type: 'bar',
    name: 'Revenue',
    data: [1, 2, 3],
    itemStyle: { borderRadius: 4 },
  });
  expect(result.series[1]).toEqual({
    type: 'bar',
    name: 'Profit',
    data: [4, 5, 6],
    itemStyle: { borderRadius: 4 },
  });
});

test('merges object override into each xAxis array item', () => {
  const chartOptions = {
    xAxis: [
      { type: 'category', data: ['Mon', 'Tue'] },
      { type: 'value', position: 'top' },
    ],
  };

  const override = {
    xAxis: { axisLabel: { rotate: 45 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.xAxis).toHaveLength(2);
  expect(result.xAxis[0]).toEqual({
    type: 'category',
    data: ['Mon', 'Tue'],
    axisLabel: { rotate: 45 },
  });
  expect(result.xAxis[1]).toEqual({
    type: 'value',
    position: 'top',
    axisLabel: { rotate: 45 },
  });
});

test('merges object override into each yAxis array item', () => {
  const chartOptions = {
    yAxis: [
      { type: 'value', name: 'Revenue' },
      { type: 'value', name: 'Count' },
    ],
  };

  const override = {
    yAxis: { axisLine: { show: true }, splitLine: { show: false } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.yAxis).toHaveLength(2);
  expect(result.yAxis[0]).toEqual({
    type: 'value',
    name: 'Revenue',
    axisLine: { show: true },
    splitLine: { show: false },
  });
  expect(result.yAxis[1]).toEqual({
    type: 'value',
    name: 'Count',
    axisLine: { show: true },
    splitLine: { show: false },
  });
});

test('merges object override into dataZoom array items', () => {
  const chartOptions = {
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0 },
    ],
  };

  const override = {
    dataZoom: { filterMode: 'filter' },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.dataZoom).toHaveLength(2);
  expect(result.dataZoom[0]).toEqual({
    type: 'inside',
    xAxisIndex: 0,
    filterMode: 'filter',
  });
  expect(result.dataZoom[1]).toEqual({
    type: 'slider',
    xAxisIndex: 0,
    filterMode: 'filter',
  });
});

test('preserves existing properties when merging into array items', () => {
  const chartOptions = {
    series: [
      {
        type: 'bar',
        itemStyle: { color: 'red', borderWidth: 2 },
      },
    ],
  };

  const override = {
    series: { itemStyle: { borderRadius: 4 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.series[0].itemStyle).toEqual({
    color: 'red', // preserved
    borderWidth: 2, // preserved
    borderRadius: 4, // added
  });
});

test('applies multiple object overrides in order', () => {
  const chartOptions = {
    series: [{ type: 'bar' }],
  };

  const globalOverride = {
    series: { itemStyle: { borderRadius: 2, color: 'blue' } },
  };

  const chartOverride = {
    series: { itemStyle: { borderRadius: 8 } },
  };

  const result = mergeEchartsThemeOverrides(
    chartOptions,
    globalOverride,
    chartOverride,
  );

  expect(result.series[0].itemStyle).toEqual({
    borderRadius: 8, // chart override wins
    color: 'blue', // global override preserved
  });
});

test('handles deeply nested overrides in array items', () => {
  const chartOptions = {
    series: [
      {
        type: 'bar',
        label: { show: true, position: 'top' },
      },
    ],
  };

  const override = {
    series: {
      label: { formatter: '{c}', fontSize: 14 },
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.series[0]).toEqual({
    type: 'bar',
    label: {
      show: true, // preserved
      position: 'top', // preserved
      formatter: '{c}', // added
      fontSize: 14, // added
    },
    itemStyle: { borderRadius: [4, 4, 0, 0] },
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

test('handles single object xAxis (not array) normally', () => {
  const chartOptions = {
    xAxis: { type: 'category', data: ['Mon', 'Tue'] },
  };

  const override = {
    xAxis: { axisLabel: { rotate: 45 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.xAxis).toEqual({
    type: 'category',
    data: ['Mon', 'Tue'],
    axisLabel: { rotate: 45 },
  });
});

test('skips non-object array items when merging', () => {
  const chartOptions = {
    series: [
      { type: 'bar' },
      'invalid', // non-object item
      null, // null item
      { type: 'line' },
    ],
  };

  const override = {
    series: { itemStyle: { borderRadius: 4 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  expect(result.series).toHaveLength(4);
  expect(result.series[0]).toEqual({
    type: 'bar',
    itemStyle: { borderRadius: 4 },
  });
  expect(result.series[1]).toBe('invalid'); // unchanged
  expect(result.series[2]).toBe(null); // unchanged
  expect(result.series[3]).toEqual({
    type: 'line',
    itemStyle: { borderRadius: 4 },
  });
});

test('handles empty overrides gracefully', () => {
  const chartOptions = {
    series: [{ type: 'bar' }],
  };

  const result = mergeEchartsThemeOverrides(chartOptions, {});

  expect(result).toEqual(chartOptions);
});

test('handles missing array property in base', () => {
  const chartOptions = {
    grid: { left: '10%' },
  };

  const override = {
    series: { itemStyle: { borderRadius: 4 } },
  };

  const result = mergeEchartsThemeOverrides(chartOptions, override);

  // series override is just added as-is since there's no array to merge into
  expect(result).toEqual({
    grid: { left: '10%' },
    series: { itemStyle: { borderRadius: 4 } },
  });
});

test('works with the full Echart.tsx merge pattern', () => {
  const baseTheme = {
    textStyle: { color: '#333' },
  };

  const echartOptions = {
    series: [
      { type: 'bar', data: [1, 2, 3] },
      { type: 'bar', data: [4, 5, 6] },
    ],
    xAxis: { type: 'category' },
  };

  const globalOverrides = {
    series: { itemStyle: { opacity: 0.8 } },
  };

  const chartOverrides = {
    series: { itemStyle: { borderRadius: 4 } },
    xAxis: { axisLabel: { rotate: 45 } },
  };

  const result = mergeEchartsThemeOverrides(
    baseTheme,
    echartOptions,
    globalOverrides,
    chartOverrides,
  );

  expect(result.textStyle).toEqual({ color: '#333' });
  expect(result.xAxis).toEqual({
    type: 'category',
    axisLabel: { rotate: 45 },
  });
  expect(result.series).toHaveLength(2);
  expect(result.series[0]).toEqual({
    type: 'bar',
    data: [1, 2, 3],
    itemStyle: { opacity: 0.8, borderRadius: 4 },
  });
  expect(result.series[1]).toEqual({
    type: 'bar',
    data: [4, 5, 6],
    itemStyle: { opacity: 0.8, borderRadius: 4 },
  });
});

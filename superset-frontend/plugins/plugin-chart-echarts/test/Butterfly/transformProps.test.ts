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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  EchartsButterflyChartProps,
  ButterflyTransformedProps,
} from '../../src/Butterfly/types';
import transformProps from '../../src/Butterfly/transformProps';
import { NULL_STRING } from '../../src/constants';

type SeriesDataPoint = { value?: number } | number;

type ButterflyTestSeries = {
  name?: string;
  data?: SeriesDataPoint[];
  itemStyle?: { color?: string };
  label?: { show?: boolean };
};

type ButterflyTestEchartOptions = {
  series?: ButterflyTestSeries[];
  xAxis?: { name?: string; nameGap?: number };
  yAxis?: {
    name?: string;
    nameGap?: number;
    data?: string[];
    axisLabel?: { rotate?: number };
  };
  legend?: { orient?: string; data?: string[] };
  grid?: { left?: number; top?: number };
  tooltip?: { show?: boolean };
};

const getEchartOptions = (
  props: ButterflyTransformedProps,
): ButterflyTestEchartOptions =>
  props.echartOptions as ButterflyTestEchartOptions;

const extractSeriesValues = (props: ButterflyTransformedProps) => {
  const series = getEchartOptions(props).series ?? [];
  return series.map(item =>
    (item.data ?? []).map(entry =>
      typeof entry === 'object' && entry !== null && 'value' in entry
        ? entry.value
        : entry,
    ),
  );
};

const extractSeriesNames = (props: ButterflyTransformedProps) => {
  const series = getEchartOptions(props).series ?? [];
  return series.map(item => item.name);
};

const data: Record<string, unknown>[] = [
  { category: 'A', left_sum: 10, right_sum: 25 },
  { category: 'B', left_sum: 5, right_sum: 19 },
];

const formData = {
  groupby: ['category'],
  left_metric: 'left_sum',
  right_metric: 'right_sum',
  left_color: { r: 84, g: 112, b: 198 },
  right_color: { r: 145, g: 204, b: 117 },
  showValue: true,
  showLegend: true,
};

const createChartProps = (
  overrides: Record<string, unknown> = {},
  queryData: Record<string, unknown>[] = data,
) =>
  new ChartProps({
    formData: { ...formData, ...overrides },
    width: 800,
    height: 600,
    queriesData: [{ data: queryData }],
    theme: supersetTheme,
    ...((overrides.hooks ? { hooks: overrides.hooks } : {}) as object),
  });

test('transforms chart props into diverging bar series', () => {
  const transformedProps = transformProps(
    createChartProps() as unknown as EchartsButterflyChartProps,
  );

  expect(extractSeriesValues(transformedProps)).toEqual([
    [-10, -5],
    [25, 19],
  ]);
});

test('uses absolute values for negative right-side metrics', () => {
  const transformedProps = transformProps(
    createChartProps({}, [
      { category: 'A', left_sum: -8, right_sum: -15 },
    ]) as unknown as EchartsButterflyChartProps,
  );

  expect(extractSeriesValues(transformedProps)).toEqual([[-8], [15]]);
});

test('formats null categories and missing metric values', () => {
  const transformedProps = transformProps(
    createChartProps({}, [
      { category: null, left_sum: undefined, right_sum: 7 },
    ]) as unknown as EchartsButterflyChartProps,
  );
  const { yAxis } = getEchartOptions(transformedProps);

  expect(yAxis?.data).toEqual([NULL_STRING]);
  const [leftValues, rightValues] = extractSeriesValues(transformedProps);
  expect(Math.abs(leftValues[0] as number)).toBe(0);
  expect(rightValues).toEqual([7]);
});

test('applies custom series labels, colors, and axis titles', () => {
  const transformedProps = transformProps(
    createChartProps({
      left_label: 'Left side',
      right_label: 'Right side',
      left_color: { r: 255, g: 0, b: 0 },
      right_color: { r: 0, g: 255, b: 0 },
      x_axis_label: 'Value axis',
      y_axis_label: 'Category axis',
    }) as unknown as EchartsButterflyChartProps,
  );
  const { series, xAxis, yAxis } = getEchartOptions(transformedProps);

  expect(extractSeriesNames(transformedProps)).toEqual([
    'Left side',
    'Right side',
  ]);
  expect(series?.[0]?.itemStyle?.color).toBe('#ff0000');
  expect(series?.[1]?.itemStyle?.color).toBe('#00ff00');
  expect(xAxis?.name).toBe('Value axis');
  expect(yAxis?.name).toBe('Category axis');
});

test('applies legend orientation, sort, and axis margin settings', () => {
  const transformedProps = transformProps(
    createChartProps({
      legendOrientation: 'left',
      legendSort: 'desc',
      xAxisLabelRotation: 45,
      x_axis_title_margin: 60,
      y_axis_title_margin: 80,
    }) as unknown as EchartsButterflyChartProps,
  );
  const { legend, xAxis, yAxis, grid } = getEchartOptions(transformedProps);

  expect(legend?.orient).toBe('vertical');
  expect(legend?.data).toEqual(['right_sum', 'left_sum']);
  expect(xAxis?.nameGap).toBe(60);
  expect(yAxis?.axisLabel?.rotate).toBe(45);
  expect(yAxis?.nameGap).toBe(80);
  expect(grid?.left).toBeGreaterThan(80);
  expect(grid?.top).toBeGreaterThan(60);
});

test('hides value labels when showValue is false', () => {
  const transformedProps = transformProps(
    createChartProps({
      showValue: false,
    }) as unknown as EchartsButterflyChartProps,
  );
  const { series } = getEchartOptions(transformedProps);

  expect(series?.[0]?.label?.show).toBe(false);
  expect(series?.[1]?.label?.show).toBe(false);
});

test('hides tooltip while the context menu is open', () => {
  const transformedProps = transformProps(
    createChartProps({}, data) as unknown as EchartsButterflyChartProps,
  );
  const withContextMenu = transformProps({
    ...createChartProps(),
    inContextMenu: true,
  } as unknown as EchartsButterflyChartProps);

  expect(getEchartOptions(transformedProps).tooltip?.show).toBe(true);
  expect(getEchartOptions(withContextMenu).tooltip?.show).toBe(false);
});

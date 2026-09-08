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
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  EchartsButterflyChartProps,
  ButterflyTransformedProps,
} from '../../src/Butterfly/types';
import transformProps from '../../src/Butterfly/transformProps';
import { NULL_STRING, OpacityEnum } from '../../src/constants';

const categoryKeyA = 'A__["A"]';
const categoryKeyB = 'B__["B"]';

type SeriesDataPoint = {
  name?: string;
  value?: number;
  itemStyle?: { opacity?: number };
};

type ButterflyTestSeries = {
  name?: string;
  data?: SeriesDataPoint[];
  itemStyle?: { color?: string };
  label?: {
    show?: boolean;
    formatter?: (params: CallbackDataParams) => string;
  };
};

type ButterflyTestEchartOptions = {
  series?: ButterflyTestSeries[];
  xAxis?: {
    name?: string;
    nameGap?: number;
    axisLabel?: { formatter?: (value: number) => string };
  };
  yAxis?: {
    name?: string;
    nameGap?: number;
    data?: string[];
    axisLabel?: { rotate?: number };
  };
  legend?: { orient?: string; data?: string[] };
  grid?: { left?: number; top?: number };
  tooltip?: {
    show?: boolean;
    formatter?: (params: CallbackDataParams | CallbackDataParams[]) => string;
  };
};

const getEchartOptions = (
  props: ButterflyTransformedProps,
): ButterflyTestEchartOptions =>
  props.echartOptions as ButterflyTestEchartOptions;

const extractSeriesValues = (props: ButterflyTransformedProps) => {
  const series = getEchartOptions(props).series ?? [];
  return series.map(item => (item.data ?? []).map(entry => entry.value));
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
  ({
    ...new ChartProps({
      formData: { ...formData, ...overrides },
      width: 800,
      height: 600,
      queriesData: [{ data: queryData }],
      theme: supersetTheme,
      ...((overrides.hooks ? { hooks: overrides.hooks } : {}) as object),
    }),
    filterState: overrides.filterState ?? {},
    emitCrossFilters: overrides.emitCrossFilters,
    inContextMenu: overrides.inContextMenu,
  }) as unknown as EchartsButterflyChartProps;

test('transforms chart props into diverging bar series', () => {
  const transformedProps = transformProps(createChartProps());

  expect(extractSeriesValues(transformedProps)).toEqual([
    [-10, -5],
    [25, 19],
  ]);
});

test('assigns composite category keys to each bar data point', () => {
  const transformedProps = transformProps(createChartProps());
  const series = getEchartOptions(transformedProps).series ?? [];

  expect(series[0]?.data?.map(point => point.name)).toEqual([
    categoryKeyA,
    categoryKeyB,
  ]);
  expect(series[1]?.data?.map(point => point.name)).toEqual([
    categoryKeyA,
    categoryKeyB,
  ]);
});

test('uses absolute values for negative right-side metrics', () => {
  const transformedProps = transformProps(
    createChartProps({}, [{ category: 'A', left_sum: -8, right_sum: -15 }]),
  );

  expect(extractSeriesValues(transformedProps)).toEqual([[-8], [15]]);
});

test('formats null categories and missing metric values', () => {
  const transformedProps = transformProps(
    createChartProps({}, [
      { category: null, left_sum: undefined, right_sum: 7 },
    ]),
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
    }),
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
    }),
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
    createChartProps({ showValue: false }),
  );
  const { series } = getEchartOptions(transformedProps);

  expect(series?.[0]?.label?.show).toBe(false);
  expect(series?.[1]?.label?.show).toBe(false);
});

test('hides zero value labels but keeps non-zero labels', () => {
  const transformedProps = transformProps(
    createChartProps({}, [{ category: 'A', left_sum: 0, right_sum: 12 }]),
  );
  const formatter =
    getEchartOptions(transformedProps).series?.[0]?.label?.formatter;

  expect(formatter?.({ value: 0 } as CallbackDataParams)).toBe('');
  expect(formatter?.({ value: -10 } as CallbackDataParams)).toBe('10');
});

test('formats axis and tooltip values as absolute numbers', () => {
  const transformedProps = transformProps(createChartProps());
  const { xAxis, tooltip } = getEchartOptions(transformedProps);

  expect(xAxis?.axisLabel?.formatter?.(-25)).toBe('25');

  const tooltipHtml = tooltip?.formatter?.([
    {
      name: categoryKeyA,
      dataIndex: 0,
      seriesName: 'left_sum',
      value: -10,
    } as CallbackDataParams,
    {
      name: categoryKeyA,
      dataIndex: 0,
      seriesName: 'right_sum',
      value: 25,
    } as CallbackDataParams,
  ]);

  expect(tooltipHtml).toContain('A');
  expect(tooltipHtml).not.toContain(categoryKeyA);
  expect(tooltipHtml).toContain('left_sum');
  expect(tooltipHtml).toContain('right_sum');
  expect(tooltipHtml).toContain('10');
  expect(tooltipHtml).toContain('25');
});

test('shows the category label in the tooltip when ECharts reports a unique key', () => {
  const transformedProps = transformProps(createChartProps());
  const tooltipHtml = getEchartOptions(transformedProps).tooltip?.formatter?.({
    name: categoryKeyA,
    seriesName: 'left_sum',
    value: -10,
  } as CallbackDataParams);

  expect(tooltipHtml).toContain('A');
  expect(tooltipHtml).not.toContain(categoryKeyA);
});

test('hides tooltip while the context menu is open', () => {
  const transformedProps = transformProps(createChartProps());
  const withContextMenu = transformProps(
    createChartProps({ inContextMenu: true }),
  );

  expect(getEchartOptions(transformedProps).tooltip?.show).toBe(true);
  expect(getEchartOptions(withContextMenu).tooltip?.show).toBe(false);
});

test('builds labelMap and groupby for drill and cross-filter handlers', () => {
  const transformedProps = transformProps(createChartProps());

  expect(transformedProps.groupby).toEqual(['category']);
  expect(transformedProps.labelMap).toEqual({
    'A__["A"]': ['A'],
    'B__["B"]': ['B'],
  });
});

test('uses unique keys for interactions and readable labels on the y-axis', () => {
  const transformedProps = transformProps(
    createChartProps({ groupby: ['country', 'state'] }, [
      { country: 'US', state: 'CA', left_sum: 4, right_sum: 6 },
      { country: 'US', state: 'NY', left_sum: 8, right_sum: 3 },
    ]),
  );
  const series = getEchartOptions(transformedProps).series ?? [];
  const firstKey = 'US, CA__["US","CA"]';
  const secondKey = 'US, NY__["US","NY"]';

  expect(firstKey).not.toBe(secondKey);
  expect(series[0]?.data?.map(point => point.name)).toEqual([
    firstKey,
    secondKey,
  ]);
  expect(transformedProps.labelMap).toEqual({
    [firstKey]: ['US', 'CA'],
    [secondKey]: ['US', 'NY'],
  });
  expect(getEchartOptions(transformedProps).yAxis?.data).toEqual([
    'US, CA',
    'US, NY',
  ]);
});

test('dims unselected categories when a cross-filter is active', () => {
  const transformedProps = transformProps(
    createChartProps({
      filterState: { selectedValues: [categoryKeyA] },
    }),
  );
  const series = getEchartOptions(transformedProps).series ?? [];

  expect(series[0]?.data?.[0]?.itemStyle?.opacity).toBe(
    OpacityEnum.NonTransparent,
  );
  expect(series[0]?.data?.[1]?.itemStyle?.opacity).toBe(
    OpacityEnum.SemiTransparent,
  );
  expect(series[1]?.data?.[1]?.itemStyle?.opacity).toBe(
    OpacityEnum.SemiTransparent,
  );
});

test('maps selectedValues to category indexes', () => {
  const transformedProps = transformProps(
    createChartProps({
      filterState: { selectedValues: [categoryKeyB] },
    }),
  );

  expect(transformedProps.selectedValues).toEqual({ 1: categoryKeyB });
});

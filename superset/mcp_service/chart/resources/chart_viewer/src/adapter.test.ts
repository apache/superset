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
import { describe, expect, test } from 'vitest';
import {
  availableViews,
  chartDataToEChartsOption,
  classifyColumns,
  defaultViewForChartType,
  resolveBigNumber,
} from './adapter';
import { getThemeTokens } from './theme';
import type { ChartData, DataColumn } from './types';

const theme = getThemeTokens('light');
const opts = { theme };

function col(partial: Partial<DataColumn> & { name: string; data_type: string }): DataColumn {
  return {
    display_name: partial.name,
    sample_values: [],
    null_count: 0,
    unique_count: 0,
    ...partial,
  } as DataColumn;
}

function makeData(over: Partial<ChartData>): ChartData {
  return {
    chart_id: 1,
    chart_name: 'Test',
    chart_type: 'echarts_timeseries_line',
    columns: [],
    data: [],
    row_count: 0,
    total_rows: null,
    ...over,
  } as ChartData;
}

describe('chartDataToEChartsOption', () => {
  test('multi-series line from temporal + numeric columns', () => {
    const data = makeData({
      chart_type: 'echarts_timeseries_line',
      columns: [
        col({ name: 'ds', display_name: 'Date', data_type: 'temporal' }),
        col({ name: 'a', display_name: 'Series A', data_type: 'numeric' }),
        col({ name: 'b', display_name: 'Series B', data_type: 'numeric' }),
      ],
      data: [
        { ds: '2026-01-01', a: 10, b: 5 },
        { ds: '2026-01-02', a: 12, b: 7 },
        { ds: '2026-01-03', a: 9, b: 8 },
      ],
      row_count: 3,
    });

    const option = chartDataToEChartsOption(data, 'line', opts) as any;

    // Two series, both line type, with stable ids for universal transitions.
    expect(option.series).toHaveLength(2);
    expect(option.series.map((s: any) => s.type)).toEqual(['line', 'line']);
    expect(option.series.map((s: any) => s.id)).toEqual(['a', 'b']);
    // Legend visible for multi-series.
    expect(option.legend.show).toBe(true);
    // x axis carries all three time buckets.
    expect(option.xAxis.data).toHaveLength(3);
    // y values line up with rows.
    expect(option.series[0].data).toEqual([10, 12, 9]);
  });

  test('categorical bar picks the string dimension for x', () => {
    const data = makeData({
      chart_type: 'echarts_timeseries_bar',
      columns: [
        col({ name: 'country', display_name: 'Country', data_type: 'string' }),
        col({ name: 'sales', display_name: 'Sales', data_type: 'numeric' }),
      ],
      data: [
        { country: 'US', sales: 100 },
        { country: 'CA', sales: 60 },
      ],
      row_count: 2,
    });

    const option = chartDataToEChartsOption(data, 'bar', opts) as any;

    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe('bar');
    expect(option.xAxis.data).toEqual(['US', 'CA']);
    // Single series => no legend.
    expect(option.legend.show).toBe(false);
  });

  test('area view produces a gradient areaStyle', () => {
    const data = makeData({
      columns: [
        col({ name: 'ds', data_type: 'temporal' }),
        col({ name: 'v', data_type: 'numeric' }),
      ],
      data: [
        { ds: '2026-01-01', v: 1 },
        { ds: '2026-01-02', v: 2 },
      ],
      row_count: 2,
    });
    const option = chartDataToEChartsOption(data, 'area', opts) as any;
    expect(option.series[0].areaStyle).toBeDefined();
    expect(option.series[0].type).toBe('line');
  });

  test('big number resolves a single KPI value', () => {
    const data = makeData({
      chart_type: 'big_number_total',
      columns: [col({ name: 'revenue', display_name: 'Revenue', data_type: 'numeric' })],
      data: [{ revenue: 4820000 }],
      row_count: 1,
      total_rows: 1,
    });

    expect(defaultViewForChartType(data.chart_type, data)).toBe('big_number');
    const { value, label } = resolveBigNumber(data);
    expect(value).toBe(4820000);
    expect(label).toBe('Revenue');
    // Big number returns an empty ECharts option (rendered by React instead).
    expect(chartDataToEChartsOption(data, 'big_number', opts)).toEqual({});
  });

  test('big number sums non-temporal multi-row data', () => {
    const data = makeData({
      chart_type: 'big_number_total',
      columns: [
        col({ name: 'region', data_type: 'string' }),
        col({ name: 'amt', data_type: 'numeric' }),
      ],
      data: [
        { region: 'A', amt: 10 },
        { region: 'B', amt: 15 },
      ],
      row_count: 2,
    });
    expect(resolveBigNumber(data).value).toBe(25);
  });

  test('unknown chart_type falls back to the table view', () => {
    const data = makeData({
      chart_type: 'some_exotic_viz',
      columns: [
        col({ name: 'label', data_type: 'string' }),
        col({ name: 'x', data_type: 'numeric' }),
      ],
      data: [{ label: 'a', x: 1 }],
      row_count: 1,
    });
    // With a dimension + numeric it becomes a bar; a purely non-plottable shape
    // falls to table. Verify the pure text/blob case:
    const blob = makeData({
      chart_type: 'totally_unknown',
      columns: [col({ name: 'note', data_type: 'string' })],
      data: [{ note: 'hello' }, { note: 'world' }],
      row_count: 2,
    });
    expect(defaultViewForChartType(blob.chart_type, blob)).toBe('table');
    expect(availableViews(data)).toContain('table');
  });

  test('empty data does not throw and yields empty x axis', () => {
    const data = makeData({
      columns: [
        col({ name: 'ds', data_type: 'temporal' }),
        col({ name: 'v', data_type: 'numeric' }),
      ],
      data: [],
      row_count: 0,
    });
    const option = chartDataToEChartsOption(data, 'line', opts) as any;
    expect(option.xAxis.data).toEqual([]);
    expect(option.series[0].data).toEqual([]);
  });

  test('classifyColumns picks temporal dimension over string', () => {
    const data = makeData({
      columns: [
        col({ name: 's', data_type: 'string' }),
        col({ name: 'ds', data_type: 'temporal' }),
        col({ name: 'n', data_type: 'numeric' }),
      ],
    });
    const roles = classifyColumns(data);
    expect(roles.dimension?.name).toBe('ds');
    expect(roles.dimensionIsTemporal).toBe(true);
    expect(roles.numeric).toHaveLength(1);
  });
});

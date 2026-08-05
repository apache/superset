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
  PIE_MAX_SLICES,
  availableViews,
  buildPieSlices,
  chartDataToEChartsOption,
  classifyColumns,
  defaultViewForChartType,
  describeChart,
  isCartesianView,
  isEChartsView,
  pieTooltipFormatter,
  resolveBigNumber,
  scatterTooltipFormatter,
  tooltipFormatter,
} from './adapter';
import { getThemeTokens } from './theme';
import type { ChartData, DataColumn } from './types';

const theme = getThemeTokens('light');
const opts = { theme };

function col(
  partial: Partial<DataColumn> & { name: string; data_type: string },
): DataColumn {
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
      columns: [
        col({ name: 'revenue', display_name: 'Revenue', data_type: 'numeric' }),
      ],
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

describe('tooltip HTML escaping (XSS)', () => {
  const dim: DataColumn = {
    name: 'country',
    display_name: '<img src=x onerror=alert(1)>',
    data_type: 'string',
    sample_values: [],
    null_count: 0,
    unique_count: 1,
  };

  it('escapes series names, axis values, dimension labels and values', () => {
    // ECharts renders this formatter's output as HTML, so any data-derived
    // string reaching it must be escaped.
    const html = tooltipFormatter(
      [
        {
          axisValue: '<script>alert("x")</script>',
          seriesName: '<b>evil</b>',
          marker: '<span class="mk"></span>',
          value: '<i>not-a-number</i>',
        },
      ],
      dim,
      false,
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>evil</b>');
    expect(html).not.toContain('<i>not-a-number</i>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    // ECharts' own marker markup is not user data and is preserved.
    expect(html).toContain('<span class="mk"></span>');
  });

  it('still renders numeric values normally', () => {
    const html = tooltipFormatter(
      [{ axisValue: 'Jan', seriesName: 'Revenue', marker: '', value: 1234 }],
      null,
      false,
    );
    expect(html).toContain('1,234');
  });
});

describe('categorical axis values', () => {
  test('strips trust markers from category labels', () => {
    const data = makeData({
      chart_type: 'table',
      columns: [
        col({
          name: 'product_line',
          display_name: 'Product Line',
          data_type: 'string',
        }),
        col({ name: 'sold', display_name: 'Sold', data_type: 'numeric' }),
      ],
      data: [
        {
          product_line: '<UNTRUSTED-CONTENT>\nClassic Cars\n</UNTRUSTED-CONTENT>',
          sold: 33992,
        },
        {
          product_line: '<UNTRUSTED-CONTENT>\nShips\n</UNTRUSTED-CONTENT>',
          sold: 8127,
        },
      ],
      row_count: 2,
    });

    const option = chartDataToEChartsOption(data, 'bar', opts) as any;

    expect(option.xAxis.data).toEqual(['Classic Cars', 'Ships']);
  });
});

describe('pie view', () => {
  function categorical(rows: Array<Record<string, unknown>>): ChartData {
    return makeData({
      chart_type: 'pie',
      columns: [
        col({ name: 'country', display_name: 'Country', data_type: 'string' }),
        col({ name: 'sales', display_name: 'Sales', data_type: 'numeric' }),
      ],
      data: rows,
      row_count: rows.length,
    });
  }

  test('viz_type "pie" maps to a real pie, not the table fallback', () => {
    const data = categorical([
      { country: 'US', sales: 100 },
      { country: 'CA', sales: 60 },
    ]);
    expect(defaultViewForChartType('pie', data)).toBe('pie');
    expect(defaultViewForChartType('echarts_pie_donut', data)).toBe('pie');
    expect(availableViews(data)).toContain('pie');
  });

  test('a pie without a measure cannot be built, so it is not offered', () => {
    const noMeasure = makeData({
      chart_type: 'pie',
      columns: [col({ name: 'note', data_type: 'string' })],
      data: [{ note: 'a' }],
      row_count: 1,
    });
    expect(availableViews(noMeasure)).not.toContain('pie');
    // ...and the default view must stay inside availableViews.
    expect(availableViews(noMeasure)).toContain(
      defaultViewForChartType('pie', noMeasure),
    );
  });

  test('builds one wedge per row, largest first', () => {
    const data = categorical([
      { country: 'CA', sales: 60 },
      { country: 'US', sales: 100 },
      { country: 'MX', sales: 20 },
    ]);
    const option = chartDataToEChartsOption(data, 'pie', opts) as any;
    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe('pie');
    expect(option.series[0].data.map((s: any) => s.name)).toEqual([
      'US',
      'CA',
      'MX',
    ]);
    // The measure id is shared with the cartesian series so views morph.
    expect(option.series[0].id).toBe('sales');
  });

  test('wedges carry the source row index so drill/ask stay correct', () => {
    const data = categorical([
      { country: 'CA', sales: 60 },
      { country: 'US', sales: 100 },
    ]);
    const option = chartDataToEChartsOption(data, 'pie', opts) as any;
    // Sorted largest-first, so the first wedge is row 1, not row 0.
    expect(option.series[0].data[0]).toMatchObject({
      name: 'US',
      rowIndex: 1,
    });
  });

  test('collapses a long tail into a single "Other" wedge', () => {
    const rows = Array.from({ length: PIE_MAX_SLICES + 5 }, (_, i) => ({
      country: `C${i}`,
      sales: 100 - i,
    }));
    const slices = buildPieSlices(
      categorical(rows),
      col({ name: 'sales', data_type: 'numeric' }),
      col({ name: 'country', data_type: 'string' }),
    );
    expect(slices).toHaveLength(PIE_MAX_SLICES + 1);
    const other = slices[slices.length - 1];
    expect(other.name).toBe('Other (5)');
    expect(other.rowIndex).toBe(-1);
    // The tail total is preserved, not dropped.
    expect(other.value).toBe(
      rows.slice(PIE_MAX_SLICES).reduce((s, r) => s + r.sales, 0),
    );
  });

  test('drops non-positive values that cannot be a share of a whole', () => {
    const slices = buildPieSlices(
      categorical([
        { country: 'US', sales: 100 },
        { country: 'CA', sales: -5 },
        { country: 'MX', sales: 0 },
      ]),
      col({ name: 'sales', data_type: 'numeric' }),
      col({ name: 'country', data_type: 'string' }),
    );
    expect(slices.map((s) => s.name)).toEqual(['US']);
  });

  test('strips trust markers from wedge labels', () => {
    const data = categorical([
      {
        country: '<UNTRUSTED-CONTENT>\nClassic Cars\n</UNTRUSTED-CONTENT>',
        sales: 10,
      },
    ]);
    const option = chartDataToEChartsOption(data, 'pie', opts) as any;
    expect(option.series[0].data[0].name).toBe('Classic Cars');
  });

  test('pie tooltip escapes data-derived HTML', () => {
    const html = pieTooltipFormatter(
      { marker: '<span class="mk"></span>', name: '<img src=x>', value: 25 },
      '<b>Sales</b>',
      100,
    );
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('<b>Sales</b>');
    expect(html).toContain('25 (25.0%)');
    expect(html).toContain('<span class="mk"></span>');
  });
});

describe('scatter view', () => {
  function twoMeasures(): ChartData {
    return makeData({
      chart_type: 'echarts_scatter',
      columns: [
        col({ name: 'label', display_name: 'Label', data_type: 'string' }),
        col({ name: 'spend', display_name: 'Spend', data_type: 'numeric' }),
        col({ name: 'revenue', display_name: 'Revenue', data_type: 'numeric' }),
      ],
      data: [
        { label: 'a', spend: 1, revenue: 10 },
        { label: 'b', spend: 2, revenue: 20 },
      ],
      row_count: 2,
    });
  }

  test('viz_type scatter/bubble maps to a scatter when two measures exist', () => {
    const data = twoMeasures();
    expect(defaultViewForChartType('echarts_scatter', data)).toBe('scatter');
    expect(defaultViewForChartType('bubble_v2', data)).toBe('scatter');
    expect(availableViews(data)).toContain('scatter');
  });

  test('a single-measure dataset never offers scatter', () => {
    const single = makeData({
      chart_type: 'echarts_scatter',
      columns: [
        col({ name: 'label', data_type: 'string' }),
        col({ name: 'v', data_type: 'numeric' }),
      ],
      data: [{ label: 'a', v: 1 }],
      row_count: 1,
    });
    expect(availableViews(single)).not.toContain('scatter');
    expect(availableViews(single)).toContain(
      defaultViewForChartType('echarts_scatter', single),
    );
  });

  test('plots the first measure on x and the second on y', () => {
    const option = chartDataToEChartsOption(twoMeasures(), 'scatter', opts) as any;
    expect(option.series[0].type).toBe('scatter');
    expect(option.xAxis.type).toBe('value');
    expect(option.xAxis.name).toBe('Spend');
    expect(option.yAxis.name).toBe('Revenue');
    expect(option.series[0].data.map((p: any) => p.value)).toEqual([
      [1, 10],
      [2, 20],
    ]);
    expect(option.series[0].data[1]).toMatchObject({ name: 'b', rowIndex: 1 });
  });

  test('degrades to a cartesian option when a second measure is missing', () => {
    const single = makeData({
      columns: [
        col({ name: 'ds', data_type: 'temporal' }),
        col({ name: 'v', data_type: 'numeric' }),
      ],
      data: [{ ds: '2026-01-01', v: 1 }],
      row_count: 1,
    });
    const option = chartDataToEChartsOption(single, 'scatter', opts) as any;
    expect(option.series[0].type).toBe('line');
    expect(option.xAxis.type).toBe('category');
  });

  test('scatter tooltip escapes data-derived HTML', () => {
    const html = scatterTooltipFormatter(
      { marker: '', name: '<script>x</script>', value: [1, 2] },
      '<b>x</b>',
      'y',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('text alternative for the chart', () => {
  const series = makeData({
    chart_name: '<UNTRUSTED-CONTENT>\nRevenue\n</UNTRUSTED-CONTENT>',
    columns: [
      col({ name: 'ds', display_name: 'Date', data_type: 'temporal' }),
      col({ name: 'rev', display_name: 'Revenue', data_type: 'numeric' }),
    ],
    data: [
      { ds: '2026-01-01', rev: 10 },
      { ds: '2026-02-01', rev: 20 },
    ],
    row_count: 2,
  });

  test('every ECharts-backed option carries an aria description', () => {
    for (const view of ['line', 'bar', 'area'] as const) {
      const option = chartDataToEChartsOption(series, view, opts) as any;
      expect(option.aria.enabled).toBe(true);
      expect(option.aria.label.description).toContain('Revenue');
    }
    // The big-number view is plain DOM text; no ECharts instance to label.
    expect(chartDataToEChartsOption(series, 'big_number', opts)).toEqual({});
  });

  test('names the view, the measures, the dimension and the span', () => {
    const text = describeChart(series, 'line');
    expect(text).toContain('Line chart');
    expect(text).toContain('Revenue by Date');
    expect(text).toContain('over 2 points');
    expect(text).toContain('Jan 1, 2026 to Feb 1, 2026');
    // Never leak the model-facing trust markers into the accessible name.
    expect(text).not.toContain('UNTRUSTED-CONTENT');
  });

  test('a pie is described by its largest share', () => {
    const pie = makeData({
      chart_name: 'Sales',
      chart_type: 'pie',
      columns: [
        col({ name: 'country', display_name: 'Country', data_type: 'string' }),
        col({ name: 'sales', display_name: 'Sales', data_type: 'numeric' }),
      ],
      data: [
        { country: 'US', sales: 75 },
        { country: 'CA', sales: 25 },
      ],
      row_count: 2,
    });
    const text = describeChart(pie, 'pie');
    expect(text).toContain('share of Sales by Country');
    expect(text).toContain('2 categories');
    expect(text).toContain('Largest is US at 75 (75%)');
  });

  test('a scatter names both axes', () => {
    const scatter = makeData({
      columns: [
        col({ name: 'spend', display_name: 'Spend', data_type: 'numeric' }),
        col({ name: 'rev', display_name: 'Revenue', data_type: 'numeric' }),
      ],
      data: [{ spend: 1, rev: 2 }],
      row_count: 1,
    });
    expect(describeChart(scatter, 'scatter')).toContain(
      'Revenue against Spend',
    );
  });

  test('an empty result says so rather than describing nothing', () => {
    const empty = makeData({ chart_name: 'Nothing', columns: [], data: [] });
    expect(describeChart(empty, 'line')).toBe('Line chart "Nothing": no data.');
  });
});

describe('view classification helpers', () => {
  test('ECharts-backed views exclude table and big number', () => {
    expect(
      (['line', 'bar', 'area', 'pie', 'scatter'] as const).every(isEChartsView),
    ).toBe(true);
    expect(isEChartsView('table')).toBe(false);
    expect(isEChartsView('big_number')).toBe(false);
  });

  test('only line/bar/area are cartesian (brush-eligible)', () => {
    expect(['line', 'bar', 'area'].every((v) => isCartesianView(v as any))).toBe(
      true,
    );
    expect(isCartesianView('pie')).toBe(false);
    expect(isCartesianView('scatter')).toBe(false);
  });
});

describe('big-number fallback label', () => {
  test('strips model-facing trust markers from chart_name', () => {
    const result = resolveBigNumber(
      makeData({
        chart_name: '<UNTRUSTED-CONTENT> Monthly Revenue </UNTRUSTED-CONTENT>',
        chart_type: 'big_number_total',
        columns: [],
        data: [],
      }),
    );
    expect(result.label).toBe('Monthly Revenue');
  });
});

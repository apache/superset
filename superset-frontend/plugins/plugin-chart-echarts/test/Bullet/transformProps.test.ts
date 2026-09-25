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
import { ChartProps, SqlaFormData, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Bullet/transformProps';
import { EchartsBulletChartProps } from '../../src/Bullet/types';

const formData: SqlaFormData = {
  datasource: '5__table',
  viz_type: VizType.Bullet,
  metric: 'sum__num',
  ranges: '100,200,300',
  rangeLabels: 'low,mid,high',
  markers: '150',
  markerLabels: 'goal',
  markerLines: '250',
  markerLineLabels: 'stretch',
};

const chartProps = (overrides: Partial<SqlaFormData> = {}) =>
  new ChartProps({
    width: 800,
    height: 200,
    formData: { ...formData, ...overrides },
    theme: supersetTheme,
    queriesData: [{ data: [{ sum__num: 120 }] }],
    hooks: {},
  }) as unknown as EchartsBulletChartProps;

test('renders the measure bar with markers, marker lines and range bands', () => {
  const { echartOptions } = transformProps(chartProps());
  const { series } = echartOptions as any;

  // measure bar
  expect(series[0].type).toBe('bar');
  expect(series[0].data).toEqual([120]);

  // marker lines are their own named series so the legend can toggle them
  const lineSeries = series.filter((x: any) => x.type === 'line');
  expect(lineSeries).toHaveLength(1);
  expect(lineSeries[0].markLine.data[0].xAxis).toBe(250);

  // nested range bands, largest drawn first
  const bandEnds = series[0].markArea.data.map((d: any) => d[1].xAxis);
  expect(bandEnds).toEqual([300, 200, 100]);

  // triangle markers, one named series each
  const markerSeries = series.filter((x: any) => x.symbol === 'triangle');
  expect(markerSeries).toHaveLength(1);
  expect(markerSeries[0].data[0].value).toEqual([150, 0]);

  // axis spans all values
  expect((echartOptions as any).xAxis.max).toBe(300);

  // markers sit below the bar (pixel offset); legend off unless enabled
  const marker = series.find((x: any) => x.symbol === 'triangle');
  expect(marker.symbolOffset[1]).toBeGreaterThan(0);
  expect((echartOptions as any).legend.show).toBe(false);

  // range thresholds get their own named hover-target series
  const rangeSeries = series.filter((x: any) => x.symbol === 'rect');
  const rangeTips = rangeSeries.map((x: any) => x.data[0].tooltip.formatter());
  expect(rangeTips.join(' ')).toContain('low');
  expect(rangeTips.join(' ')).toContain('high');
});

test('defaults the band to 110% of the measure when no ranges are set', () => {
  const { echartOptions } = transformProps(
    chartProps({
      ranges: '',
      rangeLabels: '',
      markers: '',
      markerLabels: '',
      markerLines: '',
      markerLineLabels: '',
    }),
  );
  const { series } = echartOptions as any;
  expect(series[0].data).toEqual([120]);
  const bandEnds = series[0].markArea.data.map((d: any) => d[1].xAxis);
  expect(bandEnds).toEqual([120 * 1.1]);
  expect(series.filter((x: any) => x.symbol === 'triangle')).toHaveLength(0);
});

test('keeps distinct labels for duplicate marker and marker-line values', () => {
  const { echartOptions } = transformProps(
    chartProps({
      markers: '150,150',
      markerLabels: 'goal,forecast',
      markerLines: '250,250',
      markerLineLabels: 'stretch,ceiling',
    }),
  );
  const { series } = echartOptions as any;

  const markLineLabels = series
    .filter((x: any) => x.type === 'line')
    .map((x: any) => x.markLine.data[0].label.formatter());
  expect(markLineLabels).toEqual(['stretch', 'ceiling']);

  const markerTooltips = series
    .filter((x: any) => x.symbol === 'triangle')
    .map((x: any) => x.data[0].tooltip.formatter());
  expect(markerTooltips[0]).toContain('goal');
  expect(markerTooltips[1]).toContain('forecast');
});

test('keeps the tooltip enabled regardless of the label and legend toggles', () => {
  const { echartOptions } = transformProps(
    chartProps({ showLabels: true, showLegend: true }),
  );
  expect((echartOptions as any).tooltip.show).not.toBe(false);
});

test('names the containing range in the measure bar tooltip', () => {
  const { echartOptions } = transformProps(chartProps());
  // measure 120 falls within the 100..200 band labelled "mid"
  expect((echartOptions as any).series[0].tooltip.formatter()).toContain('mid');
});

test('marks a measure beyond every range as past the last label', () => {
  const props = new ChartProps({
    width: 800,
    height: 200,
    formData,
    theme: supersetTheme,
    queriesData: [{ data: [{ sum__num: 450 }] }],
    hooks: {},
  }) as unknown as EchartsBulletChartProps;
  const { echartOptions } = transformProps(props);
  expect((echartOptions as any).series[0].tooltip.formatter()).toContain(
    '&gt; high',
  );
});

test('renders range labels inside the top-right corner of their bands', () => {
  const { echartOptions } = transformProps(chartProps({ showLabels: true }));
  const { series } = echartOptions as any;

  // band labels live on the markArea items, not on the hover-target points
  const bandLabels = series[0].markArea.data.map((d: any) => d[0].label);
  bandLabels.forEach((label: any) => {
    expect(label.show).toBe(true);
    expect(label.position).toBe('insideTopRight');
  });
  const rangeSeries = series.filter((x: any) => x.symbol === 'rect');
  rangeSeries.forEach((x: any) => {
    expect(x.data[0].label).toBeUndefined();
  });

  // labels hide with the toggle off or when the range has no label
  const { echartOptions: unlabelled } = transformProps(
    chartProps({ showLabels: false }),
  );
  (unlabelled as any).series[0].markArea.data.forEach((d: any) => {
    expect(d[0].label.show).toBe(false);
  });
});

test('reserves more grid space when the legend wraps onto extra rows', () => {
  const wide = transformProps(chartProps({ showLegend: true }))
    .echartOptions as any;
  const narrow = transformProps(
    new ChartProps({
      width: 220,
      height: 200,
      formData: { ...formData, showLegend: true },
      theme: supersetTheme,
      queriesData: [{ data: [{ sum__num: 120 }] }],
      hooks: {},
    }) as unknown as EchartsBulletChartProps,
  ).echartOptions as any;

  expect(narrow.grid.top).toBeGreaterThan(wide.grid.top);
  // without a legend the grid keeps its slim top margin
  const noLegend = transformProps(chartProps()).echartOptions as any;
  expect(noLegend.grid.top).toBeLessThan(wide.grid.top);
});

test('sanitizes HTML in metric and marker labels before rendering tooltips', () => {
  const { echartOptions } = transformProps(
    chartProps({
      markers: '150',
      markerLabels: '<img src=x onerror=alert(1)>',
    }),
  );
  const { series } = echartOptions as any;

  expect(series[0].tooltip.formatter()).not.toContain('onerror');
  expect(series[2].data[0].tooltip.formatter()).not.toContain('onerror');
});

test('handles an empty query result without crashing', () => {
  const props = new ChartProps({
    width: 800,
    height: 200,
    formData,
    theme: supersetTheme,
    queriesData: [{ data: [] }],
    hooks: {},
  }) as unknown as EchartsBulletChartProps;
  const { echartOptions } = transformProps(props);
  expect((echartOptions as any).series[0].data).toEqual([0]);
  // the axis domain must not collapse to zero width
  const { min, max } = (echartOptions as any).xAxis;
  expect(max).toBeGreaterThan(min);
});

test('splits into one bullet row per group value with shared markers', () => {
  const props = new ChartProps({
    width: 800,
    height: 400,
    formData: { ...formData, groupby: ['state'] },
    theme: supersetTheme,
    queriesData: [
      {
        data: [
          { state: 'CA', sum__num: 120 },
          { state: 'NY', sum__num: 90 },
        ],
      },
    ],
    hooks: {},
  }) as unknown as EchartsBulletChartProps;
  const { echartOptions } = transformProps(props);
  const { series, yAxis } = echartOptions as any;

  // one category and one bar value per group
  expect(yAxis.data).toEqual(['CA', 'NY']);
  expect(yAxis.axisLabel.show).toBe(true);
  expect(series[0].data).toEqual([120, 90]);

  // the same marker repeats on every row
  const marker = series.find((x: any) => x.symbol === 'triangle');
  expect(marker.data.map((d: any) => d.value)).toEqual([
    [150, 0],
    [150, 1],
  ]);

  // grouped bar tooltips name the row
  expect(series[0].tooltip.formatter({ dataIndex: 1 })).toContain('NY');
});

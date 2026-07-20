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

  // marker lines on the bar series
  expect(series[0].markLine.data).toHaveLength(1);
  expect(series[0].markLine.data[0].xAxis).toBe(250);

  // nested range bands, largest drawn first
  const bandEnds = series[0].markArea.data.map((d: any) => d[1].xAxis);
  expect(bandEnds).toEqual([300, 200, 100]);

  // triangle markers
  expect(series[1].type).toBe('scatter');
  expect(series[1].data[0].value).toEqual([150, 0]);

  // axis spans all values
  expect((echartOptions as any).xAxis.max).toBe(300);
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
  expect(series[1].data).toHaveLength(0);
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

  const markLineLabels = series[0].markLine.data.map((d: any) =>
    d.label.formatter(),
  );
  expect(markLineLabels).toEqual(['stretch', 'ceiling']);

  const markerTooltips = series[1].data.map((d: any) => d.tooltip.formatter());
  expect(markerTooltips[0]).toContain('goal');
  expect(markerTooltips[1]).toContain('forecast');
});

test('sanitizes HTML in metric and marker labels before rendering tooltips', () => {
  const { echartOptions } = transformProps(
    chartProps({
      markers: '150',
      markerLabels: '<img src=x onerror=alert(1)>',
    }),
  );
  const { series, tooltip } = echartOptions as any;

  expect(tooltip.formatter()).not.toContain('onerror');
  expect(series[1].data[0].tooltip.formatter()).not.toContain('onerror');
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

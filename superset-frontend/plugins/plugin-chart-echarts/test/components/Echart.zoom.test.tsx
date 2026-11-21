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
import { getInstanceByDom, use, type EChartsCoreOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import {
  getTimeFormatter,
  getTimeFormatterRegistry,
  createSmartDateFormatter,
  SMART_DATE_ID,
  TimeGranularity,
  type ChartDataResponseResult,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { act, render, waitFor } from 'spec/helpers/testing-library';
import Echart from '../../src/components/Echart';
import { createSpacedXAxisFormatter } from '../../src/utils/formatters';
import transformProps from '../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import type {
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps,
} from '../../src/Timeseries/types';
import { createEchartsTimeseriesTestChartProps } from '../helpers';

// Use the real chart engine and actions, with SVG rendering for jsdom.
jest.mock('echarts/core', () => {
  const actual =
    jest.requireActual<typeof import('echarts/core')>('echarts/core');
  return {
    ...actual,
    init: (...[dom, theme, options]: Parameters<typeof actual.init>) =>
      actual.init(dom, theme, { ...options, renderer: 'svg' }),
  };
});

use([SVGRenderer]);

// Use zrender's built-in fallback font metrics when jsdom has no canvas.
const canvasContextSpy = jest
  .spyOn(HTMLCanvasElement.prototype, 'getContext')
  .mockReturnValue(null);
afterAll(() => canvasContextSpy.mockRestore());

beforeAll(() => {
  getTimeFormatterRegistry().registerValue(
    SMART_DATE_ID,
    createSmartDateFormatter(),
  );
});

/** Renders the production wrapper with a real ECharts instance. */
async function renderLiveChart(options: EChartsCoreOption, width: number) {
  const view = render(
    <Echart width={width} height={300} echartOptions={options} refs={{}} />,
    { useRedux: true, useTheme: true },
  );
  await waitFor(() =>
    expect(view.container.querySelector('svg text')).not.toBeNull(),
  );
  const chart = getInstanceByDom(
    view.container.firstElementChild as HTMLElement,
  );
  if (!chart)
    throw new Error('The production wrapper did not initialize ECharts');
  return { ...view, chart };
}

test('real dataZoom keeps dates visible away from the full-range boundaries', async () => {
  const min = Date.UTC(2026, 0, 1);
  const max = Date.UTC(2027, 0, 1);
  const jan10 = Date.UTC(2026, 0, 10);
  const mar1 = Date.UTC(2026, 2, 1);
  const formatter = createSpacedXAxisFormatter(
    getTimeFormatter('%Y-%m-%d'),
    min,
    max,
    400,
  );
  // Without the renderer's live geometry, this is the reviewer's blank-axis case.
  expect([jan10, Date.UTC(2026, 1, 1), mar1].map(formatter)).toEqual([
    '',
    '',
    '',
  ]);
  const { chart, container } = await renderLiveChart(
    {
      animation: false,
      useUTC: true,
      grid: { left: 0, right: 0, top: 10, bottom: 30 },
      xAxis: {
        type: 'time',
        min,
        max,
        axisLabel: {
          formatter,
          showMinLabel: true,
          showMaxLabel: true,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          hideOverlap: false,
        },
      },
      yAxis: { type: 'value', show: false },
      dataZoom: [{ type: 'inside' }],
      series: [
        {
          type: 'line',
          data: Array.from({ length: 366 }, (_, i) => [
            min + i * 86400000,
            100 + i,
          ]),
        },
      ],
    },
    400,
  );
  const labels = () =>
    Array.from(container.querySelectorAll('svg text'))
      .map(node => node.textContent?.trim())
      .filter(Boolean);
  expect(labels()).toEqual(
    expect.arrayContaining(['2026-01-01', '2027-01-01']),
  );
  for (const [startValue, endValue, first, last] of [
    [jan10, mar1, '2026-01-10', '2026-03-01'],
    [Date.UTC(2026, 5, 10), Date.UTC(2026, 7, 1), '2026-06-10', '2026-08-01'],
    [jan10, mar1, '2026-01-10', '2026-03-01'],
    [min, max, '2026-01-01', '2027-01-01'],
  ] as const) {
    act(() => chart.dispatchAction({ type: 'dataZoom', startValue, endValue }));
    await waitFor(() =>
      expect(labels()).toEqual(expect.arrayContaining([first, last])),
    );
    expect(labels().length).toBeGreaterThanOrEqual(2);
  }
});

test('180px Day chart renders full boundary dates without intersecting', async () => {
  const timestamps = [
    Date.UTC(2014, 2, 5),
    Date.UTC(2016, 0, 1),
    Date.UTC(2026, 0, 1),
    Date.UTC(2026, 7, 17),
  ];
  const query: ChartDataResponseResult & {
    label_map: Record<string, string[]>;
  } = {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    error: null,
    is_cached: false,
    query: '',
    rowcount: timestamps.length,
    sql_rowcount: timestamps.length,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    data: timestamps.map(__timestamp => ({ __timestamp, sales: 1 })),
    colnames: ['__timestamp', 'sales'],
    coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
    label_map: { __timestamp: ['__timestamp'], sales: ['sales'] },
  };
  const { echartOptions } = transformProps(
    createEchartsTimeseriesTestChartProps<
      EchartsTimeseriesFormData,
      EchartsTimeseriesChartProps
    >({
      defaultFormData: DEFAULT_FORM_DATA,
      defaultVizType: 'echarts_timeseries_line',
      width: 180,
      height: 300,
      formData: {
        granularity_sqla: 'ds',
        timeGrainSqla: TimeGranularity.DAY,
        xAxisTimeFormat: SMART_DATE_ID,
        metrics: ['sales'],
      },
      queriesData: [query],
    }),
  );
  const { chart } = await renderLiveChart(
    { ...echartOptions, animation: false },
    180,
  );
  const boundaries = ['Wed 5 Mar 2014', 'Mon 17 Aug 2026'].map(label => {
    const span = chart
      .getZr()
      .storage.getDisplayList()
      .find(
        element => element.type === 'tspan' && element.style.text === label,
      );
    expect(span).toBeDefined();
    if (!span) throw new Error(`Missing rendered boundary: ${label}`);
    const rect = span.getBoundingRect().clone();
    if (span.transform) rect.applyTransform(span.transform);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(180);
    return rect;
  });
  // intersect() counts touching edges as collisions; adjacent text rows may share an edge.
  expect(boundaries[1].y).toBeGreaterThanOrEqual(
    boundaries[0].y + boundaries[0].height,
  );
});

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
import { render as renderChart } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import {
  BinaryQueryObjectFilterClause,
  ChartProps,
  QueryFormColumn,
  QueryFormData,
  TimeGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import mockState from 'spec/fixtures/mockState';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import EchartsSunburst from '../../../../plugins/plugin-chart-echarts/src/Sunburst/EchartsSunburst';
import transformProps from '../../../../plugins/plugin-chart-echarts/src/Sunburst/transformProps';
import {
  EchartsSunburstChartProps,
  EchartsSunburstFormData,
} from '../../../../plugins/plugin-chart-echarts/src/Sunburst/types';
import { getTemporalXAxisDrillByFilter } from '../../../../plugins/plugin-chart-echarts/src/utils/xAxisDrillByFilter';
import type { EchartsProps } from '../../../../plugins/plugin-chart-echarts/src/types';
import DrillByModal from './DrillByModal';

setupAGGridModules();

const mockEchart = jest.fn();
jest.mock(
  '../../../../plugins/plugin-chart-echarts/src/components/Echart',
  () => (props: EchartsProps) => {
    mockEchart(props);
    return null;
  },
);

const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data*';

const ADHOC_ORDER_DATE: QueryFormColumn = {
  expressionType: 'SQL',
  sqlExpression: "DATE_TRUNC('month', order_date)",
  label: 'order_date',
};

const sunburstFormData = (
  temporalColumn: QueryFormColumn,
): EchartsSunburstFormData => ({
  datasource: '7__table',
  viz_type: 'sunburst_v2',
  slice_id: 101,
  groupby: [],
  columns: ['category', temporalColumn],
  metric: 'count',
  adhoc_filters: [],
  dateFormat: 'smart_date',
  timeGrainSqla: TimeGranularity.MONTH,
  granularitySqla: 'order_date',
});

/** Right-click the Oct 2024 segment of a rendered Sunburst chart. */
const sunburstDrillByFilters = (temporalColumn: QueryFormColumn) => {
  const onContextMenu = jest.fn();
  const props = transformProps(
    new ChartProps<EchartsSunburstFormData>({
      formData: sunburstFormData(temporalColumn),
      width: 800,
      height: 600,
      theme: supersetTheme,
      queriesData: [
        {
          colnames: ['category', 'order_date', 'count'],
          coltypes: [
            GenericDataType.String,
            GenericDataType.Temporal,
            GenericDataType.Numeric,
          ],
          data: [{ category: 'A', order_date: Date.UTC(2024, 9, 1), count: 3 }],
        },
      ],
      hooks: { onContextMenu },
    }) as EchartsSunburstChartProps,
  );
  renderChart(<EchartsSunburst {...props} />);
  const { eventHandlers } = mockEchart.mock.lastCall[0] as EchartsProps;
  const parent = (
    props.echartOptions as {
      series: { data: { name: string; children: { name: string }[] }[] }[];
    }
  ).series[0].data[0];
  const segment = parent.children[0];
  eventHandlers!.contextmenu({
    data: segment,
    treePathInfo: [
      { name: '', dataIndex: 0, value: 3 },
      { name: parent.name, dataIndex: 1, value: 3 },
      { name: segment.name, dataIndex: 2, value: 3 },
    ],
    event: { stop: jest.fn(), event: { clientX: 0, clientY: 0 } },
  });
  return onContextMenu.mock.lastCall[2].drillBy
    .filters as BinaryQueryObjectFilterClause[];
};

/** Open Drill by with the filters and return the chart-data request body. */
const drillByRequest = async (
  formData: QueryFormData,
  filters: BinaryQueryObjectFilterClause[],
  groupbyFieldName: string,
) => {
  render(
    <DrillByModal
      formData={formData}
      onHideModal={jest.fn()}
      dataset={{
        changed_on_humanized: '01-01-2001',
        created_on_humanized: '01-01-2001',
        description: 'desc',
        table_name: 'my_dataset',
        editors: [],
        columns: [
          { column_name: 'category', verbose_name: null },
          { column_name: 'region', verbose_name: null },
        ],
        verbose_map: {},
      }}
      column={{ column_name: 'region', verbose_name: null }}
      drillByConfig={{ groupbyFieldName, filters }}
      canDownload={false}
    />,
    { useDnd: true, useRedux: true, useRouter: true, initialState: mockState },
  );
  await screen.findByRole('dialog');
  await waitFor(() =>
    expect(fetchMock.callHistory.called(CHART_DATA_ENDPOINT)).toBe(true),
  );
  return JSON.parse(
    fetchMock.callHistory.lastCall(CHART_DATA_ENDPOINT)?.options
      ?.body as string,
  );
};

beforeEach(() => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { body: {} },
    { name: CHART_DATA_ENDPOINT },
  );
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
  mockEchart.mockClear();
});

test('Sunburst Drill by on a grained segment queries the whole bucket', async () => {
  const filters = sunburstDrillByFilters('order_date');
  const body = await drillByRequest(
    sunburstFormData('order_date'),
    filters,
    'columns',
  );
  // A grain on an equality filter would not survive simpleFilterToAdhoc and
  // convertFilter, leaving `order_date = <month start>`.
  expect(body.queries[0].filters).toContainEqual({
    col: 'order_date',
    op: 'TEMPORAL_RANGE',
    val: '2024-10-01T00:00:00 : 2024-11-01T00:00:00',
  });
  expect(body.queries[0].filters).not.toContainEqual(
    expect.objectContaining({ col: 'order_date', op: '==' }),
  );
});

test('Sunburst Drill by on an adhoc temporal segment writes a quoted ISO datetime', async () => {
  const filters = sunburstDrillByFilters(ADHOC_ORDER_DATE);
  const body = await drillByRequest(
    sunburstFormData(ADHOC_ORDER_DATE),
    filters,
    'columns',
  );
  expect(body.form_data.adhoc_filters).toContainEqual(
    expect.objectContaining({
      expressionType: 'SQL',
      sqlExpression:
        "(DATE_TRUNC('month', order_date)) = '2024-10-01T00:00:00'",
    }),
  );
});

test('Timeseries Drill by on an adhoc x-axis label sends an ISO datetime, not an epoch', async () => {
  const xAxis: QueryFormColumn = {
    expressionType: 'SQL',
    sqlExpression: "DATE_TRUNC('day', order_date)",
    label: 'order_day',
  };
  // Both Timeseries Drill by callers use this helper with the axis label.
  const filters = [
    getTemporalXAxisDrillByFilter('order_day', Date.UTC(2024, 9, 7)),
    getTemporalXAxisDrillByFilter(
      'order_day',
      Date.UTC(2024, 9, 7, 6),
      'PT6H' as TimeGranularity,
    ),
  ] as BinaryQueryObjectFilterClause[];
  const body = await drillByRequest(
    {
      datasource: '7__table',
      viz_type: 'echarts_timeseries_line',
      slice_id: 102,
      x_axis: xAxis,
      groupby: [],
      metrics: ['count'],
      adhoc_filters: [],
    },
    filters,
    'groupby',
  );
  // The backend writes an adhoc label comparator without coercion, so an
  // epoch integer would reach SQL as `<timestamp expr> = 1728259200000`.
  expect(body.queries[0].filters).toEqual(
    expect.arrayContaining([
      { col: 'order_day', op: '==', val: '2024-10-07T00:00:00' },
      { col: 'order_day', op: '==', val: '2024-10-07T06:00:00' },
    ]),
  );
});

test('Drill by drops the grain of an equality filter', async () => {
  const body = await drillByRequest(
    sunburstFormData('order_date'),
    [{ col: 'order_date', op: '==', val: 1727740800000, grain: 'P1M' }],
    'columns',
  );
  expect(body.queries[0].filters).toContainEqual({
    col: 'order_date',
    op: '==',
    val: 1727740800000,
  });
});

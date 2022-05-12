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
import { getChartControlPanelRegistry, SqlaFormData } from '@superset-ui/core';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { BigNumberTotalChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { StandardizedFormData } from './standardizedFormData';

const transformationMockFD: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  metric: 'max(sales)',
  metric_2: 'min(sales)',
  groupby: ['foo'],
  columns: ['bar'],
  x_axis: 'dttm',
  datasource: 'foo',
  viz_type: 'table',
};

const tableVizFormData = {
  datasource: '30__table',
  viz_type: 'table',
  time_grain_sqla: 'P1D',
  time_range: 'No filter',
  query_mode: 'aggregate',
  groupby: ['name'],
  metrics: ['count'],
  all_columns: [],
  percent_metrics: [],
  adhoc_filters: [],
  order_by_cols: [],
  row_limit: 10000,
  server_page_length: 10,
  order_desc: true,
  table_timestamp_format: 'smart_date',
  show_cell_bars: true,
  color_pn: true,
  applied_time_extras: {},
  url_params: {
    form_data_key:
      'p3No_sqDW7k-kMTzlBPAPd9vwp1IXTf6stbyzjlrPPa0ninvdYUUiMC6F1iKit3Y',
    dataset_id: '30',
  },
};
const tableVizStore = {
  form_data: tableVizFormData,
  controls: {
    datasource: {
      value: '30__table',
    },
    viz_type: {
      value: 'table',
    },
    slice_id: {},
    cache_timeout: {},
    url_params: {
      value: {
        form_data_key:
          'p3No_sqDW7k-kMTzlBPAPd9vwp1IXTf6stbyzjlrPPa0ninvdYUUiMC6F1iKit3Y',
        dataset_id: '30',
      },
    },
    granularity_sqla: {},
    time_grain_sqla: {
      value: 'P1D',
    },
    time_range: {
      value: 'No filter',
    },
    query_mode: {
      value: 'aggregate',
    },
    groupby: {
      value: ['name'],
    },
    metrics: {
      value: ['count'],
    },
    all_columns: {
      value: [],
    },
    percent_metrics: {
      value: [],
    },
    adhoc_filters: {
      value: [],
    },
    timeseries_limit_metric: {},
    order_by_cols: {
      value: [],
    },
    server_pagination: {},
    row_limit: {
      value: 10000,
    },
    server_page_length: {
      value: 10,
    },
    include_time: {},
    order_desc: {
      value: true,
    },
    show_totals: {},
    emit_filter: {},
    table_timestamp_format: {
      value: 'smart_date',
    },
    page_length: {},
    include_search: {},
    show_cell_bars: {
      value: true,
    },
    align_pn: {},
    color_pn: {
      value: true,
    },
    column_config: {},
    conditional_formatting: {},
  },
  datasource: {
    type: 'table',
    columns: [],
  },
};

beforeAll(() => {
  getChartControlPanelRegistry().registerValue(
    'big_number_total',
    new BigNumberTotalChartPlugin().controlPanel,
  );
  getChartControlPanelRegistry().registerValue(
    'table',
    new TableChartPlugin().controlPanel,
  );
});

test('should collect control values and create SFD', () => {
  const sfd = new StandardizedFormData(transformationMockFD);
  expect(sfd.dumpSFD().sharedFormData.metrics).toEqual([
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
    'max(sales)',
    'min(sales)',
  ]);
  expect(sfd.dumpSFD().sharedFormData.columns).toEqual(['foo', 'bar']);
  expect(sfd.dumpSFD().memorizedFormData).toEqual([
    ['table', transformationMockFD],
  ]);
});

test('should transform form_data between table and bigNumberTotal', () => {
  // table -> bigNumberTotal
  const sfd = new StandardizedFormData(tableVizFormData);
  const { formData: bntFormData, controlsState: btnControlsState } =
    sfd.transform('big_number_total', tableVizStore);
  expect(Object.keys(bntFormData).sort()).toEqual(
    [...Object.keys(btnControlsState), 'standardized_form_data'].sort(),
  );
  expect(bntFormData.viz_type).toBe('big_number_total');
  expect(bntFormData.metric).toBe('count');

  // change control values
  bntFormData.metric = 'sum(sales)';
  bntFormData.time_range = '2021 : 2022';
  btnControlsState.metric.value = 'sum(sales)';
  btnControlsState.time_range.value = '2021 : 2022';

  // bigNumberTotal -> table
  const sfd2 = new StandardizedFormData(bntFormData);
  const { formData: tblFormData, controlsState: tblControlsState } =
    sfd2.transform('table', {
      ...tableVizStore,
      form_data: bntFormData,
      controls: btnControlsState,
    });
  expect(Object.keys(tblFormData).sort()).toEqual(
    [...Object.keys(tblControlsState), 'standardized_form_data'].sort(),
  );
  expect(tblFormData.viz_type).toBe('table');
  expect(tblFormData.metrics).toEqual(['sum(sales)']);
  expect(tblFormData.groupby).toEqual([]);
  expect(tblFormData.time_range).toBe('2021 : 2022');
});

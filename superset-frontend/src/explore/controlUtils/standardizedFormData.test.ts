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
import {
  AdhocColumn,
  AdhocMetricSimple,
  AdhocMetricSQL,
  getChartControlPanelRegistry,
  QueryFormData,
  TimeGranularity,
} from '@superset-ui/core';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { BigNumberTotalChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { sections } from '@superset-ui/chart-controls';
import {
  StandardizedFormData,
  sharedMetricsKey,
  sharedColumnsKey,
  publicControls,
} from './standardizedFormData';

const adhocColumn: AdhocColumn = {
  expressionType: 'SQL',
  label: 'country',
  optionName: 'country',
  sqlExpression: 'country',
};
const adhocMetricSQL: AdhocMetricSQL = {
  expressionType: 'SQL',
  label: 'count',
  optionName: 'count',
  sqlExpression: 'count(*)',
};
const adhocMetricSimple: AdhocMetricSimple = {
  expressionType: 'SIMPLE',
  column: {
    id: 1,
    column_name: 'sales',
    columnName: 'sales',
    verbose_name: 'sales',
  },
  aggregate: 'SUM',
  label: 'count',
  optionName: 'count',
};

const tableVizFormData = {
  datasource: '30__table',
  viz_type: 'table',
  granularity_sqla: 'ds',
  time_grain_sqla: TimeGranularity.DAY,
  time_range: 'No filter',
  query_mode: 'aggregate',
  groupby: ['name', 'gender', adhocColumn],
  metrics: ['count', 'avg(sales)', adhocMetricSimple, adhocMetricSQL],
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
    granularity_sqla: {
      value: 'ds',
    },
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
      value: ['name', 'gender', adhocColumn],
    },
    metrics: {
      value: ['count', 'avg(sales)', adhocMetricSimple, adhocMetricSQL],
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

describe('should collect control values and create SFD', () => {
  const sharedKey = [...sharedMetricsKey, ...sharedColumnsKey];
  const sharedControlsFormData = {
    // metrics
    metric: 'm1',
    metrics: ['m2'],
    metric_2: 'm3',
    size: 'm4',
    x: 'm5',
    y: 'm6',
    secondary_metric: 'm7',
    // columns
    groupby: ['c1'],
    columns: ['c2'],
    groupbyColumns: ['c3'],
    groupbyRows: ['c4'],
    series: 'c5',
    entity: 'c6',
    series_columns: ['c7'],
  };
  const publicControlsFormData = {
    // time section
    granularity_sqla: 'time_column',
    time_grain_sqla: TimeGranularity.DAY,
    time_range: '2000 : today',
    // filters
    adhoc_filters: [],
    // subquery limit(series limit)
    limit: 5,
    // order by clause
    timeseries_limit_metric: 'orderby_metric',
    series_limit_metric: 'orderby_metric',
    // desc or asc in order by clause
    order_desc: true,
    // outer query limit
    row_limit: 100,
    // x asxs column
    x_axis: 'x_axis_column',
    // advanced analytics - rolling window
    rolling_type: 'sum',
    rolling_periods: 1,
    min_periods: 0,
    // advanced analytics - time comparison
    time_compare: '1 year ago',
    comparison_type: 'values',
    // advanced analytics - resample
    resample_rule: '1D',
    resample_method: 'zerofill',
  };
  const sourceMockFormData: QueryFormData = {
    ...sharedControlsFormData,
    ...publicControlsFormData,
    datasource: '100__table',
    viz_type: 'source_viz',
  };

  const sourceMockStore = {
    form_data: sourceMockFormData,
    controls: Object.fromEntries(
      Object.entries(sourceMockFormData).map(([key, value]) => [
        key,
        { value },
      ]),
    ),
    datasource: {
      type: 'table',
      columns: [],
    },
  };

  beforeAll(() => {
    getChartControlPanelRegistry().registerValue('source_viz', {
      controlPanelSections: [
        sections.advancedAnalyticsControls,
        {
          label: 'transform controls',
          controlSetRows: publicControls.map(control => [control]),
        },
        {
          label: 'axis column',
          controlSetRows: [['x_axis']],
        },
      ],
    });
    getChartControlPanelRegistry().registerValue('target_viz', {
      controlPanelSections: [
        sections.advancedAnalyticsControls,
        {
          label: 'transform controls',
          controlSetRows: publicControls.map(control => [control]),
        },
        {
          label: 'axis column',
          controlSetRows: [['x_axis']],
        },
      ],
      formDataOverrides: (formData: QueryFormData) => ({
        ...formData,
        columns: formData.standardizedFormData.controls.columns,
        metrics: formData.standardizedFormData.controls.metrics,
      }),
    });
  });

  test('should avoid to overlap', () => {
    const sharedControlsSet = new Set(Object.keys(sharedKey));
    const publicControlsSet = new Set(publicControls);
    expect(
      [...sharedControlsSet].filter((x: string) => publicControlsSet.has(x)),
    ).toEqual([]);
  });

  test('should collect all sharedControls', () => {
    expect(Object.entries(sharedControlsFormData).length).toBe(
      Object.entries(sharedKey).length,
    );
    const sfd = new StandardizedFormData(sourceMockFormData);
    expect(sfd.serialize().controls.metrics).toEqual([
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'm7',
    ]);
    expect(sfd.serialize().controls.columns).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
    ]);
  });

  test('should transform all publicControls and sharedControls', () => {
    expect(Object.entries(publicControlsFormData).length).toBe(
      publicControls.length,
    );

    const sfd = new StandardizedFormData(sourceMockFormData);
    const { formData } = sfd.transform('target_viz', sourceMockStore);
    Object.entries(publicControlsFormData).forEach(([key, value]) => {
      expect(formData).toHaveProperty(key);
      expect(value).toEqual(publicControlsFormData[key]);
    });
    expect(formData.columns).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
    ]);
    expect(formData.metrics).toEqual([
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'm7',
    ]);
  });

  test('should inherit standardizedFormData and memorizedFormData is LIFO', () => {
    // from source_viz to target_viz
    const sfd = new StandardizedFormData(sourceMockFormData);
    const { formData, controlsState } = sfd.transform(
      'target_viz',
      sourceMockStore,
    );
    expect(
      formData.standardizedFormData.memorizedFormData.map(
        (fd: [string, QueryFormData]) => fd[0],
      ),
    ).toEqual(['source_viz']);

    // from target_viz to source_viz
    const sfd2 = new StandardizedFormData(formData);
    const { formData: fd2, controlsState: cs2 } = sfd2.transform('source_viz', {
      ...sourceMockStore,
      form_data: formData,
      controls: controlsState,
    });
    expect(
      fd2.standardizedFormData.memorizedFormData.map(
        (fd: [string, QueryFormData]) => fd[0],
      ),
    ).toEqual(['source_viz', 'target_viz']);

    // from source_viz to target_viz
    const sfd3 = new StandardizedFormData(fd2);
    const { formData: fd3 } = sfd3.transform('target_viz', {
      ...sourceMockStore,
      form_data: fd2,
      controls: cs2,
    });
    expect(
      fd3.standardizedFormData.memorizedFormData.map(
        (fd: [string, QueryFormData]) => fd[0],
      ),
    ).toEqual(['target_viz', 'source_viz']);
  });
});

describe('should transform form_data between table and bigNumberTotal', () => {
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

  test('get and has', () => {
    // table -> bigNumberTotal
    const sfd = new StandardizedFormData(tableVizFormData);
    const { formData: bntFormData } = sfd.transform(
      'big_number_total',
      tableVizStore,
    );

    // bigNumberTotal -> table
    const sfd2 = new StandardizedFormData(bntFormData);
    expect(sfd2.has('big_number_total')).toBeTruthy();
    expect(sfd2.has('table')).toBeTruthy();
    expect(sfd2.get('big_number_total').viz_type).toBe('big_number_total');
    expect(sfd2.get('table').viz_type).toBe('table');
  });

  test('transform', () => {
    // table -> bigNumberTotal
    const sfd = new StandardizedFormData(tableVizFormData);
    const { formData: bntFormData, controlsState: bntControlsState } =
      sfd.transform('big_number_total', tableVizStore);
    expect(Object.keys(bntFormData).sort()).toEqual(
      [...Object.keys(bntControlsState), 'standardizedFormData'].sort(),
    );
    expect(bntFormData.viz_type).toBe('big_number_total');
    expect(bntFormData.metric).toBe('count');

    // change control values on bigNumber
    bntFormData.metric = 'sum(sales)';
    bntFormData.time_range = '2021 : 2022';
    bntControlsState.metric.value = 'sum(sales)';
    bntControlsState.time_range.value = '2021 : 2022';

    // bigNumberTotal -> table
    const sfd2 = new StandardizedFormData(bntFormData);
    const { formData: tblFormData, controlsState: tblControlsState } =
      sfd2.transform('table', {
        ...tableVizStore,
        form_data: bntFormData,
        controls: bntControlsState,
      });
    expect(Object.keys(tblFormData).sort()).toEqual(
      [...Object.keys(tblControlsState), 'standardizedFormData'].sort(),
    );
    expect(tblFormData.viz_type).toBe('table');
    expect(tblFormData.metrics).toEqual([
      'sum(sales)',
      'avg(sales)',
      adhocMetricSimple,
      adhocMetricSQL,
    ]);
    expect(tblFormData.groupby).toEqual(['name', 'gender', adhocColumn]);
    expect(tblFormData.time_range).toBe('2021 : 2022');
  });
});

describe('initial SFD between different datasource', () => {
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

  test('initial SFD between different datasource', () => {
    const sfd = new StandardizedFormData(tableVizFormData);
    // table -> big number
    const { formData: bntFormData, controlsState: bntControlsState } =
      sfd.transform('big_number_total', tableVizStore);
    const sfd2 = new StandardizedFormData(bntFormData);
    // big number -> table
    const { formData: tblFormData } = sfd2.transform('table', {
      ...tableVizStore,
      form_data: bntFormData,
      controls: bntControlsState,
    });

    expect(
      tblFormData.standardizedFormData.memorizedFormData.map(
        (mfd: [string, QueryFormData][]) => mfd[0],
      ),
    ).toEqual(['table', 'big_number_total']);
    const newDatasourceFormData = { ...tblFormData, datasource: '20__table' };
    const newDatasourceSFD = new StandardizedFormData(newDatasourceFormData);
    expect(
      newDatasourceSFD
        .serialize()
        .memorizedFormData.map(([vizType]) => vizType),
    ).toEqual(['table']);
    expect(newDatasourceSFD.get('table')).not.toHaveProperty(
      'standardizedFormData',
    );
  });
});

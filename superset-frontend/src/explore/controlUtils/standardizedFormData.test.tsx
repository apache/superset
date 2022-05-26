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
import { getChartControlPanelRegistry, QueryFormData } from '@superset-ui/core';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { BigNumberTotalChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { sections } from '@superset-ui/chart-controls';
import {
  StandardizedFormData,
  sharedControls,
  publicControls,
} from './standardizedFormData';
import { xAxisControl } from '../../../plugins/plugin-chart-echarts/src/controls';

describe('should collect control values and create SFD', () => {
  const sharedControlsFormData = {};
  Object.entries(sharedControls).forEach(([, names]) => {
    names.forEach(name => {
      sharedControlsFormData[name] = name;
    });
  });
  const publicControlsFormData = Object.fromEntries(
    publicControls.map((name, idx) => [[name], idx]),
  );
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
          controlSetRows: [[xAxisControl]],
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
          controlSetRows: [[xAxisControl]],
        },
      ],
      denormalizeFormData: (formData: QueryFormData) => ({
        ...formData,
        columns: formData.standardizedFormData.standardizedState.columns,
        metrics: formData.standardizedFormData.standardizedState.metrics,
      }),
    });
  });

  test('collect sharedControls', () => {
    const sfd = new StandardizedFormData(sourceMockFormData);

    expect(sfd.dumpSFD().standardizedState.metrics).toEqual(
      sharedControls.metrics.map(controlName => controlName),
    );
    expect(sfd.dumpSFD().standardizedState.columns).toEqual(
      sharedControls.columns.map(controlName => controlName),
    );
  });

  test('should transform all publicControls', () => {
    const sfd = new StandardizedFormData(sourceMockFormData);
    const { formData } = sfd.transform('target_viz', sourceMockStore);
    Object.entries(publicControlsFormData).forEach(([key]) => {
      expect(formData).toHaveProperty(key);
    });
    Object.entries(sharedControls).forEach(([key, value]) => {
      expect(formData[key]).toEqual(value);
    });
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

    // change control values
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
    expect(tblFormData.metrics).toEqual(['sum(sales)']);
    expect(tblFormData.groupby).toEqual([]);
    expect(tblFormData.time_range).toBe('2021 : 2022');
  });
});

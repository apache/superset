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
import { buildQueryContext } from '@superset-ui/core';
import * as buildQueryContextModule from '../../src/query/buildQueryContext';
import * as queryModule from '../../src/query/normalizeTimeColumn';
import * as getXAxisModule from '../../src/query/getXAxis';

describe('buildQueryContext', () => {
  it('should build datasource for table sources and apply defaults', () => {
    const queryContext = buildQueryContext({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
  });
  it('should build datasource for table sources with columns', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        granularity_sqla: 'ds',
        viz_type: 'table',
        source: 'source_column',
        source_category: 'source_category_column',
        target: 'target_column',
        target_category: 'target_category_column',
      },
      {
        queryFields: {
          source: 'columns',
          source_category: 'columns',
          target: 'columns',
          target_category: 'columns',
        },
      },
    );
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
    expect(queryContext.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: [
            'source_column',
            'source_category_column',
            'target_column',
            'target_category_column',
          ],
        }),
      ]),
    );
  });
  it('should build datasource for table sources and process with custom function', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        granularity_sqla: 'ds',
        viz_type: 'table',
        source: 'source_column',
        source_category: 'source_category_column',
        target: 'target_column',
        target_category: 'target_category_column',
      },
      function addExtraColumn(queryObject) {
        return [{ ...queryObject, columns: ['dummy_column'] }];
      },
    );
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
    expect(queryContext.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: ['dummy_column'],
        }),
      ]),
    );
  });
  // todo(Yongjie): move these test case into buildQueryObject.test.ts
  it('should remove undefined value in post_processing', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        viz_type: 'table',
      },
      () => [
        {
          post_processing: [
            undefined,
            undefined,
            {
              operation: 'flatten',
            },
            undefined,
          ],
        },
      ],
    );
    expect(queryContext.queries[0].post_processing).toEqual([
      {
        operation: 'flatten',
      },
    ]);
  });
  it('should call normalizeTimeColumn if GENERIC_CHART_AXES is enabled and has x_axis', () => {
    Object.defineProperty(getXAxisModule, 'hasGenericChartAxes', {
      value: true,
    });
    const spyNormalizeTimeColumn = jest.spyOn(
      queryModule,
      'normalizeTimeColumn',
    );

    buildQueryContext(
      {
        datasource: '5__table',
        viz_type: 'table',
        x_axis: 'axis',
      },
      () => [{}],
    );
    expect(spyNormalizeTimeColumn).toBeCalled();
    spyNormalizeTimeColumn.mockRestore();
  });
  it("shouldn't call normalizeTimeColumn if GENERIC_CHART_AXES is disabled", () => {
    Object.defineProperty(getXAxisModule, 'hasGenericChartAxes', {
      value: false,
    });
    const spyNormalizeTimeColumn = jest.spyOn(
      queryModule,
      'normalizeTimeColumn',
    );

    buildQueryContext(
      {
        datasource: '5__table',
        viz_type: 'table',
      },
      () => [{}],
    );
    expect(spyNormalizeTimeColumn).not.toBeCalled();
    spyNormalizeTimeColumn.mockRestore();
  });
  it('should fix pivot v2 charts saved before GENERIC_CHART_AXES was enabled', () => {
    Object.defineProperty(buildQueryContextModule, 'hasGenericChartAxes', {
      value: true,
    });
    const queryContext = buildQueryContext(
      {
        datasource: '22__table',
        viz_type: 'pivot_table_v2',
        slice_id: 138,
        url_params: {
          native_filters_key:
            'oGUUQKLlluSODgWflOlhSKi2dMljuOTbyGVxVlZ8s5xp_nTJpd3rdWram_xNDotb',
        },
        groupbyColumns: ['order_date'],
        groupbyRows: [],
        time_grain_sqla: 'P1M',
        temporal_columns_lookup: {},
        metrics: ['count'],
        metricsLayout: 'COLUMNS',
        adhoc_filters: [],
        row_limit: 10000,
        order_desc: true,
        aggregateFunction: 'Sum',
        valueFormat: 'SMART_NUMBER',
        date_format: 'smart_date',
        rowOrder: 'key_a_to_z',
        colOrder: 'key_a_to_z',
        dashboards: [13],
        extra_form_data: {},
        granularity_sqla: 'order_date',
        time_range: 'No filter',
        label_colors: {},
        shared_label_colors: {},
        extra_filters: [],
        dashboardId: 13,
        force: undefined,
        result_format: 'json',
        result_type: 'full',
      },
      () => [
        {
          annotation_layers: [],
          applied_time_extras: {},
          columns: ['order_date'],
          custom_form_data: {},
          custom_params: {},
          extras: {
            having: '',
            where: '',
          },
          filters: [],
          granularity: 'order_date',
          metrics: ['count'],
          order_desc: true,
          orderby: [['count', false]],
          row_limit: 10000,
          series_limit: 0,
          time_range: 'No filter',
          url_params: {
            native_filters_key:
              'oGUUQKLlluSODgWflOlhSKi2dMljuOTbyGVxVlZ8s5xp_nTJpd3rdWram_xNDotb',
          },
        },
      ],
    );
    expect(queryContext).toEqual({
      datasource: {
        id: 22,
        type: 'table',
      },
      force: false,
      queries: [
        {
          time_range: 'No filter',
          granularity: 'order_date',
          filters: [
            {
              col: 'order_date',
              op: 'TEMPORAL_RANGE',
              val: 'No filter',
            },
          ],
          extras: {
            having: '',
            where: '',
          },
          applied_time_extras: {},
          columns: [
            {
              columnType: 'BASE_AXIS',
              expressionType: 'SQL',
              label: 'order_date',
              sqlExpression: 'order_date',
              timeGrain: 'P1M',
            },
          ],
          metrics: ['count'],
          orderby: [['count', false]],
          annotation_layers: [],
          row_limit: 10000,
          series_limit: 0,
          order_desc: true,
          url_params: {
            native_filters_key:
              'oGUUQKLlluSODgWflOlhSKi2dMljuOTbyGVxVlZ8s5xp_nTJpd3rdWram_xNDotb',
          },
          custom_params: {},
          custom_form_data: {},
        },
      ],
      form_data: {
        datasource: '22__table',
        viz_type: 'pivot_table_v2',
        slice_id: 138,
        url_params: {
          native_filters_key:
            'oGUUQKLlluSODgWflOlhSKi2dMljuOTbyGVxVlZ8s5xp_nTJpd3rdWram_xNDotb',
        },
        groupbyColumns: ['order_date'],
        groupbyRows: [],
        time_grain_sqla: 'P1M',
        temporal_columns_lookup: {},
        metrics: ['count'],
        metricsLayout: 'COLUMNS',
        adhoc_filters: [],
        row_limit: 10000,
        order_desc: true,
        aggregateFunction: 'Sum',
        valueFormat: 'SMART_NUMBER',
        date_format: 'smart_date',
        rowOrder: 'key_a_to_z',
        colOrder: 'key_a_to_z',
        dashboards: [13],
        extra_form_data: {},
        granularity_sqla: 'order_date',
        time_range: 'No filter',
        label_colors: {},
        shared_label_colors: {},
        extra_filters: [],
        dashboardId: 13,
        force: null,
        result_format: 'json',
        result_type: 'full',
      },
      result_format: 'json',
      result_type: 'full',
    });
  });
});

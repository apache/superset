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
import { cloneDeep } from 'lodash-es';
import {
  getChartBuildQueryRegistry,
  JsonObject,
  QueryFormData,
  QueryMode,
} from '@superset-ui/core';
import { cachedBuildQuery as createTableQuery } from '../../../plugins/plugin-chart-table/src/buildQuery';
import { cachedBuildQuery as createAgGridQuery } from '../../../plugins/plugin-chart-ag-grid-table/src/buildQuery';
import { buildChartDataExportPayload, buildV1ChartDataPayload } from '.';

const resultTypes = ['full', 'post_processed'] as const;
const paginatedCases = [
  { plugin: 'Table', createBuildQuery: createTableQuery },
  { plugin: 'AG Grid', createBuildQuery: createAgGridQuery },
].flatMap(plugin => resultTypes.map(resultType => ({ ...plugin, resultType })));

test.each(paginatedCases)(
  '$plugin $resultType export plans every configured row instead of the current page',
  async ({ plugin, createBuildQuery, resultType }) => {
    const viz = `extension_export_${plugin}_${resultType}`;
    const registry = getChartBuildQueryRegistry();
    registry.registerValue(viz, createBuildQuery());
    const formData: QueryFormData = {
      viz_type: viz,
      datasource: '11__table',
      slice_id: 17,
      query_mode: QueryMode.Aggregate,
      groupby: ['state'],
      metrics: ['count'],
      server_pagination: true,
      server_page_length: 20,
      row_limit: 1000,
      result_format: 'json',
      result_type: resultType,
      extra_form_data: {
        filters: [{ col: 'country', op: 'IN', val: ['CA'] }],
      },
    };
    const ownState: JsonObject = {
      currentPage: 2,
      pageSize: 20,
      sortBy: [{ key: 'state', desc: false }],
    };
    const originalFormData = cloneDeep(formData);
    const originalOwnState = cloneDeep(ownState);

    try {
      const payload = await buildChartDataExportPayload({
        formData,
        resultType,
        ownState,
      });
      const nativeCsv = await buildV1ChartDataPayload({
        formData,
        resultType,
        resultFormat: 'csv',
        ownState,
      });

      expect(payload.queries).toEqual(nativeCsv.queries);
      expect(payload.queries).toHaveLength(1);
      expect(payload.queries[0]).toMatchObject({
        row_limit: 1000,
        row_offset: 0,
        columns: ['state'],
      });
      expect(payload.queries[0].orderby?.[0]).toEqual(['state', true]);
      expect(payload.queries[0].filters).toContainEqual(
        expect.objectContaining({
          col: 'country',
          op: 'IN',
          val: ['CA'],
        }),
      );
      expect(payload.queries.some(query => query.is_rowcount)).toBe(false);
      expect(payload.result_format).toBe('json');
      expect(payload.result_type).toBe(resultType);
      expect(payload.form_data).toMatchObject({
        result_format: 'json',
        result_type: resultType,
      });
      expect(nativeCsv.result_format).toBe('csv');
      expect(nativeCsv.form_data?.result_format).toBe('csv');
      expect(formData).toEqual(originalFormData);
      expect(ownState).toEqual(originalOwnState);
    } finally {
      registry.remove(viz);
    }
  },
);

test.each(resultTypes)(
  'Table %s export keeps the configured limit when cached native filters change',
  async resultType => {
    const viz = `extension_export_table_changed_filters_${resultType}`;
    const registry = getChartBuildQueryRegistry();
    registry.registerValue(viz, createTableQuery());
    const formData: QueryFormData = {
      viz_type: viz,
      datasource: '11__table',
      slice_id: 17,
      query_mode: QueryMode.Aggregate,
      groupby: ['state'],
      metrics: ['count'],
      server_pagination: true,
      server_page_length: 20,
      row_limit: 1000,
      extra_form_data: {
        filters: [{ col: 'country', op: 'IN', val: ['CA'] }],
      },
    };
    const ownState: JsonObject = { currentPage: 2, pageSize: 20 };
    const filteredFormData: QueryFormData = {
      ...formData,
      extra_form_data: {
        filters: [{ col: 'country', op: 'IN', val: ['US'] }],
      },
    };
    const originalFormData = cloneDeep(filteredFormData);
    const originalOwnState = cloneDeep(ownState);

    try {
      await buildV1ChartDataPayload({
        formData,
        resultFormat: 'json',
        resultType: 'full',
        ownState,
      });
      const payload = await buildChartDataExportPayload({
        formData: filteredFormData,
        resultType,
        ownState,
      });
      const nativeCsv = await buildV1ChartDataPayload({
        formData: filteredFormData,
        resultFormat: 'csv',
        resultType,
        ownState,
      });

      expect(payload.queries).toEqual(nativeCsv.queries);
      expect(payload.queries).toHaveLength(1);
      expect(payload.queries[0]).toMatchObject({
        row_limit: 1000,
        row_offset: 0,
      });
      expect(payload.queries[0].filters).toContainEqual(
        expect.objectContaining({ col: 'country', op: 'IN', val: ['US'] }),
      );
      expect(payload.queries.some(query => query.is_rowcount)).toBe(false);
      expect(payload.result_format).toBe('json');
      expect(payload.result_type).toBe(resultType);
      expect(filteredFormData).toEqual(originalFormData);
      expect(ownState).toEqual(originalOwnState);
    } finally {
      registry.remove(viz);
    }
  },
);

test('AG Grid export keeps native CSV header filters, column order and sorting in client mode', async () => {
  const viz = 'extension_export_ag_grid_client_state';
  const registry = getChartBuildQueryRegistry();
  registry.registerValue(viz, createAgGridQuery());
  const formData: QueryFormData = {
    viz_type: viz,
    datasource: '11__table',
    query_mode: QueryMode.Raw,
    all_columns: ['Destination Address Street', 'Destination Address State'],
    server_pagination: false,
    row_limit: 1000,
    result_format: 'json',
  };
  const ownState: JsonObject = {
    columnOrder: ['Destination Address State', 'Destination Address Street'],
    sortModel: [{ colId: 'Destination Address Street', sort: 'asc' }],
    filters: [{ col: 'Destination Address State', op: 'IN', val: ['CA'] }],
    agGridFilterModel: {
      'Destination Address Street': {
        filterType: 'text',
        type: 'contains',
        filter: 'Main',
      },
    },
  };
  const originalFormData = cloneDeep(formData);
  const originalOwnState = cloneDeep(ownState);

  try {
    const payload = await buildChartDataExportPayload({
      formData,
      resultType: 'full',
      ownState,
    });
    const nativeCsv = await buildV1ChartDataPayload({
      formData,
      resultFormat: 'csv',
      resultType: 'full',
      ownState,
    });
    const [query] = payload.queries;

    expect(payload.queries).toEqual(nativeCsv.queries);
    expect(query.columns).toEqual([
      'Destination Address State',
      'Destination Address Street',
    ]);
    expect(query.extras).toMatchObject({ column_order: ownState.columnOrder });
    expect(query.orderby?.[0]).toEqual(['Destination Address Street', true]);
    expect(query.filters).toEqual(
      expect.arrayContaining([
        { col: 'Destination Address State', op: 'IN', val: ['CA'] },
        { col: 'Destination Address Street', op: 'ILIKE', val: '%Main%' },
      ]),
    );
    expect(query.extras?.where || undefined).toBeUndefined();
    expect(payload.result_format).toBe('json');
    expect(payload.result_type).toBe('full');
    expect(payload.form_data?.result_format).toBe('json');
    expect(formData).toEqual(originalFormData);
    expect(ownState).toEqual(originalOwnState);
  } finally {
    registry.remove(viz);
  }
});

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
import { GenericDataType } from '@apache-superset/core/common';
import { VizType } from '@superset-ui/core';

/**
 * Dashboard datasource entries shaped like the `GET /api/v1/dashboard/<id>/datasets`
 * payload that the dashboard stores in Redux, keyed by `uid`.
 *
 * Semantic views follow `SemanticView.data` as serialized by
 * `DashboardRestApi._serialize_dashboard_dataset` (pinned by
 * `tests/unit_tests/dashboards/datasets_test.py`): `uid` is
 * `<id>__semantic_view`, `type` is `semantic_view`, `name` and `table_name`
 * both carry the view's name, `column_types` follows its dimensions and
 * `database` is empty. Datasets and semantic views have
 * independent id sequences, so the same numeric id can name one of each.
 */
export interface MockDashboardColumn {
  column_name: string;
  verbose_name: string | null;
  filterable: boolean;
  groupby: boolean;
  is_dttm: boolean;
  type: string;
  type_generic: GenericDataType;
  expression: string | null;
}

export interface MockDashboardDatasource {
  id: number;
  uid: string;
  type: 'semantic_view' | 'table';
  name: string;
  table_name?: string;
  columns: MockDashboardColumn[];
  metrics: { metric_name: string; expression: string }[];
  database: Record<string, unknown>;
  schema?: string;
  column_types?: GenericDataType[];
  semantic_selection_version?: string | null;
}

export interface MockDashboardChart {
  id: number;
  form_data: { datasource: string; viz_type: string; slice_id: number };
}

const column = (
  name: string,
  type: string,
  typeGeneric: GenericDataType,
): MockDashboardColumn => ({
  column_name: name,
  verbose_name: null,
  filterable: true,
  groupby: true,
  is_dttm: typeGeneric === GenericDataType.Temporal,
  type,
  type_generic: typeGeneric,
  expression: null,
});

export const semanticViewDimensions = [
  { name: 'Orders.amount', type: 'double', definition: 'amount' },
  { name: 'Orders.created_at', type: 'timestamp[us]', definition: 'created' },
  { name: 'Orders.status', type: 'string', definition: 'status' },
];

const dimensionTypes: Record<string, GenericDataType> = {
  double: GenericDataType.Numeric,
  'timestamp[us]': GenericDataType.Temporal,
  string: GenericDataType.String,
};

export const semanticViewEntry = (
  id: number,
  name = 'Orders View',
): MockDashboardDatasource => {
  const columns = semanticViewDimensions.map(dimension =>
    column(dimension.name, dimension.type, dimensionTypes[dimension.type]),
  );
  return {
    id,
    uid: `${id}__semantic_view`,
    type: 'semantic_view',
    name,
    table_name: name,
    columns,
    column_types: columns.map(({ type_generic }) => type_generic),
    metrics: [{ metric_name: 'Orders.count', expression: 'count' }],
    database: {},
    semantic_selection_version: null,
  };
};

export const sqlDatasetEntry = (
  id: number,
  tableName = 'sql_orders',
): MockDashboardDatasource => ({
  id,
  uid: `${id}__table`,
  type: 'table',
  name: `public.${tableName}`,
  table_name: tableName,
  columns: [
    column('sql_only_column', 'VARCHAR', GenericDataType.String),
    column('sql_ts', 'TIMESTAMP', GenericDataType.Temporal),
  ],
  metrics: [{ metric_name: 'count', expression: 'COUNT(*)' }],
  database: { id: 1, database_name: 'examples' },
  schema: 'public',
  column_types: [GenericDataType.String, GenericDataType.Temporal],
});

/**
 * The `GET /api/v1/dataset/<id>` result for {@link sqlDatasetEntry}, as the
 * filter form's projected details and column requests receive it.
 */
export const sqlDatasetResult = (id: number, tableName = 'sql_orders') => {
  const entry = sqlDatasetEntry(id, tableName);
  return {
    id,
    result: {
      id,
      table_name: tableName,
      schema: entry.schema,
      datasource_type: 'table',
      database: entry.database,
      columns: entry.columns,
      metrics: entry.metrics,
      main_dttm_col: null,
      time_grain_sqla: [],
      filter_select_enabled: true,
      is_sqllab_view: false,
      sql: null,
    },
  };
};

/** Datasources keyed by uid, as the dashboard reducer stores them. */
export const dashboardDatasources = (
  ...entries: MockDashboardDatasource[]
): Record<string, MockDashboardDatasource> =>
  Object.fromEntries(entries.map(entry => [entry.uid, entry]));

/** Charts keyed by id, each bound to a datasource uid. */
export const dashboardCharts = (
  ...datasourceUids: string[]
): Record<number, MockDashboardChart> =>
  Object.fromEntries(
    datasourceUids.map((datasource, index) => {
      const id = 100 + index;
      return [
        id,
        {
          id,
          form_data: { datasource, viz_type: VizType.Table, slice_id: id },
        },
      ];
    }),
  );

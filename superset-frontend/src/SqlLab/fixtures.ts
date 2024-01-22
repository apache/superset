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
import sinon from 'sinon';
import * as actions from 'src/SqlLab/actions/sqlLab';
import { ColumnKeyTypeType } from 'src/SqlLab/components/ColumnElement';
import {
  DatasourceType,
  denormalizeTimestamp,
  GenericDataType,
  QueryResponse,
  QueryState,
} from '@superset-ui/core';
import { LatestQueryEditorVersion } from 'src/SqlLab/types';
import { ISaveableDatasource } from 'src/SqlLab/components/SaveDatasetModal';

export const mockedActions = sinon.stub({ ...actions });

export const alert = { bsStyle: 'danger', msg: 'Ooops', id: 'lksvmcx32' };
export const table = {
  dbId: 1,
  selectStar: 'SELECT * FROM ab_user',
  queryEditorId: 'rJ-KP47a',
  schema: 'superset',
  name: 'ab_user',
  id: 'r11Vgt60',
  dataPreviewQueryId: null,
  partitions: {
    cols: ['username'],
    latest: 'bob',
    partitionQuery: 'SHOW PARTITIONS FROM ab_user',
  },
  indexes: [
    {
      unique: true,
      column_names: ['username'],
      type: 'UNIQUE',
      name: 'username',
    },
    {
      unique: true,
      column_names: ['email'],
      type: 'UNIQUE',
      name: 'email',
    },
    {
      unique: false,
      column_names: ['created_by_fk'],
      name: 'created_by_fk',
    },
    {
      unique: false,
      column_names: ['changed_by_fk'],
      name: 'changed_by_fk',
    },
  ],
  columns: [
    {
      indexed: false,
      longType: 'INTEGER(11)',
      type: 'INTEGER',
      name: 'id',
      keys: [
        {
          column_names: ['id'],
          type: 'pk' as ColumnKeyTypeType,
          name: null,
        },
      ],
    },
    {
      indexed: false,
      longType: 'VARCHAR(64)',
      type: 'VARCHAR',
      name: 'first_name',
      keys: [
        {
          column_names: ['first_name'],
          name: 'slices_ibfk_1',
          referred_columns: ['id'],
          referred_table: 'datasources',
          type: 'fk' as ColumnKeyTypeType,
          referred_schema: 'carapal',
          options: {},
        },
        {
          unique: false,
          column_names: ['druid_datasource_id'],
          type: 'index' as ColumnKeyTypeType,
          name: 'druid_datasource_id',
        },
      ],
    },
    {
      indexed: false,
      longType: 'VARCHAR(64)',
      type: 'VARCHAR',
      name: 'last_name',
    },
    {
      indexed: true,
      longType: 'VARCHAR(64)',
      type: 'VARCHAR',
      name: 'username',
    },
    {
      indexed: false,
      longType: 'VARCHAR(256)',
      type: 'VARCHAR',
      name: 'password',
    },
    {
      indexed: false,
      longType: 'TINYINT(1)',
      type: 'TINYINT',
      name: 'active',
    },
    {
      indexed: true,
      longType: 'VARCHAR(64)',
      type: 'VARCHAR',
      name: 'email',
    },
    {
      indexed: false,
      longType: 'DATETIME',
      type: 'DATETIME',
      name: 'last_login',
    },
    {
      indexed: false,
      longType: 'INTEGER(11)',
      type: 'INTEGER',
      name: 'login_count',
    },
    {
      indexed: false,
      longType: 'INTEGER(11)',
      type: 'INTEGER',
      name: 'fail_login_count',
    },
    {
      indexed: false,
      longType: 'DATETIME',
      type: 'DATETIME',
      name: 'created_on',
    },
    {
      indexed: false,
      longType: 'DATETIME',
      type: 'DATETIME',
      name: 'changed_on',
    },
    {
      indexed: true,
      longType: 'INTEGER(11)',
      type: 'INTEGER',
      name: 'created_by_fk',
    },
    {
      indexed: true,
      longType: 'INTEGER(11)',
      type: 'INTEGER',
      name: 'changed_by_fk',
    },
  ],
  expanded: true,
};

export const defaultQueryEditor = {
  version: LatestQueryEditorVersion,
  id: 'dfsadfs',
  autorun: false,
  dbId: undefined,
  latestQueryId: null,
  selectedText: undefined,
  sql: 'SELECT *\nFROM\nWHERE',
  name: 'Untitled Query 1',
  schema: 'main',
  remoteId: null,
  hideLeftBar: false,
  templateParams: '{}',
};

export const extraQueryEditor1 = {
  ...defaultQueryEditor,
  id: 'diekd23',
  sql: 'SELECT *\nFROM\nWHERE\nLIMIT',
  name: 'Untitled Query 2',
  selectedText: 'SELECT',
};

export const extraQueryEditor2 = {
  ...defaultQueryEditor,
  id: 'owkdi998',
  sql: 'SELECT *\nFROM\nWHERE\nGROUP BY',
  name: 'Untitled Query 3',
};

export const queries = [
  {
    dbId: 1,
    sql: 'SELECT * FROM superset.slices',
    sqlEditorId: 'SJ8YO72R',
    tab: 'Demo',
    runAsync: false,
    ctas: false,
    cached: false,
    id: 'BkA1CLrJg',
    progress: 100,
    startDttm: 1476910566092.96,
    state: QueryState.SUCCESS,
    tempTable: null,
    userId: 1,
    executedSql: null,
    changed_on: '2016-10-19T20:56:06',
    rows: 42,
    queryLimit: 100,
    endDttm: 1476910566798,
    limit_reached: false,
    schema: 'test_schema',
    errorMessage: null,
    db: 'main',
    user: 'admin',
    limit: 1000,
    serverId: 141,
    resultsKey: null,
    results: {
      columns: [
        {
          is_dttm: true,
          column_name: 'ds',
          type: 'STRING',
        },
        {
          is_dttm: false,
          column_name: 'gender',
          type: 'STRING',
        },
      ],
      selected_columns: [
        {
          is_dttm: true,
          column_name: 'ds',
          type: 'STRING',
        },
        {
          is_dttm: false,
          column_name: 'gender',
          type: 'STRING',
        },
      ],
      data: [
        { col1: 0, col2: 1 },
        { col1: 2, col2: 3 },
      ],
    },
  },
  {
    dbId: 1,
    sql: 'SELECT *FROM superset.slices',
    sqlEditorId: 'SJ8YO72R',
    tab: 'Demo',
    runAsync: true,
    ctas: false,
    cached: false,
    id: 'S1zeAISkx',
    progress: 100,
    startDttm: 1476910570802.2,
    state: QueryState.SUCCESS,
    tempTable: null,
    userId: 1,
    executedSql:
      'SELECT * \nFROM (SELECT created_on, changed_on, id, slice_name, ' +
      'druid_datasource_id, table_id, datasource_type, datasource_name, ' +
      'viz_type, params, created_by_fk, changed_by_fk, description, ' +
      'cache_timeout, perm\nFROM superset.slices) AS inner_qry \n LIMIT 1000',
    changed_on: '2016-10-19T20:56:12',
    rows: 42,
    endDttm: 1476910579693,
    limit_reached: false,
    schema: null,
    errorMessage: null,
    db: 'main',
    user: 'admin',
    limit: 1000,
    serverId: 142,
    resultsKey: '417149f4-cd27-4f80-91f3-c45c871003f7',
    results: null,
  },
];
export const queryWithNoQueryLimit = {
  dbId: 1,
  sql: 'SELECT * FROM superset.slices',
  sqlEditorId: 'SJ8YO72R',
  tab: 'Demo',
  runAsync: false,
  ctas: false,
  cached: false,
  id: 'BkA1CLrJg',
  progress: 100,
  startDttm: 1476910566092.96,
  state: QueryState.SUCCESS,
  tempTable: null,
  userId: 1,
  executedSql: null,
  changed_on: '2016-10-19T20:56:06',
  rows: 42,
  endDttm: 1476910566798,
  limit_reached: false,
  schema: 'test_schema',
  errorMessage: null,
  db: 'main',
  user: 'admin',
  limit: 1000,
  serverId: 141,
  resultsKey: null,
  results: {
    columns: [
      {
        is_dttm: true,
        column_name: 'ds',
        type: 'STRING',
      },
      {
        is_dttm: false,
        name: 'gender',
        type: 'STRING',
      },
    ],
    selected_columns: [
      {
        is_dttm: true,
        column_name: 'ds',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: 'gender',
        type: 'STRING',
      },
    ],
    data: [
      { col1: 0, col2: 1 },
      { col1: 2, col2: 3 },
    ],
    query: {
      limit: 100,
    },
  },
};

export const queryWithBadColumns = {
  ...queries[0],
  results: {
    data: queries[0].results?.data,
    selected_columns: [
      {
        is_dttm: true,
        column_name: 'COUNT(*)',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: 'this_col_is_ok',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: 'a',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: '1',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: '123',
        type: 'STRING',
      },
      {
        is_dttm: false,
        column_name: 'CASE WHEN 1=1 THEN 1 ELSE 0 END',
        type: 'STRING',
      },
      {
        is_dttm: true,
        column_name: '_TIMESTAMP',
        type: 'TIMESTAMP',
      },
      {
        is_dttm: true,
        column_name: '__TIME',
        type: 'TIMESTAMP',
      },
      {
        is_dttm: false,
        column_name: 'my_dupe_col__2',
        type: 'STRING',
      },
      {
        is_dttm: true,
        column_name: '__timestamp',
        type: 'TIMESTAMP',
      },
      {
        is_dttm: true,
        column_name: '__TIMESTAMP',
        type: 'TIMESTAMP',
      },
    ],
  },
};

export const databases = {
  result: [
    {
      allow_ctas: true,
      allow_dml: true,
      allow_run_async: false,
      database_name: 'main',
      expose_in_sqllab: true,
      force_ctas_schema: '',
      id: 1,
    },
    {
      allow_ctas: true,
      allow_dml: false,
      allow_run_async: true,
      database_name: 'Presto - Gold',
      expose_in_sqllab: true,
      force_ctas_schema: 'tmp',
      id: 208,
    },
  ],
};

export const tables = {
  options: [
    {
      value: 'birth_names',
      schema: 'main',
      label: 'birth_names',
      title: 'birth_names',
    },
    {
      value: 'energy_usage',
      schema: 'main',
      label: 'energy_usage',
      title: 'energy_usage',
    },
    {
      value: 'wb_health_population',
      schema: 'main',
      label: 'wb_health_population',
      title: 'wb_health_population',
    },
  ],
};

export const stoppedQuery = {
  dbId: 1,
  cached: false,
  ctas: false,
  id: 'ryhMUZCGb',
  progress: 0,
  results: [],
  runAsync: false,
  schema: 'main',
  sql: 'SELECT ...',
  sqlEditorId: 'rJaf5u9WZ',
  startDttm: 1497400851936,
  state: QueryState.STOPPED,
  tab: 'Untitled Query 2',
  tempTable: '',
};

export const failedQueryWithErrorMessage = {
  dbId: 1,
  cached: false,
  ctas: false,
  errorMessage: 'Something went wrong',
  id: 'ryhMUZCGb',
  progress: 0,
  results: [],
  runAsync: false,
  schema: 'main',
  sql: 'SELECT ...',
  sqlEditorId: 'rJaf5u9WZ',
  startDttm: 1497400851936,
  state: QueryState.FAILED,
  tab: 'Untitled Query 2',
  tempTable: '',
};

export const failedQueryWithErrors = {
  dbId: 1,
  cached: false,
  ctas: false,
  errors: [
    {
      message: 'Something went wrong',
      error_type: 'TEST_ERROR',
      level: 'error',
      extra: null,
    },
  ],
  id: 'ryhMUZCGb',
  progress: 0,
  results: [],
  runAsync: false,
  schema: 'main',
  sql: 'SELECT ...',
  sqlEditorId: 'rJaf5u9WZ',
  startDttm: 1497400851936,
  state: QueryState.FAILED,
  tab: 'Untitled Query 2',
  tempTable: '',
};

const baseQuery: QueryResponse = {
  queryId: 567,
  dbId: 1,
  sql: 'SELECT * FROM superset.slices',
  sqlEditorId: 'SJ8YO72R',
  tab: 'Demo',
  ctas: false,
  cached: false,
  id: 'BkA1CLrJg',
  progress: 100,
  startDttm: 1476910566092.96,
  state: QueryState.SUCCESS,
  tempSchema: null,
  tempTable: 'temp',
  userId: 1,
  executedSql: 'SELECT * FROM superset.slices',
  rows: 42,
  started: 'started',
  queryLimit: 100,
  endDttm: 1476910566798,
  schema: 'test_schema',
  errorMessage: null,
  db: { key: 'main' },
  user: { key: 'admin' },
  isDataPreview: false,
  resultsKey: null,
  trackingUrl: null,
  templateParams: null,
  limitingFactor: 'capacity',
  duration: '2334645675467',
  time: { key: 'value' },
  querylink: { key: 'value' },
  output: { key: 'value' },
  actions: { key: 'value' },
  extra: {
    progress: null,
  },
  columns: [],
  type: DatasourceType.Query,
  results: {
    displayLimitReached: false,
    query: { limit: 6 },
    columns: [
      {
        is_dttm: true,
        column_name: 'ds',
        type: 'STRING',
        type_generic: GenericDataType.STRING,
      },
      {
        is_dttm: false,
        column_name: 'gender',
        type: 'STRING',
        type_generic: GenericDataType.STRING,
      },
    ],
    selected_columns: [
      {
        is_dttm: true,
        column_name: 'ds',
        type: 'STRING',
        type_generic: GenericDataType.TEMPORAL,
      },
      {
        is_dttm: false,
        column_name: 'gender',
        type: 'STRING',
        type_generic: GenericDataType.STRING,
      },
    ],
    expanded_columns: [
      {
        is_dttm: true,
        column_name: 'ds',
        type: 'STRING',
        type_generic: GenericDataType.STRING,
      },
    ],
    data: [
      { col1: '0', col2: '1' },
      { col1: '2', col2: '3' },
    ],
  },
};

export const runningQuery: QueryResponse = {
  ...baseQuery,
  dbId: 1,
  cached: false,
  ctas: false,
  id: 'ryhMUZCGb',
  progress: 90,
  state: QueryState.RUNNING,
  startDttm: Date.now() - 500,
};

export const successfulQuery: QueryResponse = {
  ...baseQuery,
  dbId: 1,
  cached: false,
  ctas: false,
  id: 'ryhMUZCGb',
  progress: 100,
  state: QueryState.SUCCESS,
  startDttm: Date.now() - 500,
};

export const cachedQuery = { ...queries[0], cached: true };

export const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: Array(173) },
  userId: 1,
  username: 'admin',
};

export const initialState = {
  sqlLab: {
    offline: false,
    alerts: [],
    queries: {},
    databases: {},
    queryEditors: [defaultQueryEditor, extraQueryEditor1, extraQueryEditor2],
    tabHistory: [defaultQueryEditor.id],
    tables: [],
    workspaceQueries: [],
    queriesLastUpdate: 0,
    activeSouthPaneTab: 'Results',
    unsavedQueryEditor: {},
  },
  messageToasts: [],
  user,
  common: {
    conf: {
      DEFAULT_SQLLAB_LIMIT: 1000,
      SQL_MAX_ROW: 100000,
      DISPLAY_MAX_ROW: 100,
      SQLALCHEMY_DOCS_URL: 'test_SQLALCHEMY_DOCS_URL',
      SQLALCHEMY_DISPLAY_TEXT: 'test_SQLALCHEMY_DISPLAY_TEXT',
    },
  },
};

export const query = {
  name: 'test query',
  dbId: 1,
  sql: 'SELECT * FROM something',
  description: 'test description',
  schema: 'test schema',
  resultsKey: 'test',
};

export const queryId = 'clientId2353';

export const testQuery: ISaveableDatasource = {
  name: 'unimportant',
  dbId: 1,
  schema: 'main',
  sql: 'SELECT *',
  columns: [
    {
      column_name: 'Column 1',
      type: DatasourceType.Query,
      is_dttm: false,
    },
    {
      column_name: 'Column 3',
      type: DatasourceType.Query,
      is_dttm: false,
    },
    {
      column_name: 'Column 2',
      type: DatasourceType.Query,
      is_dttm: true,
    },
  ],
};

export const mockdatasets = [...new Array(3)].map((_, i) => ({
  changed_by_name: 'user',
  kind: i === 0 ? 'virtual' : 'physical', // ensure there is 1 virtual
  changed_by: 'user',
  changed_on: denormalizeTimestamp(new Date().toISOString()),
  database_name: `db ${i}`,
  explore_url: `/explore/?datasource_type=table&datasource_id=${i}`,
  id: i,
  schema: `schema ${i}`,
  table_name: `coolest table ${i}`,
  owners: [{ username: 'admin', userId: 1 }],
}));

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
  id: 'dfsadfs',
  autorun: false,
  dbId: null,
  latestQueryId: null,
  selectedText: null,
  sql: 'SELECT *\nFROM\nWHERE',
  title: 'Untitled Query',
  schemaOptions: [
    {
      value: 'main',
      label: 'main',
      title: 'main',
    },
  ],
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
    state: 'success',
    changedOn: 1476910566000,
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
          is_date: true,
          name: 'ds',
          type: 'STRING',
        },
        {
          is_date: false,
          name: 'gender',
          type: 'STRING',
        },
      ],
      selected_columns: [
        {
          is_date: true,
          name: 'ds',
          type: 'STRING',
        },
        {
          is_date: false,
          name: 'gender',
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
    state: 'success',
    changedOn: 1476910572000,
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
export const queryWithBadColumns = {
  ...queries[0],
  results: {
    data: queries[0].results?.data,
    selected_columns: [
      {
        is_date: true,
        name: 'COUNT(*)',
        type: 'STRING',
      },
      {
        is_date: false,
        name: 'this_col_is_ok',
        type: 'STRING',
      },
      {
        is_date: false,
        name: 'a',
        type: 'STRING',
      },
      {
        is_date: false,
        name: '1',
        type: 'STRING',
      },
      {
        is_date: false,
        name: '123',
        type: 'STRING',
      },
      {
        is_date: false,
        name: 'CASE WHEN 1=1 THEN 1 ELSE 0 END',
        type: 'STRING',
      },
      {
        is_date: true,
        name: '_TIMESTAMP',
        type: 'TIMESTAMP',
      },
      {
        is_date: true,
        name: '__TIME',
        type: 'TIMESTAMP',
      },
      {
        is_date: true,
        name: '__TIMESTAMP',
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
  state: 'stopped',
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
  state: 'failed',
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
  state: 'failed',
  tab: 'Untitled Query 2',
  tempTable: '',
};

export const runningQuery = {
  dbId: 1,
  cached: false,
  ctas: false,
  id: 'ryhMUZCGb',
  progress: 90,
  state: 'running',
  startDttm: Date.now() - 500,
};
export const cachedQuery = { ...queries[0], cached: true };

export const initialState = {
  sqlLab: {
    offline: false,
    alerts: [],
    queries: {},
    databases: {},
    queryEditors: [defaultQueryEditor],
    tabHistory: [defaultQueryEditor.id],
    tables: [],
    workspaceQueries: [],
    queriesLastUpdate: 0,
    activeSouthPaneTab: 'Results',
  },
  messageToasts: [],
  common: {
    conf: {
      DEFAULT_SQLLAB_LIMIT: 1000,
      SQL_MAX_ROW: 100000,
    },
  },
};

export const query = {
  id: 'clientId2353',
  dbId: 1,
  sql: 'SELECT * FROM something',
  sqlEditorId: defaultQueryEditor.id,
  tab: 'unimportant',
  tempTable: null,
  runAsync: false,
  ctas: false,
  cached: false,
};

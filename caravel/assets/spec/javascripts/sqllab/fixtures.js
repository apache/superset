import * as actions from '../../../javascripts/SqlLab/actions';
import sinon from 'sinon';

export const mockedActions = sinon.stub(Object.assign({}, actions));

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
      column_names: [
        'username',
      ],
      type: 'UNIQUE',
      name: 'username',
    },
    {
      unique: true,
      column_names: [
        'email',
      ],
      type: 'UNIQUE',
      name: 'email',
    },
    {
      unique: false,
      column_names: [
        'created_by_fk',
      ],
      name: 'created_by_fk',
    },
    {
      unique: false,
      column_names: [
        'changed_by_fk',
      ],
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
          type: 'pk',
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
          column_names: [
            'first_name',
          ],
          name: 'slices_ibfk_1',
          referred_columns: [
            'id',
          ],
          referred_table: 'datasources',
          type: 'fk',
          referred_schema: 'carapal',
          options: {},
        },
        {
          unique: false,
          column_names: [
            'druid_datasource_id',
          ],
          type: 'index',
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
};
export const queries = [
  {
    dbId: 1,
    sql: 'SELECT *FROM superset.slices',
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
    schema: null,
    errorMessage: null,
    db: 'main',
    user: 'admin',
    limit: 1000,
    serverId: 141,
    resultsKey: null,
    results: {
      columns: ['col1', 'col2'],
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
    executedSql: (
      'SELECT * \nFROM (SELECT created_on, changed_on, id, slice_name, ' +
      'druid_datasource_id, table_id, datasource_type, datasource_name, ' +
      'viz_type, params, created_by_fk, changed_by_fk, description, ' +
      'cache_timeout, perm\nFROM superset.slices) AS inner_qry \n LIMIT 1000'
    ),
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

export const initialState = {
  alerts: [],
  networkOn: true,
  queries: {},
  databases: {},
  queryEditors: [defaultQueryEditor],
  tabHistory: [defaultQueryEditor.id],
  tables: [],
  workspaceQueries: [],
  queriesLastUpdate: 0,
  activeSouthPaneTab: 'Results',
};

export const query = {
  dbId: 1,
  sql: 'SELECT * FROM something',
  sqlEditorId: defaultQueryEditor.id,
  tab: 'unimportant',
  tempTableName: null,
  runAsync: false,
  ctas: false,
  cached: false,
};

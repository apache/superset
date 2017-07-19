import QuerySettingsStore from '../../../../javascripts/swivel/stores/QuerySettingsStore';
import ColumnTypes from '../../../../javascripts/swivel/ColumnTypes';

export const QUERY_SETTINGS = new QuerySettingsStore({
  filters: [
    { id: 'ds',
      name: 'ds',
      columnType: 'TIMESTAMP',
      groupable: false,
      intervalStart: '100 years ago',
      intervalEnd: 'now',
    }],
  splits: [
    { name: 'ds',
      id: 'ds',
      columnType: 'TIMESTAMP',
      groupable: false,
      granularity: 'month',
    }],
  metrics: { count: true, avg__num: true },
  vizType: 'line',
  limit: 5,
  orderBy: 'avg__num',
  orderDesc: true,
});

export const QUERY_SETTINGS_FILTERS = [
  {
    id: 'equal_num',
    name: 'equal_num',
    columnType: ColumnTypes.NUMERIC,
    groupable: true,
    filter: [
      '1',
    ],
    invert: false,
    like: false,
  },
  {
    id: 'not_equal_num',
    name: 'not_equal_num',
    columnType: ColumnTypes.NUMERIC,
    groupable: true,
    filter: [
      '1',
    ],
    invert: true,
    like: false,
  },
  {
    id: 'equal_str',
    name: 'equal_str',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'boy',
    ],
    invert: false,
    like: false,
  },
  {
    id: 'not_equal_str',
    name: 'not_equal_str',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'boy',
    ],
    invert: true,
    like: false,
  },
  {
    id: 'like',
    name: 'like',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'boy',
    ],
    invert: false,
    like: true,
  },
  {
    id: 'not_like',
    name: 'not_like',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'boy',
    ],
    invert: true,
    like: true,
  },
  {
    id: 'in',
    name: 'in',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'Aaron',
      'Dana',
    ],
    invert: false,
  },
  {
    id: 'not_in',
    name: 'not_in',
    columnType: ColumnTypes.STRING,
    groupable: true,
    filter: [
      'Aaron',
      'Dana',
    ],
    invert: true,
  },
  {
    id: 'less_then',
    name: 'less_then',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: false,
    rightOpen: true,
    intervalStart: '',
    intervalEnd: '600',
  },
  {
    id: 'less_eq_then',
    name: 'less_eq_then',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: false,
    rightOpen: false,
    intervalStart: '',
    intervalEnd: '600',
  },
  {
    id: 'greater_then',
    name: 'greater_then',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: true,
    rightOpen: false,
    intervalStart: '500',
    intervalEnd: '',
  },
  {
    id: 'greater_eq_then',
    name: 'greater_eq_then',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: false,
    rightOpen: false,
    intervalStart: '500',
    intervalEnd: '',
  },
  {
    id: 'in_between_open',
    name: 'in_between_open',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: true,
    rightOpen: true,
    intervalStart: '500',
    intervalEnd: '600',
  },
  {
    id: 'in_between_closed',
    name: 'in_between_closed',
    columnType: ColumnTypes.NUMERIC,
    groupable: false,
    leftOpen: false,
    rightOpen: false,
    intervalStart: '500',
    intervalEnd: '600',
  },
];

export const QUERY_SETTINGS_GROUPBYS = [
  {
    name: 'gender',
    id: 'gender',
    columnType: 'NVARCHAR',
    groupable: true,
  },
  {
    name: 'name',
    id: 'name',
    columnType: 'NVARCHAR',
    groupable: true,
  },
];

export const FORM_DATA_TIME = {
  until: 'now',
  since: '100 years ago',
  include_time: true,
};

export const FORM_DATA_GENERAL = {
  order_desc: true,
  limit: 5,
  timeseries_limit_metric: 'avg__num',
  metrics: ['count', 'avg__num'],
  viz_type: 'line',
};

export const FORM_DATA_SQL = {
  ...FORM_DATA_GENERAL,
  ...FORM_DATA_TIME,
  datasource: '3__table',
  granularity_sqla: 'ds',
  time_grain_sqla: 'month',
};

export const FORM_DATA_DRUID = {
  ...FORM_DATA_GENERAL,
  ...FORM_DATA_TIME,
  datasource: '3__druid',
  granularity: 'month',
};

export const FORM_DATA_FILTER_EQUAL_NUM = { col: 'equal_num', op: '==', val: '1' };
export const FORM_DATA_FILTER_NOT_EQUAL_NUM = { col: 'not_equal_num', op: '!=', val: '1' };


export const FORM_DATA_FILTER_EQUAL_STR = { col: 'equal_str', op: '==', val: 'boy' };
export const FORM_DATA_FILTER_NOT_EQUAL_STR = { col: 'not_equal_str', op: '!=', val: 'boy' };

export const FORM_DATA_FILTER_LIKE = { col: 'like', op: 'like', val: 'boy' };
export const FORM_DATA_FILTER_NOT_LIKE = { col: 'not_like', op: 'not like', val: 'boy' };

export const FORM_DATA_FILTER_IN = { col: 'in', op: 'in', val: ['Aaron', 'Dana'] };
export const FORM_DATA_FILTER_NOT_IN = { col: 'not_in', op: 'not in', val: ['Aaron', 'Dana'] };

export const FORM_DATA_FILTER_LESS_THEN = { col: 'less_then', op: '<', val: '600' };
export const FORM_DATA_FILTER_LESS_EQ_THEN = { col: 'less_eq_then', op: '<=', val: '600' };

export const FORM_DATA_FILTER_GREATER_THEN = { col: 'greater_then', op: '>', val: '500' };
export const FORM_DATA_FILTER_GREATER_EQ_THEN = { col: 'greater_eq_then', op: '>=', val: '500' };

export const FORM_DATA_FILTER_REGEX = { col: 'like', op: 'regex', val: 'boy' };

export const FORM_DATA_FILTER_IN_BETWEEN_OPEN = [
  { col: 'in_between_open', op: '>', val: '500' },
  { col: 'in_between_open', op: '<', val: '600' }];
export const FORM_DATA_FILTER_IN_BETWEEN_CLOSED = [
  { col: 'in_between_closed', op: '>=', val: '500' },
  { col: 'in_between_closed', op: '<=', val: '600' }];


export const FORM_DATA_GROUPBY = ['name', 'gender'];

const columns = QUERY_SETTINGS.splits
    .concat(QUERY_SETTINGS_FILTERS)
    .concat(QUERY_SETTINGS_GROUPBYS);

export const REF_DATA = { columns: columns.map(x => ({
  name: x.name,
  id: x.id,
  columnType: x.columnType,
  groupable: !!x.groupable,
})) };


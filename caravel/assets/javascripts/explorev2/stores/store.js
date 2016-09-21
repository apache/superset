const defaultTimeFilter = {
  timeColumn: null,
  timeGrain: null,
  since: null,
  until: null,
};

const defaultGroupBy = {
  groupByColumn: [],
  metrics: [],
};

const defaultSql = {
  where: '',
  having: '',
};

export const initialState = {
  datasources: null,
  datasourceId: null,
  viz: null,
  vizType: null,
  timeFilter: defaultTimeFilter,
  groupBy: defaultGroupBy,
  columns: [],
  orderings: [],
  timeStampFormat: null,
  rowLimit: null,
  searchBox: false,
  SQL: defaultSql,
  filters: [],
};

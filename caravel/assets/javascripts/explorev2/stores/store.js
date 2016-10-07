// TODO: add datasource_type here after druid support is added
export const defaultFormData = {
  sliceId: null,
  vizType: null,
  timeColumn: null,
  timeGrain: null,
  groupByColumns: [],
  metrics: [],
  since: null,
  until: null,
  having: null,
  where: null,
  columns: [],
  orderings: [],
  timeStampFormat: 'smart_date',
  rowLimit: 50000,
  searchBox: false,
  whereClause: '',
  havingClause: '',
  filters: [],
};

export const initialState = {
  datasources: null,
  datasourceId: null,
  datasourceType: null,
  timeColumnOpts: [],
  timeGrainOpts: [],
  timeGrain: null,
  groupByColumnOpts: [],
  metricsOpts: [],
  columnOpts: [],
  orderingOpts: [],
  searchBox: false,
  whereClause: '',
  havingClause: '',
  filters: [],
  filterColumnOpts: [],
  viz: {
    formData: defaultFormData,
  },
};

export const defaultOpts = {
  timeColumnOpts: [],
  timeGrainOpts: [],
  groupByColumnOpts: [],
  metricsOpts: [],
  filterColumnOpts: [],
  columnOpts: [],
  orderingOpts: [],
};

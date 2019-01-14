import FormData, { getGranularity } from './FormData';
import Metric, { Metrics } from './Metric';

const DTTM_ALIAS = '__timestamp';

// TODO: fill out the rest of the query object: filter
export interface QueryObject {
  granularity: string;
  groupby: string[];
  metrics: Metric[];
  extras: any;
  timeseries_limit: number;
  timeseries_limit_metric: Metric;
  time_range: string;
  since: string;
  until: string;
  row_limit: number;
  order_desc: boolean;
  is_timeseries: boolean;
  prequeries: any[];
  is_prequery: boolean;
}

// Build the  common segments of all query objects (e.g. the granularity field derived from
// either sql alchemy or druid). The segments specific to each viz type is constructed in the
// buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
// Note the type of the formData argument passed in here is the type of the formData for a
// specific viz, which is a subtype of the generic formData shared among all viz types.
export default function buildQueryObject<T extends FormData>(formData: T): QueryObject {
  const extras = {
    where: formData.where || '',
    having: formData.having || '',
    having_druid: formData.havingDruid || '',
    time_grain_sqla: formData.timeGrainSqla || '',
    druid_time_origin: formData.druidTimeOrigin || '',
  }

  const orgGroupby = formData.groupby || [];
  const orgColumns = formData.columns || [];
  const groupbySet = new Set(orgGroupby.concat(orgColumns));
  const limit = formData.limit ? Number(formData.limit) : 0;
  const row_limit = Number(formData.rowLimit);
  const order_desc = formData.orderDesc === undefined ? true : formData.orderDesc;
  const is_timeseries = groupbySet.has(DTTM_ALIAS);


  return {
    granularity: getGranularity(formData),
    metrics: new Metrics(formData).getMetrics(),
    groupby: Array.from(groupbySet),
    timeseries_limit_metric: formData.timeseriesLimitMetric,
    time_range: formData.timeRange,
    since: formData.since,
    until: formData.until,
    extras,
    timeseries_limit: limit,
    row_limit,
    order_desc,
    is_timeseries,
    prequeries: [],
    is_prequery: false,
  };
}

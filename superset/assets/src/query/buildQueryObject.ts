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
  timeseries_limit_metric: Metric | null;
  time_range: string;
  since: string;
  until: string;
  row_limit: number;
  order_desc: boolean;
  is_timeseries: boolean;
  prequeries: any[];
  is_prequery: boolean;
  orderby: any[];
}

// Build the  common segments of all query objects (e.g. the granularity field derived from
// either sql alchemy or druid). The segments specific to each viz type is constructed in the
// buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
// Note the type of the formData argument passed in here is the type of the formData for a
// specific viz, which is a subtype of the generic formData shared among all viz types.
export default function buildQueryObject<T extends FormData>(formData: T): QueryObject {
  const extras = {
    druid_time_origin: formData.druid_time_origin || '',
    having: formData.having || '',
    having_druid: formData.having_druid || '',
    time_grain_sqla: formData.time_grain_sqla || '',
    where: formData.where || '',
  };

  const orgGroupby = formData.groupby || [];
  const orgColumns = formData.columns || [];
  const groupbySet = new Set(orgGroupby.concat(orgColumns));
  const limit = formData.limit ? Number(formData.limit) : 0;
  const rowLimit = Number(formData.row_limit);
  const orderDesc = formData.order_desc === undefined ? true : formData.order_desc;
  const isTimeseries = groupbySet.has(DTTM_ALIAS);

  return {
    extras,
    granularity: getGranularity(formData),
    groupby: Array.from(groupbySet),
    is_prequery: false,
    is_timeseries: isTimeseries,
    metrics: new Metrics(formData).getMetrics(),
    order_desc: orderDesc,
    prequeries: [],
    row_limit: rowLimit,
    since: formData.since,
    time_range: formData.time_range,
    timeseries_limit: limit,
    timeseries_limit_metric: Metrics.convertMetric(formData.timeseries_limit_metric),
    until: formData.until,
    orderby: [],
  };
}

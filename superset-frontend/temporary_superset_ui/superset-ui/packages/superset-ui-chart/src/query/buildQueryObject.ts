import Metrics from './Metrics';
import { QueryObject } from '../types/Query';
import { ChartFormData, DruidFormData, SqlaFormData } from '../types/ChartFormData';

const DTTM_ALIAS = '__timestamp';

function getGranularity(formData: ChartFormData): string {
  return 'granularity_sqla' in formData ? formData.granularity_sqla : formData.granularity;
}

// Build the common segments of all query objects (e.g. the granularity field derived from
// either sql alchemy or druid). The segments specific to each viz type is constructed in the
// buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
// Note the type of the formData argument passed in here is the type of the formData for a
// specific viz, which is a subtype of the generic formData shared among all viz types.
export default function buildQueryObject<T extends ChartFormData>(formData: T): QueryObject {
  const extras = {
    druid_time_origin: (formData as DruidFormData).druid_time_origin || '',
    having: (formData as SqlaFormData).having || '',
    having_druid: (formData as DruidFormData).having_druid || '',
    time_grain_sqla: (formData as SqlaFormData).time_grain_sqla || '',
    where: formData.where || '',
  };

  const { columns = [], groupby = [] } = formData;
  const groupbySet = new Set([...columns, ...groupby]);
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
    orderby: [],
    prequeries: [],
    row_limit: rowLimit,
    since: formData.since,
    time_range: formData.time_range,
    timeseries_limit: limit,
    timeseries_limit_metric: formData.timeseries_limit_metric
      ? Metrics.formatMetric(formData.timeseries_limit_metric)
      : null,
    until: formData.until,
  };
}

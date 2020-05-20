/* eslint-disable camelcase */
import { QueryObject } from './types/Query';
import { isSqlaFormData, QueryFormData } from './types/QueryFormData';
import processGroupby from './processGroupby';
import convertMetric from './convertMetric';
import processFilters from './processFilters';
import processExtras from './processExtras';
import extractQueryFields from './extractQueryFields';

export const DTTM_ALIAS = '__timestamp';

function processGranularity(formData: QueryFormData): string {
  return isSqlaFormData(formData) ? formData.granularity_sqla : formData.granularity;
}

/**
 * Build the common segments of all query objects (e.g. the granularity field derived from
 * either sql alchemy or druid). The segments specific to each viz type is constructed in the
 * buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
 * Note the type of the formData argument passed in here is the type of the formData for a
 * specific viz, which is a subtype of the generic formData shared among all viz types.
 */
export default function buildQueryObject<T extends QueryFormData>(formData: T): QueryObject {
  const {
    time_range,
    since,
    until,
    order_desc,
    row_limit,
    limit,
    timeseries_limit_metric,
    queryFields,
    ...residualFormData
  } = formData;

  const numericRowLimit = Number(row_limit);
  const { metrics, groupby, columns } = extractQueryFields(residualFormData, queryFields);
  const groupbySet = new Set([...columns, ...groupby]);

  return {
    extras: processExtras(formData),
    granularity: processGranularity(formData),
    groupby: processGroupby(Array.from(groupbySet)),
    is_timeseries: groupbySet.has(DTTM_ALIAS),
    metrics: metrics.map(convertMetric),
    order_desc: typeof order_desc === 'undefined' ? true : order_desc,
    orderby: [],
    row_limit: row_limit == null || Number.isNaN(numericRowLimit) ? undefined : numericRowLimit,
    since,
    time_range,
    timeseries_limit: limit ? Number(limit) : 0,
    timeseries_limit_metric: timeseries_limit_metric
      ? convertMetric(timeseries_limit_metric)
      : null,
    until,
    ...processFilters(formData),
  };
}

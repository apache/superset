/* eslint-disable camelcase */
import { QueryObject } from './types/Query';
import { QueryFieldAliases, QueryFormData } from './types/QueryFormData';
import processFilters from './processFilters';
import extractExtras from './extractExtras';
import extractQueryFields from './extractQueryFields';
import { appendExtraFormData, overrideExtraFormData } from './processExtraFormData';

export const DTTM_ALIAS = '__timestamp';

/**
 * Build the common segments of all query objects (e.g. the granularity field derived from
 * either sql alchemy or druid). The segments specific to each viz type is constructed in the
 * buildQuery method for each viz type (see `wordcloud/buildQuery.ts` for an example).
 * Note the type of the formData argument passed in here is the type of the formData for a
 * specific viz, which is a subtype of the generic formData shared among all viz types.
 */
export default function buildQueryObject<T extends QueryFormData>(
  formData: T,
  queryFields?: QueryFieldAliases,
): QueryObject {
  const {
    annotation_layers = [],
    extra_form_data = {},
    time_range,
    since,
    until,
    row_limit,
    row_offset,
    order_desc,
    limit,
    timeseries_limit_metric,
    granularity,
    url_params = {},
    ...residualFormData
  } = formData;
  const { append_form_data = {}, override_form_data = {} } = extra_form_data;

  const numericRowLimit = Number(row_limit);
  const numericRowOffset = Number(row_offset);
  const { metrics, columns, orderby } = extractQueryFields(residualFormData, queryFields);

  const extras = extractExtras(formData);
  const extrasAndfilters = processFilters({
    ...formData,
    ...extras,
  });

  let queryObject: QueryObject = {
    // fallback `null` to `undefined` so they won't be sent to the backend
    // (JSON.strinify will ignore `undefined`.)
    time_range: time_range || undefined,
    since: since || undefined,
    until: until || undefined,
    granularity: granularity || undefined,
    ...extras,
    ...extrasAndfilters,
    columns,
    metrics,
    orderby,
    annotation_layers,
    row_limit: row_limit == null || Number.isNaN(numericRowLimit) ? undefined : numericRowLimit,
    row_offset: row_offset == null || Number.isNaN(numericRowOffset) ? undefined : numericRowOffset,
    timeseries_limit: limit ? Number(limit) : 0,
    timeseries_limit_metric: timeseries_limit_metric || undefined,
    order_desc: typeof order_desc === 'undefined' ? true : order_desc,
    url_params: url_params || undefined,
  };
  // append and override extra form data used by native filters
  queryObject = appendExtraFormData(queryObject, append_form_data);
  queryObject = overrideExtraFormData(queryObject, override_form_data);
  return queryObject;
}

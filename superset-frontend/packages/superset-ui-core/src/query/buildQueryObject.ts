/*
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

/* eslint-disable camelcase */
import {
  AdhocFilter,
  QueryObject,
  QueryObjectFilterClause,
  isQueryFormMetric,
} from './types';
import {
  QueryFieldAliases,
  QueryFormMetric,
  QueryFormData,
} from './types/QueryFormData';
import processFilters from './processFilters';
import extractExtras from './extractExtras';
import extractQueryFields from './extractQueryFields';
import { overrideExtraFormData } from './processExtraFormData';
import { isDefined } from '../utils';

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
    extra_form_data,
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
    custom_params = {},
    series_columns,
    series_limit,
    series_limit_metric,
    ...residualFormData
  } = formData;
  const {
    adhoc_filters: appendAdhocFilters = [],
    filters: appendFilters = [],
    custom_form_data = {},
    ...overrides
  } = extra_form_data || {};

  const numericRowLimit = Number(row_limit);
  const numericRowOffset = Number(row_offset);
  const { metrics, columns, orderby } = extractQueryFields(
    residualFormData,
    queryFields,
  );

  // collect all filters for conversion to simple filters/freeform clauses
  const extras = extractExtras(formData);
  const { filters: extraFilters } = extras;
  const filterFormData: {
    filters: QueryObjectFilterClause[];
    adhoc_filters: AdhocFilter[];
  } = {
    filters: [...extraFilters, ...appendFilters],
    adhoc_filters: [...(formData.adhoc_filters || []), ...appendAdhocFilters],
  };
  const extrasAndfilters = processFilters({
    ...formData,
    ...extras,
    ...filterFormData,
  });
  const normalizeSeriesLimitMetric = (metric: QueryFormMetric | undefined) => {
    if (isQueryFormMetric(metric)) {
      return metric;
    }
    return undefined;
  };

  let queryObject: QueryObject = {
    // fallback `null` to `undefined` so they won't be sent to the backend
    // (JSON.stringify will ignore `undefined`.)
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
    row_limit:
      row_limit == null || Number.isNaN(numericRowLimit)
        ? undefined
        : numericRowLimit,
    row_offset:
      row_offset == null || Number.isNaN(numericRowOffset)
        ? undefined
        : numericRowOffset,
    series_columns,
    series_limit: series_limit ?? (isDefined(limit) ? Number(limit) : 0),
    series_limit_metric:
      normalizeSeriesLimitMetric(series_limit_metric) ??
      timeseries_limit_metric ??
      undefined,
    order_desc: typeof order_desc === 'undefined' ? true : order_desc,
    url_params: url_params || undefined,
    custom_params,
  };

  // override extra form data used by native and cross filters
  queryObject = overrideExtraFormData(queryObject, overrides);

  return { ...queryObject, custom_form_data };
}

/**
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
import {
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  PostProcessingRule,
  QueryMode,
  QueryObject,
  removeDuplicates,
} from '@superset-ui/core';
import { BuildQuery } from '@superset-ui/core/src/chart/registries/ChartBuildQueryRegistrySingleton';
import { CccsGridQueryFormData, DEFAULT_FORM_DATA } from '../types';

/**
 * The buildQuery function is used to create an instance of QueryContext that's
 * sent to the chart data endpoint. In addition to containing information of which
 * datasource to use, it specifies the type (e.g. full payload, samples, query) and
 * format (e.g. CSV or JSON) of the result and whether or not to force refresh the data from
 * the datasource as opposed to using a cached copy of the data, if available.
 *
 * More importantly though, QueryContext contains a property `queries`, which is an array of
 * QueryObjects specifying individual data requests to be made. A QueryObject specifies which
 * columns, metrics and filters, among others, to use during the query. Usually it will be enough
 * to specify just one query based on the baseQueryObject, but for some more advanced use cases
 * it is possible to define post processing operations in the QueryObject, or multiple queries
 * if a viz needs multiple different result sets.
 */
export function getQueryMode(formData: CccsGridQueryFormData) {
  const { query_mode: mode } = formData;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode;
  }
  const rawColumns = formData?.all_columns;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

const buildQuery: BuildQuery<CccsGridQueryFormData> = (
  formData: CccsGridQueryFormData,
  options: any,
) => {
  const queryMode = getQueryMode(formData);
  const sortByMetric = ensureIsArray(formData.timeseries_limit_metric)[0];
  let formDataCopy = {
    ...formData,
    ...DEFAULT_FORM_DATA,
  };
  const { percent_metrics: percentMetrics, order_desc: orderDesc = false } =
    formData;
  // never include time in raw records mode
  if (queryMode === QueryMode.raw) {
    formDataCopy = {
      ...formData,
      ...DEFAULT_FORM_DATA,
      include_time: false,
    };
  }

  return buildQueryContext(formDataCopy, baseQueryObject => {
    let { metrics, orderby = [] } = baseQueryObject;
    const postProcessing: PostProcessingRule[] = [];

    if (queryMode === QueryMode.aggregate) {
      metrics = metrics || [];
      if (sortByMetric) {
        orderby = [[sortByMetric, !orderDesc]];
      } else if (metrics?.length > 0) {
        // default to ordering by first metric in descending order
        orderby = [[metrics[0], false]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricLabels = removeDuplicates(
          percentMetrics.map(getMetricLabel),
        );
        metrics = removeDuplicates(
          metrics.concat(percentMetrics),
          getMetricLabel,
        );
        postProcessing.push({
          operation: 'contribution',
          options: {
            columns: percentMetricLabels as string[],
            rename_columns: percentMetricLabels.map(x => `%${x}`),
          },
        });
      }
    }

    const moreProps: Partial<QueryObject> = {};
    const ownState = options?.ownState ?? {};
    if (formDataCopy.server_pagination) {
      moreProps.row_limit =
        ownState.pageSize ?? formDataCopy.server_page_length;
      moreProps.row_offset =
        (ownState.currentPage ?? 0) * (ownState.pageSize ?? 0);
    }

    const queryObject = {
      ...baseQueryObject,
      orderby,
      metrics,
      post_processing: postProcessing,
      ...moreProps,
    };

    // Because we use same buildQuery for all table on the page we need split them by id
    options?.hooks?.setCachedChanges({
      [formData.slice_id]: queryObject.filters,
    });

    const extraQueries: QueryObject[] = [];
    if (
      metrics?.length &&
      formData.show_totals &&
      queryMode === QueryMode.aggregate
    ) {
      extraQueries.push({
        ...queryObject,
        columns: [],
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
      });
    }

    const interactiveGroupBy = formData.extra_form_data?.interactive_groupby;
    if (interactiveGroupBy && queryObject.columns) {
      queryObject.columns = [
        ...new Set([...queryObject.columns, ...interactiveGroupBy]),
      ];
    }

    if (formData.server_pagination) {
      return [
        { ...queryObject },
        {
          ...queryObject,
          row_limit: 0,
          row_offset: 0,
          post_processing: [],
          is_rowcount: true,
        },
        ...extraQueries,
      ];
    }

    return [queryObject, ...extraQueries];
  });
};

// Use this closure to cache changing of external filters, if we have server pagination we need reset page to 0, after
// external filter changed
export const cachedBuildQuery = (): BuildQuery<CccsGridQueryFormData> => {
  let cachedChanges: any = {};
  const setCachedChanges = (newChanges: any) => {
    cachedChanges = { ...cachedChanges, ...newChanges };
  };

  return (formData: any, options: any) =>
    buildQuery(
      { ...formData },
      {
        extras: { cachedChanges },
        ownState: options?.ownState ?? {},
        hooks: {
          ...options?.hooks,
          setDataMask: () => {},
          setCachedChanges,
        },
      },
    );
};

export default cachedBuildQuery();

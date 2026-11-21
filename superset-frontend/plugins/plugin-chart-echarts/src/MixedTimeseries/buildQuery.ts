/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  buildQueryContext,
  ensureIsArray,
  normalizeOrderBy,
  PostProcessingPivot,
  QueryContext,
  QueryFormData,
  QueryObject,
  isXAxisSet,
  getXAxisColumn,
} from '@superset-ui/core';
import {
  pivotOperator,
  renameOperator,
  flattenOperator,
  isTimeComparison,
  timeComparePivotOperator,
  rollingWindowOperator,
  timeCompareOperator,
  resampleOperator,
} from '@superset-ui/chart-controls';
import {
  retainFormDataSuffix,
  removeFormDataSuffix,
} from '../utils/formDataSuffix';

/* ----------------------------------------------------------------------------
 * Multi-dataset support (Query B on a different dataset)
 *
 * A chart-data request carries exactly one datasource: the backend binds
 * every query in a QueryContext to that context's datasource. When Query B
 * targets a different dataset, the caller (see MixedTimeseriesRequestPlanner)
 * sends two requests — one per dataset — instead of one, and stamps each
 * request's form data with `_mixed_target` to say which half of the chart it
 * carries. `buildQuery` then emits a single-query context for that target:
 *
 *   - 'A': Query A only, against the chart datasource.
 *   - 'B': Query B only, against `datasource_b`, with its own x-axis
 *     (`x_axis_b`) in place of the shared one.
 *
 * Without the stamp (single-dataset charts, and every caller that predates
 * this feature: exports, dashboards, SQL Lab redirect) the output is the
 * original merged two-query context, unchanged.
 * ------------------------------------------------------------------------- */

/** Transient per-request marker: which half of a multi-dataset chart to emit. */
export const MIXED_TARGET_FIELD = '_mixed_target';

export type MixedTarget = 'A' | 'B';

/** Returns whether the form data requests a single target of the chart. */
function getMixedTarget(formData: QueryFormData): MixedTarget | undefined {
  const target = (formData as Record<string, unknown>)[MIXED_TARGET_FIELD];
  return target === 'A' || target === 'B' ? target : undefined;
}

/** Returns whether a secondary dataset is configured for Query B. */
function isSecondaryDatasetConfigured(formData: QueryFormData): boolean {
  const datasourceB = (formData as Record<string, unknown>).datasource_b;
  return typeof datasourceB === 'string' && datasourceB.length > 0;
}

/**
 * Builds the query context for one half of the Mixed Timeseries chart.
 *
 * `axisSource` supplies the x-axis column: the merged/legacy path passes the
 * raw (un-split) form data so both queries keep sharing its `x_axis`, while
 * single-target requests pass their own normalized form data, whose `x_axis`
 * is the target's own column (`x_axis_b` for target 'B').
 */
function buildSingleQueryContext(
  formData: QueryFormData,
  axisSource: QueryFormData,
): QueryContext {
  return buildQueryContext(formData, baseQueryObject => {
    const queryObject = {
      ...baseQueryObject,
      columns: [
        ...(isXAxisSet(axisSource)
          ? ensureIsArray(getXAxisColumn(axisSource))
          : []),
        ...ensureIsArray(formData.groupby),
      ],
      series_columns: formData.groupby,
      ...(isXAxisSet(axisSource) ? {} : { is_timeseries: true }),
    };

    const pivotOperatorInRuntime: PostProcessingPivot = isTimeComparison(
      formData,
      queryObject,
    )
      ? timeComparePivotOperator(formData, queryObject)
      : pivotOperator(formData, queryObject);

    const tmpQueryObject = {
      ...queryObject,
      time_offsets: isTimeComparison(formData, queryObject)
        ? formData.time_compare
        : [],
      post_processing: [
        pivotOperatorInRuntime,
        resampleOperator(formData, queryObject),
        rollingWindowOperator(formData, queryObject),
        timeCompareOperator(formData, queryObject),
        renameOperator(formData, queryObject),
        flattenOperator(formData, queryObject),
      ],
    } as QueryObject;
    // Preserve `order_desc` and `series_limit_metric` on the query object and
    // only normalize `orderby`. `normalizeOrderBy` strips those two fields from
    // its result, but the backend series-limit subquery reads `order_desc`
    // directly to pick the top-N series, so dropping it makes the sort
    // direction silently ignored for the displayed result. Mirrors the
    // single-query Timeseries chart's buildQuery.
    return [
      {
        ...tmpQueryObject,
        orderby: normalizeOrderBy(tmpQueryObject).orderby,
      },
    ];
  });
}

export default function buildQuery(formData: QueryFormData) {
  const baseFormData = {
    ...formData,
  };

  // Multi-dataset mode: emit only the requested half as its own single-query
  // context, so each dataset's request is validated, authorized and executed
  // against that dataset alone.
  const mixedTarget = getMixedTarget(baseFormData);
  if (mixedTarget && isSecondaryDatasetConfigured(baseFormData)) {
    const targetFormData =
      mixedTarget === 'A'
        ? // Query A: drop the _b fields entirely; the chart datasource and
          // the shared x_axis stay as they are.
          removeFormDataSuffix(baseFormData, '_b')
        : // Query B: promote the _b fields to their base names
          // (metrics_b -> metrics, groupby_b -> groupby, adhoc_filters_b ->
          // adhoc_filters, datasource_b -> datasource, x_axis_b -> x_axis, ...)
          // and pin the datasource to Dataset B so a stale or missing rename
          // can never fall back to the chart datasource.
          {
            ...retainFormDataSuffix(baseFormData, '_b'),
            datasource: baseFormData.datasource_b as string,
          };
    return buildSingleQueryContext(targetFormData, targetFormData);
  }

  // Legacy / single-dataset path: one merged request with both queries, both
  // bound to the chart datasource, exactly as before.
  const formData1 = removeFormDataSuffix(baseFormData, '_b');
  const formData2 = retainFormDataSuffix(baseFormData, '_b');

  const queryContexts = [formData1, formData2].map(fd =>
    buildSingleQueryContext(fd, baseFormData),
  );

  return {
    ...queryContexts[0],
    queries: [...queryContexts[0].queries, ...queryContexts[1].queries],
  };
}

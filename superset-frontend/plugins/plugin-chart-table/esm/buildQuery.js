(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
QueryMode,

removeDuplicates } from
'@superset-ui/core';



import { updateExternalFormData } from './DataTable/utils/externalAPIs';

/**
 * Infer query mode from form data. If `all_columns` is set, then raw records mode,
 * otherwise defaults to aggregation mode.
 *
 * The same logic is used in `controlPanel` with control values as well.
 */
export function getQueryMode(formData) {
  const { query_mode: mode } = formData;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode;
  }
  const rawColumns = formData == null ? void 0 : formData.all_columns;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

const buildQuery = (
formData,
options) =>
{
  const { percent_metrics: percentMetrics, order_desc: orderDesc = false } =
  formData;
  const queryMode = getQueryMode(formData);
  const sortByMetric = ensureIsArray(formData.timeseries_limit_metric)[0];
  let formDataCopy = formData;
  // never include time in raw records mode
  if (queryMode === QueryMode.raw) {
    formDataCopy = {
      ...formData,
      include_time: false };

  }

  return buildQueryContext(formDataCopy, (baseQueryObject) => {var _options$ownState, _options$extras, _options$extras$cache, _options$extras2, _options$extras2$cach, _options$hooks2, _metrics2, _formData$extra_form_;
    let { metrics, orderby = [] } = baseQueryObject;
    let postProcessing = [];

    if (queryMode === QueryMode.aggregate) {var _metrics;
      metrics = metrics || [];
      // orverride orderby with timeseries metric when in aggregation mode
      if (sortByMetric) {
        orderby = [[sortByMetric, !orderDesc]];
      } else if (((_metrics = metrics) == null ? void 0 : _metrics.length) > 0) {
        // default to ordering by first metric in descending order
        // when no "sort by" metric is set (regargless if "SORT DESC" is set to true)
        orderby = [[metrics[0], false]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricLabels = removeDuplicates(
        percentMetrics.map(getMetricLabel));

        metrics = removeDuplicates(
        metrics.concat(percentMetrics),
        getMetricLabel);

        postProcessing = [
        {
          operation: 'contribution',
          options: {
            columns: percentMetricLabels,
            rename_columns: percentMetricLabels.map((x) => `%${x}`) } }];



      }
    }

    const moreProps = {};
    const ownState = (_options$ownState = options == null ? void 0 : options.ownState) != null ? _options$ownState : {};
    if (formDataCopy.server_pagination) {var _ownState$pageSize, _ownState$currentPage, _ownState$pageSize2;
      moreProps.row_limit = (_ownState$pageSize =
      ownState.pageSize) != null ? _ownState$pageSize : formDataCopy.server_page_length;
      moreProps.row_offset =
      ((_ownState$currentPage = ownState.currentPage) != null ? _ownState$currentPage : 0) * ((_ownState$pageSize2 = ownState.pageSize) != null ? _ownState$pageSize2 : 0);
    }

    let queryObject = {
      ...baseQueryObject,
      orderby,
      metrics,
      post_processing: postProcessing,
      ...moreProps };


    if (
    formData.server_pagination &&
    options != null && (_options$extras = options.extras) != null && (_options$extras$cache = _options$extras.cachedChanges) != null && _options$extras$cache[formData.slice_id] &&
    JSON.stringify(options == null ? void 0 : (_options$extras2 = options.extras) == null ? void 0 : (_options$extras2$cach = _options$extras2.cachedChanges) == null ? void 0 : _options$extras2$cach[formData.slice_id]) !==
    JSON.stringify(queryObject.filters))
    {var _options$hooks, _queryObject$row_limi;
      queryObject = { ...queryObject, row_offset: 0 };
      updateExternalFormData(
      options == null ? void 0 : (_options$hooks = options.hooks) == null ? void 0 : _options$hooks.setDataMask,
      0, (_queryObject$row_limi =
      queryObject.row_limit) != null ? _queryObject$row_limi : 0);

    }
    // Because we use same buildQuery for all table on the page we need split them by id
    options == null ? void 0 : (_options$hooks2 = options.hooks) == null ? void 0 : _options$hooks2.setCachedChanges({
      [formData.slice_id]: queryObject.filters });


    const extraQueries = [];
    if (
    (_metrics2 = metrics) != null && _metrics2.length &&
    formData.show_totals &&
    queryMode === QueryMode.aggregate)
    {
      extraQueries.push({
        ...queryObject,
        columns: [],
        row_limit: 0,
        row_offset: 0,
        post_processing: [] });

    }

    const interactiveGroupBy = (_formData$extra_form_ = formData.extra_form_data) == null ? void 0 : _formData$extra_form_.interactive_groupby;
    if (interactiveGroupBy && queryObject.columns) {
      queryObject.columns = [
      ...new Set([...queryObject.columns, ...interactiveGroupBy])];

    }

    if (formData.server_pagination) {
      return [
      { ...queryObject },
      {
        ...queryObject,
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
        is_rowcount: true },

      ...extraQueries];

    }

    return [queryObject, ...extraQueries];
  });
};

// Use this closure to cache changing of external filters, if we have server pagination we need reset page to 0, after
// external filter changed
export const cachedBuildQuery = () => {
  let cachedChanges = {};
  const setCachedChanges = (newChanges) => {
    cachedChanges = { ...cachedChanges, ...newChanges };
  };

  return (formData, options) => {var _options$ownState2;return (
      buildQuery(
      { ...formData },
      {
        extras: { cachedChanges },
        ownState: (_options$ownState2 = options == null ? void 0 : options.ownState) != null ? _options$ownState2 : {},
        hooks: {
          ...(options == null ? void 0 : options.hooks),
          setDataMask: () => {},
          setCachedChanges } }));};



};const _default =

cachedBuildQuery();export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(getQueryMode, "getQueryMode", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts");reactHotLoader.register(buildQuery, "buildQuery", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts");reactHotLoader.register(cachedBuildQuery, "cachedBuildQuery", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
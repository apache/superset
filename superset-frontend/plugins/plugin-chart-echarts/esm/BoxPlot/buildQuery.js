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
import { buildQueryContext } from '@superset-ui/core';
import { boxplotOperator } from '@superset-ui/chart-controls';


export default function buildQuery(formData) {
  const { columns = [], granularity_sqla, groupby = [] } = formData;
  return buildQueryContext(formData, (baseQueryObject) => {
    const distributionColumns = [];
    // For now default to using the temporal column as distribution column.
    // In the future this control should be made mandatory.
    if (!columns.length && granularity_sqla) {
      distributionColumns.push(granularity_sqla);
    }
    return [
    {
      ...baseQueryObject,
      columns: [...distributionColumns, ...columns, ...groupby],
      series_columns: groupby,
      post_processing: [boxplotOperator(formData, baseQueryObject)] }];


  });
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(buildQuery, "buildQuery", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BoxPlot/buildQuery.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
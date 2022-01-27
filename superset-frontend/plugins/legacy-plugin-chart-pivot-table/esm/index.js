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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Table'),
  description:
  t(`Used to summarize a set of data by grouping together multiple statistics along two axes. Examples: Sales numbers by region and month, tasks by status and assignee, active users by age and location.

  This chart is being deprecated and we recommend checking out Pivot Table V2 instead!`),
  name: t('Pivot Table'),
  tags: [t('Legacy')],
  thumbnail,
  useLegacyApi: true });


export default class PivotTableChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactPivotTable'),
      metadata,
      transformProps,
      controlPanel });

  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(metadata, "metadata", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-pivot-table/src/index.js");reactHotLoader.register(PivotTableChartPlugin, "PivotTableChartPlugin", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-pivot-table/src/index.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
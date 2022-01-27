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
getNumberFormatter,
GenericDataType,
getMetricLabel,
extractTimegrain } from

'@superset-ui/core';

import { getDateFormatter, parseMetricValue } from '../utils';

export default function transformProps(chartProps) {var _metricEntry, _ref, _metricEntry2;
  const { width, height, queriesData, formData, rawFormData } = chartProps;
  const {
    headerFontSize,
    metric = 'value',
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    timeFormat,
    yAxisFormat } =
  formData;
  const { data = [], coltypes = [] } = queriesData[0];
  const granularity = extractTimegrain(rawFormData);
  const metricName = getMetricLabel(metric);
  const formattedSubheader = subheader;
  const bigNumber =
  data.length === 0 ? null : parseMetricValue(data[0][metricName]);

  let metricEntry;
  if (chartProps.datasource && chartProps.datasource.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
    (metricItem) => metricItem.metric_name === metric);

  }

  const formatTime = getDateFormatter(
  timeFormat,
  granularity, (_metricEntry =
  metricEntry) == null ? void 0 : _metricEntry.d3format);


  const headerFormatter =
  coltypes[0] === GenericDataType.TEMPORAL ||
  coltypes[0] === GenericDataType.STRING ||
  forceTimestampFormatting ?
  formatTime :
  getNumberFormatter((_ref = yAxisFormat != null ? yAxisFormat : (_metricEntry2 = metricEntry) == null ? void 0 : _metricEntry2.d3format) != null ? _ref : undefined);

  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subheader: formattedSubheader };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(transformProps, "transformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberTotal/transformProps.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
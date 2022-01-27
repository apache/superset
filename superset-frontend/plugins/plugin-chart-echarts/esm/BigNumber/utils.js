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

import moment from 'moment';
import {
getTimeFormatter,
getTimeFormatterForGranularity,
smartDateFormatter } from

'@superset-ui/core';

export const parseMetricValue = (metricValue) => {
  if (typeof metricValue === 'string') {
    const dateObject = moment.utc(metricValue, moment.ISO_8601, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return null;
  }
  return metricValue;
};

export const getDateFormatter = (
timeFormat,
granularity,
fallbackFormat) =>

timeFormat === smartDateFormatter.id ?
getTimeFormatterForGranularity(granularity) :
getTimeFormatter(timeFormat != null ? timeFormat : fallbackFormat);;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(parseMetricValue, "parseMetricValue", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/utils.ts");reactHotLoader.register(getDateFormatter, "getDateFormatter", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/utils.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
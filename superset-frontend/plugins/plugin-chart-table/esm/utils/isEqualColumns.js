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
import isEqualArray from './isEqualArray';


export default function isEqualColumns(
propsA,
propsB)
{var _a$queriesData, _a$queriesData$, _b$queriesData, _b$queriesData$, _a$queriesData2, _a$queriesData2$, _b$queriesData2, _b$queriesData2$;
  const a = propsA[0];
  const b = propsB[0];
  return (
    a.datasource.columnFormats === b.datasource.columnFormats &&
    a.datasource.verboseMap === b.datasource.verboseMap &&
    a.formData.tableTimestampFormat === b.formData.tableTimestampFormat &&
    a.formData.timeGrainSqla === b.formData.timeGrainSqla &&
    JSON.stringify(a.formData.columnConfig || null) ===
    JSON.stringify(b.formData.columnConfig || null) &&
    isEqualArray(a.formData.metrics, b.formData.metrics) &&
    isEqualArray((_a$queriesData = a.queriesData) == null ? void 0 : (_a$queriesData$ = _a$queriesData[0]) == null ? void 0 : _a$queriesData$.colnames, (_b$queriesData = b.queriesData) == null ? void 0 : (_b$queriesData$ = _b$queriesData[0]) == null ? void 0 : _b$queriesData$.colnames) &&
    isEqualArray((_a$queriesData2 = a.queriesData) == null ? void 0 : (_a$queriesData2$ = _a$queriesData2[0]) == null ? void 0 : _a$queriesData2$.coltypes, (_b$queriesData2 = b.queriesData) == null ? void 0 : (_b$queriesData2$ = _b$queriesData2[0]) == null ? void 0 : _b$queriesData2$.coltypes) &&
    JSON.stringify(a.formData.extraFilters || null) ===
    JSON.stringify(b.formData.extraFilters || null) &&
    JSON.stringify(a.formData.extraFormData || null) ===
    JSON.stringify(b.formData.extraFormData || null));

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(isEqualColumns, "isEqualColumns", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/utils/isEqualColumns.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
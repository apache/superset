(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};







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
export const DTTM_ALIAS = '__timestamp';

export const EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS =
[
'druid_time_origin',
'relative_start',
'relative_end',
'time_grain_sqla',
'time_range_endpoints'];


export const EXTRA_FORM_DATA_APPEND_KEYS = [
'adhoc_filters',
'filters',
'interactive_groupby',
'interactive_highlight',
'interactive_drilldown',
'custom_form_data'];


export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS =


{
  granularity: 'granularity',
  granularity_sqla: 'granularity',
  time_column: 'time_column',
  time_grain: 'time_grain',
  time_range: 'time_range' };


export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS = Object.keys(
EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS);


export const EXTRA_FORM_DATA_OVERRIDE_KEYS = [
...EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS,
...EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS];;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DTTM_ALIAS, "DTTM_ALIAS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");reactHotLoader.register(EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS, "EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");reactHotLoader.register(EXTRA_FORM_DATA_APPEND_KEYS, "EXTRA_FORM_DATA_APPEND_KEYS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");reactHotLoader.register(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS, "EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");reactHotLoader.register(EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS, "EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");reactHotLoader.register(EXTRA_FORM_DATA_OVERRIDE_KEYS, "EXTRA_FORM_DATA_OVERRIDE_KEYS", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/constants.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();import _URLSearchParams from "@babel/runtime-corejs3/core-js-stable/url-search-params";var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import { SupersetClient } from '../../../connection';










export default async function fetchExploreJson({
  client = SupersetClient,
  method = 'POST',
  requestConfig,
  endpoint = '/superset/explore_json/',
  formData })
{
  const { json } = await client.request({
    ...requestConfig,
    method,
    endpoint,
    searchParams:
    method === 'GET' ?
    new _URLSearchParams({ form_data: JSON.stringify(formData) }) :
    undefined,
    postPayload: method === 'POST' ? { form_data: formData } : undefined });

  return json;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(fetchExploreJson, "fetchExploreJson", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/api/legacy/fetchExploreJson.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
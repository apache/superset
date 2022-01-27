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
/* eslint camelcase: 0 */
import URI from 'urijs';
import safeStringify from 'fast-safe-stringify';

const MAX_URL_LENGTH = 8000;

export function getURIDirectory(formData, endpointType = 'base') {
  // Building the directory part of the URI
  let directory = '/superset/explore/';
  if (['json', 'csv', 'query', 'results', 'samples'].includes(endpointType)) {
    directory = '/superset/explore_json/';
  }

  return directory;
}

export function getExploreLongUrl(
formData,
endpointType,
allowOverflow = true,
extraSearch = {})
{
  if (!formData.datasource) {
    return null;
  }

  const uri = new URI('/');
  const directory = getURIDirectory(formData, endpointType);
  const search = uri.search(true);
  Object.keys(extraSearch).forEach((key) => {
    search[key] = extraSearch[key];
  });
  search.form_data = safeStringify(formData);
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  const url = uri.directory(directory).search(search).toString();
  if (!allowOverflow && url.length > MAX_URL_LENGTH) {
    const minimalFormData = {
      datasource: formData.datasource,
      viz_type: formData.viz_type };


    return getExploreLongUrl(minimalFormData, endpointType, false, {
      URL_IS_TOO_LONG_TO_SHARE: null });

  }

  return url;
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(MAX_URL_LENGTH, "MAX_URL_LENGTH", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/exploreUtils.js");reactHotLoader.register(getURIDirectory, "getURIDirectory", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/exploreUtils.js");reactHotLoader.register(getExploreLongUrl, "getExploreLongUrl", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/exploreUtils.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
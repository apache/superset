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

// mapping { url_param: v1_explore_request_param }
const EXPLORE_URL_SEARCH_PARAMS = {
  form_data: 'form_data',
  slice_id: 'slice_id',
  dataset_id: 'dataset_id',
  dataset_type: 'dataset_type',
  form_data_key: 'form_data_key',
  permalink_key: 'permalink_key',
};

const EXPLORE_URL_PATH_PARAMS = {
  p: 'permalink_key', // permalink
};

// search params can be placed in form_data object
// we need to "flatten" the search params to use them with /v1/explore endpoint
const getParsedExploreURLSearchParams = () => {
  const urlSearchParams = new URLSearchParams(window.location.search);
  return Object.keys(EXPLORE_URL_SEARCH_PARAMS).reduce((acc, currentParam) => {
    const paramValue = urlSearchParams.get(currentParam);
    if (paramValue === null) {
      return acc;
    }
    let parsedParamValue;
    try {
      parsedParamValue = JSON.parse(paramValue);
    } catch {
      parsedParamValue = paramValue;
    }
    if (typeof parsedParamValue === 'object') {
      return { ...acc, ...parsedParamValue };
    }
    return {
      ...acc,
      [EXPLORE_URL_SEARCH_PARAMS[currentParam]]: parsedParamValue,
    };
  }, {});
};

// path params need to be transformed to search params to use them with /v1/explore endpoint
const getParsedExploreURLPathParams = () =>
  Object.keys(EXPLORE_URL_PATH_PARAMS).reduce((acc, currentParam) => {
    const re = new RegExp(`/(${currentParam})/(\\w+)`);
    const pathGroups = window.location.pathname.match(re);
    if (pathGroups && pathGroups[2]) {
      return { ...acc, [EXPLORE_URL_PATH_PARAMS[currentParam]]: pathGroups[2] };
    }
    return acc;
  }, {});

export const getParsedExploreURLParams = () => {
  return Object.entries({
    ...getParsedExploreURLSearchParams(),
    ...getParsedExploreURLPathParams(),
  })
    .map(entry => entry.join('='))
    .join('&');
};

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
/* eslint camelcase: 0 */
import URI from 'urijs';
import { availableDomains } from '../utils/hostNamesConfig';
import { safeStringify } from '../utils/safeStringify';

const MAX_URL_LENGTH = 8000;

export function getChartKey(explore) {
  const slice = explore.slice;
  return slice ? (slice.slice_id) : 0;
}

let requestCounter = 0;
function getHostName(allowDomainSharding = false) {
  let currentIndex = 0;
  if (allowDomainSharding) {
    currentIndex = requestCounter % availableDomains.length;
    requestCounter += 1;
  }

  return availableDomains[currentIndex];
}

export function getAnnotationJsonUrl(slice_id, form_data, isNative) {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }
  const uri = URI(window.location.search);
  const endpoint = isNative ? 'annotation_json' : 'slice_json';
  return uri.pathname(`/superset/${endpoint}/${slice_id}`)
    .search({
      form_data: safeStringify(form_data,
        (key, value) => value === null ? undefined : value),
    }).toString();
}

export function getURIDirectory(formData, endpointType = 'base') {
  // Building the directory part of the URI
  let directory = '/superset/explore/';
  if (['json', 'csv', 'query', 'results', 'samples'].indexOf(endpointType) >= 0) {
    directory = '/superset/explore_json/';
  }
  return directory;
}

export function getExploreLongUrl(formData, endpointType, allowOverflow = true, extraSearch = {}) {
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
      viz_type: formData.viz_type,
    };
    return getExploreLongUrl(
      minimalFormData, endpointType, false, { URL_IS_TOO_LONG_TO_SHARE: null });
  }
  return url;
}

export function getExploreUrlAndPayload({
  formData,
  endpointType = 'base',
  force = false,
  curUrl = null,
  requestParams = {},
  allowDomainSharding = false,
}) {
  if (!formData.datasource) {
    return null;
  }

  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = new URI({
    protocol: location.protocol.slice(0, -1),
    hostname: getHostName(allowDomainSharding),
    port: location.port ? location.port : '',
    path: '/',
  });

  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  const directory = getURIDirectory(formData, endpointType);

  // Building the querystring (search) part of the URI
  const search = uri.search(true);
  if (formData.slice_id) {
    search.form_data = safeStringify({ slice_id: formData.slice_id });
  }
  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  if (endpointType === 'results') {
    search.results = 'true';
  }
  if (endpointType === 'samples') {
    search.samples = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach((name) => {
      if (requestParams.hasOwnProperty(name)) {
        search[name] = requestParams[name];
      }
    });
  }
  uri = uri.search(search).directory(directory);
  const payload = { ...formData };

  return {
    url: uri.toString(),
    payload,
  };
}

export function exportChart(formData, endpointType) {
  const { url, payload } = getExploreUrlAndPayload({
    formData,
    endpointType,
    allowDomainSharding: false,
  });

  const exploreForm = document.createElement('form');
  exploreForm.action = url;
  exploreForm.method = 'POST';
  exploreForm.target = '_blank';
  const token = document.createElement('input');
  token.type = 'hidden';
  token.name = 'csrf_token';
  token.value = (document.getElementById('csrf_token') || {}).value;
  exploreForm.appendChild(token);
  const data = document.createElement('input');
  data.type = 'hidden';
  data.name = 'form_data';
  data.value = safeStringify(payload);
  exploreForm.appendChild(data);

  document.body.appendChild(exploreForm);
  exploreForm.submit();
  document.body.removeChild(exploreForm);
}

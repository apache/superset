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
import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from './getClientErrorObject';

export function getParamFromQuery(query, param) {
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i += 1) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

export function storeQuery(query) {
  return SupersetClient.post({
    endpoint: '/kv/store/',
    postPayload: { data: query },
  }).then(response => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?id=${response.json.id}`;
    return url;
  });
}

export function getParamsFromUrl() {
  const hash = window.location.search;
  const params = hash.split('?')[1].split('&');
  const newParams = {};
  params.forEach(p => {
    const value = p.split('=')[1].replace(/\+/g, ' ');
    const key = p.split('=')[0];
    newParams[key] = value;
  });
  return newParams;
}

export function getShortUrl(longUrl) {
  return SupersetClient.post({
    endpoint: '/r/shortner/',
    postPayload: { data: `/${longUrl}` }, // note: url should contain 2x '/' to redirect properly
    parseMethod: 'text',
    stringify: false, // the url saves with an extra set of string quotes without this
  })
    .then(({ text }) => text)
    .catch(response =>
      getClientErrorObject(response).then(({ error, statusText }) =>
        Promise.reject(error || statusText),
      ),
    );
}

export function supersetURL(rootUrl, getParams = {}) {
  const url = new URL(rootUrl, window.location.origin);
  for (const k in getParams) {
    url.searchParams.set(k, getParams[k]);
  }
  return url.href;
}

export function optionLabel(opt) {
  if (opt === null) {
    return '<NULL>';
  } else if (opt === '') {
    return '<empty string>';
  } else if (opt === true) {
    return '<true>';
  } else if (opt === false) {
    return '<false>';
  } else if (typeof opt !== 'string' && opt.toString) {
    return opt.toString();
  }
  return opt;
}

export function optionValue(opt) {
  if (opt === null) {
    return '<NULL>';
  }
  return opt;
}

export function optionFromValue(opt) {
  // From a list of options, handles special values & labels
  return { value: optionValue(opt), label: optionLabel(opt) };
}

export function prepareCopyToClipboardTabularData(data) {
  let result = '';
  for (let i = 0; i < data.length; ++i) {
    result += Object.values(data[i]).join('\t') + '\n';
  }
  return result;
}

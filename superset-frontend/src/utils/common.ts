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
import {
  SupersetClient,
  getTimeFormatter,
  TimeFormats,
} from '@superset-ui/core';
import { getClientErrorObject } from './getClientErrorObject';

// ATTENTION: If you change any constants, make sure to also change constants.py

export const NULL_STRING = '<NULL>';

// moment time format strings
export const SHORT_DATE = 'MMM D, YYYY';
export const SHORT_TIME = 'h:m a';

const DATETIME_FORMATTER = getTimeFormatter(TimeFormats.DATABASE_DATETIME);

export function getParamFromQuery(query: string, param: string) {
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i += 1) {
    const pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

export function storeQuery(query: {
  dbId: any;
  title: any;
  schema: any;
  autorun: any;
  sql: any;
}) {
  return SupersetClient.post({
    endpoint: '/kv/store/',
    postPayload: { data: query },
  }).then(response => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?id=${response.json.id}`;
    return url;
  });
}

export type UrlParamType = 'string' | 'number' | 'boolean';
export function getUrlParam(paramName: string, type: 'string'): string;
export function getUrlParam(paramName: string, type: 'number'): number;
export function getUrlParam(paramName: string, type: 'boolean'): boolean;
export function getUrlParam(paramName: string, type: UrlParamType): unknown {
  const urlParam = new URLSearchParams(window.location.search).get(paramName);
  switch (type) {
    case 'number':
      if (!urlParam) {
        return null;
      }
      if (urlParam === 'true') {
        return 1;
      }
      if (urlParam === 'false') {
        return 0;
      }
      if (!Number.isNaN(Number(urlParam))) {
        return Number(urlParam);
      }
      return null;
    // TODO: process other types when needed
    default:
      return urlParam;
  }
}

export function getShortUrl(longUrl: string) {
  return SupersetClient.post({
    endpoint: '/r/shortner/',
    postPayload: { data: `/${longUrl}` }, // note: url should contain 2x '/' to redirect properly
    parseMethod: 'text',
    stringify: false, // the url saves with an extra set of string quotes without this
  })
    .then(({ text }) => text)
    .catch(response =>
      // @ts-ignore
      getClientErrorObject(response).then(({ error, statusText }) =>
        Promise.reject(error || statusText),
      ),
    );
}

export function optionLabel(opt: any) {
  if (opt === null) {
    return NULL_STRING;
  }
  if (opt === '') {
    return '<empty string>';
  }
  if (opt === true) {
    return '<true>';
  }
  if (opt === false) {
    return '<false>';
  }
  // @ts-ignore
  if (typeof opt !== 'string' && opt.toString) {
    // @ts-ignore
    return opt.toString();
  }
  return opt;
}

export function optionValue(opt: any) {
  if (opt === null) {
    return NULL_STRING;
  }
  return opt;
}

export function optionFromValue(opt: any) {
  // From a list of options, handles special values & labels
  return { value: optionValue(opt), label: optionLabel(opt) };
}

export function prepareCopyToClipboardTabularData(data: any) {
  let result = '';
  for (let i = 0; i < data.length; i += 1) {
    result += `${Object.values(data[i]).join('\t')}\n`;
  }
  return result;
}

export function applyFormattingToTabularData(data: any) {
  if (!data || data.length === 0 || !('__timestamp' in data[0])) {
    return data;
  }
  return data.map((row: { __timestamp: string | number | Date }) => ({
    ...row,
    /* eslint-disable no-underscore-dangle */
    __timestamp:
      row.__timestamp === 0 || row.__timestamp
        ? DATETIME_FORMATTER(new Date(row.__timestamp))
        : row.__timestamp,
    /* eslint-enable no-underscore-dangle */
  }));
}

export const noOp = () => undefined;

// Detects the user's OS through the browser
export const detectOS = () => {
  const { appVersion } = navigator;

  // Leveraging this condition because of stackOverflow
  // https://stackoverflow.com/questions/11219582/how-to-detect-my-browser-version-and-operating-system-using-javascript
  if (appVersion.includes('Win')) return 'Windows';
  if (appVersion.includes('Mac')) return 'MacOS';
  if (appVersion.includes('X11')) return 'UNIX';
  if (appVersion.includes('Linux')) return 'Linux';

  return 'Unknown OS';
};

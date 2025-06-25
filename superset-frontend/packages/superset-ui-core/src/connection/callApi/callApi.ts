/*
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

import 'whatwg-fetch';
import fetchRetry from 'fetch-retry';
import { CallApi, Payload, JsonValue, JsonObject } from '../types';
import {
  CACHE_AVAILABLE,
  CACHE_KEY,
  HTTP_STATUS_NOT_MODIFIED,
  HTTP_STATUS_OK,
} from '../constants';

function tryParsePayload(payload: Payload) {
  try {
    return typeof payload === 'string'
      ? (JSON.parse(payload) as JsonValue)
      : payload;
  } catch (error) {
    throw new Error(`Invalid payload:\n\n${payload}`);
  }
}

/**
 * Try appending search params to an URL if needed.
 */
function getFullUrl(partialUrl: string, params: CallApi['searchParams']) {
  if (params) {
    const url = new URL(partialUrl, window.location.href);
    const search =
      params instanceof URLSearchParams ? params : new URLSearchParams(params);
    // will completely override any existing search params
    url.search = search.toString();
    return url.href;
  }
  return partialUrl;
}

/**
 * Fetch an API response and returns the corresponding json.
 *
 * @param {Payload} postPayload payload to send as FormData in a post form
 * @param {Payload} jsonPayload json payload to post, will automatically add Content-Type header
 * @param {string} stringify whether to stringify field values when post as formData
 */
export default async function callApi({
  body,
  cache = 'default',
  credentials = 'same-origin',
  fetchRetryOptions,
  headers,
  method = 'GET',
  mode = 'same-origin',
  postPayload,
  jsonPayload,
  redirect = 'follow',
  signal,
  stringify = true,
  url: url_,
  searchParams,
}: CallApi): Promise<Response> {
  const fetchWithRetry = fetchRetry(fetch, fetchRetryOptions);
  const url = `${getFullUrl(url_, searchParams)}`;

  const request = {
    body,
    cache,
    credentials,
    headers,
    method,
    mode,
    redirect,
    signal,
  };

  if (
    method === 'GET' &&
    cache !== 'no-store' &&
    cache !== 'reload' &&
    CACHE_AVAILABLE &&
    window.location?.protocol === 'https:'
  ) {
    let supersetCache: Cache | null = null;
    try {
      supersetCache = await caches.open(CACHE_KEY);
      const cachedResponse = await supersetCache.match(url);
      if (cachedResponse) {
        // if we have a cached response, send its ETag in the
        // `If-None-Match` header in a conditional request
        const etag = cachedResponse.headers.get('Etag') as string;
        request.headers = { ...request.headers, 'If-None-Match': etag };
      }
    } catch {
      // If superset is in an iframe and third-party cookies are disabled, caches.open throws
    }

    const response = await fetchWithRetry(url, request);

    if (supersetCache && response.status === HTTP_STATUS_NOT_MODIFIED) {
      const cachedFullResponse = await supersetCache.match(url);
      if (cachedFullResponse) {
        return cachedFullResponse.clone();
      }
      throw new Error('Received 304 but no content is cached!');
    }
    if (
      supersetCache &&
      response.status === HTTP_STATUS_OK &&
      response.headers.get('Etag')
    ) {
      supersetCache.delete(url);
      supersetCache.put(url, response.clone());
    }

    return response;
  }

  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    if (postPayload && jsonPayload) {
      throw new Error('Please provide only one of jsonPayload or postPayload');
    }
    if (postPayload instanceof FormData) {
      request.body = postPayload;
    } else if (postPayload) {
      const payload = tryParsePayload(postPayload);
      if (payload && typeof payload === 'object') {
        // using FormData has the effect that Content-Type header is set to `multipart/form-data`,
        // not e.g., 'application/x-www-form-urlencoded'
        const formData: FormData = new FormData();
        Object.keys(payload).forEach(key => {
          const value = (payload as JsonObject)[key] as JsonValue;
          if (typeof value !== 'undefined') {
            let valueString;
            try {
              // We have seen instances where casting to String() throws error
              // This check allows all valid attributes to be appended to the formData
              // while logging error to console for any attribute that fails the cast to String
              valueString = stringify ? JSON.stringify(value) : String(value);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error(
                `Unable to convert attribute '${key}' to a String(). '${key}' was not added to the formData in request.body for call to ${url}`,
                value,
                e,
              );
            }
            if (valueString !== undefined) {
              formData.append(key, valueString);
            }
          }
        });
        request.body = formData;
      }
    }
    if (jsonPayload !== undefined) {
      request.body = JSON.stringify(jsonPayload);
      request.headers = {
        ...request.headers,
        'Content-Type': 'application/json',
      };
    }
  }

  return fetchWithRetry(url, request);
}

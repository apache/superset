import 'whatwg-fetch';
import fetchRetry from 'fetch-retry';
import { CallApi, Payload, JsonValue, JsonObject } from '../types';
import { CACHE_AVAILABLE, CACHE_KEY, HTTP_STATUS_NOT_MODIFIED, HTTP_STATUS_OK } from '../constants';

function tryParsePayload(payload: Payload) {
  try {
    return typeof payload === 'string' ? (JSON.parse(payload) as JsonValue) : payload;
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
    const search = params instanceof URLSearchParams ? params : new URLSearchParams(params);
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
    (window.location && window.location.protocol) === 'https:'
  ) {
    const supersetCache = await caches.open(CACHE_KEY);
    const cachedResponse = await supersetCache.match(url);
    if (cachedResponse) {
      // if we have a cached response, send its ETag in the
      // `If-None-Match` header in a conditional request
      const etag = cachedResponse.headers.get('Etag') as string;
      request.headers = { ...request.headers, 'If-None-Match': etag };
    }

    const response = await fetchWithRetry(url, request);

    if (response.status === HTTP_STATUS_NOT_MODIFIED) {
      const cachedFullResponse = await supersetCache.match(url);
      if (cachedFullResponse) {
        return cachedFullResponse.clone();
      }
      throw new Error('Received 304 but no content is cached!');
    }
    if (response.status === HTTP_STATUS_OK && response.headers.get('Etag')) {
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
            formData.append(key, stringify ? JSON.stringify(value) : String(value));
          }
        });
        request.body = formData;
      }
    }
    if (jsonPayload !== undefined) {
      request.body = JSON.stringify(jsonPayload);
      request.headers = { ...request.headers, 'Content-Type': 'application/json' };
    }
  }

  return fetchWithRetry(url, request);
}

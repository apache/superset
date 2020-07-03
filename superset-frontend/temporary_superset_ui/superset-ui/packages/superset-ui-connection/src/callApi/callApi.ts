import 'whatwg-fetch';
import fetchRetry from 'fetch-retry';
import { CallApi, JsonObject, JsonValue } from '../types';
import { CACHE_AVAILABLE, CACHE_KEY, HTTP_STATUS_NOT_MODIFIED, HTTP_STATUS_OK } from '../constants';

/**
 * Fetch an API response and returns the corresponding json.
 *
 * @param {Payload} postPayload payload to send as FormData in a post form
 * @param {Payload} jsonPayload json payload to post, will automatically add Content-Type header
 * @param {string} stringify whether to stringify field values when post as formData
 */
export default function callApi({
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
  url,
}: CallApi): Promise<Response> {
  const fetchWithRetry = fetchRetry(fetch, fetchRetryOptions);

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
    CACHE_AVAILABLE &&
    (self.location && self.location.protocol) === 'https:'
  ) {
    return caches.open(CACHE_KEY).then(supersetCache =>
      supersetCache
        .match(url)
        .then(cachedResponse => {
          if (cachedResponse) {
            // if we have a cached response, send its ETag in the
            // `If-None-Match` header in a conditional request
            const etag = cachedResponse.headers.get('Etag') as string;
            request.headers = { ...request.headers, 'If-None-Match': etag };
          }

          return fetchWithRetry(url, request);
        })
        .then(response => {
          if (response.status === HTTP_STATUS_NOT_MODIFIED) {
            return supersetCache.match(url).then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse.clone();
              }
              throw new Error('Received 304 but no content is cached!');
            });
          }
          if (response.status === HTTP_STATUS_OK && response.headers.get('Etag')) {
            supersetCache.delete(url);
            supersetCache.put(url, response.clone());
          }

          return response;
        }),
    );
  }

  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    const tryParsePayload = (payloadString: string) => {
      try {
        return JSON.parse(payloadString) as JsonObject;
      } catch (error) {
        throw new Error(`Invalid postPayload:\n\n${payloadString}`);
      }
    };

    // override request body with post payload
    const payload: JsonObject | undefined =
      typeof postPayload === 'string' ? tryParsePayload(postPayload) : postPayload;
    if (typeof payload === 'object') {
      // using FormData has the effect that Content-Type header is set to `multipart/form-data`,
      // not e.g., 'application/x-www-form-urlencoded'
      const formData: FormData = new FormData();
      Object.keys(payload).forEach(key => {
        const value = payload[key] as JsonValue;
        if (typeof value !== 'undefined') {
          formData.append(key, stringify ? JSON.stringify(value) : String(value));
        }
      });
      request.body = formData;
    } else if (jsonPayload !== undefined) {
      request.body = JSON.stringify(jsonPayload);
      request.headers = { ...request.headers, 'Content-Type': 'application/json' };
    }
  }

  return fetchWithRetry(url, request);
}

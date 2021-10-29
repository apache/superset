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
import fetchMock from 'fetch-mock';
import callApi from '@superset-ui/core/src/connection/callApi/callApi';
import * as constants from '@superset-ui/core/src/connection/constants';
import { CallApi, JsonObject } from '@superset-ui/core/src/connection/types';
import { DEFAULT_FETCH_RETRY_OPTIONS } from '@superset-ui/core/src/connection/constants';

import { LOGIN_GLOB } from '../fixtures/constants';

describe('callApi()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { result: '1234' });
  });

  afterAll(fetchMock.restore);

  const mockGetUrl = '/mock/get/url';
  const mockPostUrl = '/mock/post/url';
  const mockPutUrl = '/mock/put/url';
  const mockPatchUrl = '/mock/patch/url';
  const mockCacheUrl = '/mock/cache/url';
  const mockNotFound = '/mock/notfound';
  const mockErrorUrl = '/mock/error/url';
  const mock503 = '/mock/503';

  const mockGetPayload = { get: 'payload' };
  const mockPostPayload = { post: 'payload' };
  const mockPutPayload = { post: 'payload' };
  const mockPatchPayload = { post: 'payload' };
  const mockCachePayload = {
    status: 200,
    body: 'BODY',
    headers: { Etag: 'etag' },
  };
  const mockErrorPayload = { status: 500, statusText: 'Internal error' };

  fetchMock.get(mockGetUrl, mockGetPayload);
  fetchMock.post(mockPostUrl, mockPostPayload);
  fetchMock.put(mockPutUrl, mockPutPayload);
  fetchMock.patch(mockPatchUrl, mockPatchPayload);
  fetchMock.get(mockCacheUrl, mockCachePayload);
  fetchMock.get(mockNotFound, { status: 404 });
  fetchMock.get(mock503, { status: 503 });
  fetchMock.get(mockErrorUrl, () => Promise.reject(mockErrorPayload));

  afterEach(fetchMock.reset);

  describe('request config', () => {
    it('calls the right url with the specified method', async () => {
      expect.assertions(4);
      await Promise.all([
        callApi({ url: mockGetUrl, method: 'GET' }),
        callApi({ url: mockPostUrl, method: 'POST' }),
        callApi({ url: mockPutUrl, method: 'PUT' }),
        callApi({ url: mockPatchUrl, method: 'PATCH' }),
      ]);
      expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockPutUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockPatchUrl)).toHaveLength(1);
    });

    it('passes along mode, cache, credentials, headers, body, signal, and redirect parameters in the request', async () => {
      expect.assertions(8);
      const mockRequest: CallApi = {
        url: mockGetUrl,
        mode: 'cors',
        cache: 'default',
        credentials: 'include',
        headers: {
          custom: 'header',
        },
        redirect: 'follow',
        signal: undefined,
        body: 'BODY',
      };

      await callApi(mockRequest);
      const calls = fetchMock.calls(mockGetUrl);
      const fetchParams = calls[0][1];
      expect(calls).toHaveLength(1);
      expect(fetchParams.mode).toBe(mockRequest.mode);
      expect(fetchParams.cache).toBe(mockRequest.cache);
      expect(fetchParams.credentials).toBe(mockRequest.credentials);
      expect(fetchParams.headers).toEqual(
        expect.objectContaining(mockRequest.headers) as typeof fetchParams.headers,
      );
      expect(fetchParams.redirect).toBe(mockRequest.redirect);
      expect(fetchParams.signal).toBe(mockRequest.signal);
      expect(fetchParams.body).toBe(mockRequest.body);
    });
  });

  describe('POST requests', () => {
    it('encodes key,value pairs from postPayload', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 };

      await callApi({ url: mockPostUrl, method: 'POST', postPayload });
      const calls = fetchMock.calls(mockPostUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(body.get(key)).toBe(JSON.stringify(value));
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (POST)', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      await callApi({ url: mockPostUrl, method: 'POST', postPayload });
      const calls = fetchMock.calls(mockPostUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;
      expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
      expect(body.get('noValue')).toBeNull();
    });

    it('respects the stringify flag in POST requests', async () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      };

      expect.assertions(1 + 3 * Object.keys(postPayload).length);

      await Promise.all([
        callApi({ url: mockPostUrl, method: 'POST', postPayload }),
        callApi({ url: mockPostUrl, method: 'POST', postPayload, stringify: false }),
        callApi({ url: mockPostUrl, method: 'POST', jsonPayload: postPayload }),
      ]);
      const calls = fetchMock.calls(mockPostUrl);
      expect(calls).toHaveLength(3);

      const stringified = calls[0][1].body as FormData;
      const unstringified = calls[1][1].body as FormData;
      const jsonRequestBody = JSON.parse(calls[2][1].body as string) as JsonObject;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(stringified.get(key)).toBe(JSON.stringify(value));
        expect(unstringified.get(key)).toBe(String(value));
        expect(jsonRequestBody[key]).toEqual(value);
      });
    });
  });

  describe('PUT requests', () => {
    it('encodes key,value pairs from postPayload', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 };

      await callApi({ url: mockPutUrl, method: 'PUT', postPayload });
      const calls = fetchMock.calls(mockPutUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(body.get(key)).toBe(JSON.stringify(value));
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (PUT)', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      await callApi({ url: mockPutUrl, method: 'PUT', postPayload });
      const calls = fetchMock.calls(mockPutUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;
      expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
      expect(body.get('noValue')).toBeNull();
    });

    it('respects the stringify flag in PUT requests', async () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      };

      expect.assertions(1 + 2 * Object.keys(postPayload).length);

      await Promise.all([
        callApi({ url: mockPutUrl, method: 'PUT', postPayload }),
        callApi({ url: mockPutUrl, method: 'PUT', postPayload, stringify: false }),
      ]);
      const calls = fetchMock.calls(mockPutUrl);
      expect(calls).toHaveLength(2);

      const stringified = calls[0][1].body as FormData;
      const unstringified = calls[1][1].body as FormData;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(stringified.get(key)).toBe(JSON.stringify(value));
        expect(unstringified.get(key)).toBe(String(value));
      });
    });
  });

  describe('PATCH requests', () => {
    it('encodes key,value pairs from postPayload', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 };

      await callApi({ url: mockPatchUrl, method: 'PATCH', postPayload });
      const calls = fetchMock.calls(mockPatchUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(body.get(key)).toBe(JSON.stringify(value));
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (PATCH)', async () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      await callApi({ url: mockPatchUrl, method: 'PATCH', postPayload });
      const calls = fetchMock.calls(mockPatchUrl);
      expect(calls).toHaveLength(1);

      const fetchParams = calls[0][1];
      const body = fetchParams.body as FormData;
      expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
      expect(body.get('noValue')).toBeNull();
    });

    it('respects the stringify flag in PATCH requests', async () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      };

      expect.assertions(1 + 2 * Object.keys(postPayload).length);

      await Promise.all([
        callApi({ url: mockPatchUrl, method: 'PATCH', postPayload }),
        callApi({ url: mockPatchUrl, method: 'PATCH', postPayload, stringify: false }),
      ]);
      const calls = fetchMock.calls(mockPatchUrl);
      expect(calls).toHaveLength(2);

      const stringified = calls[0][1].body as FormData;
      const unstringified = calls[1][1].body as FormData;

      Object.entries(postPayload).forEach(([key, value]) => {
        expect(stringified.get(key)).toBe(JSON.stringify(value));
        expect(unstringified.get(key)).toBe(String(value));
      });
    });
  });

  describe('caching', () => {
    const origLocation = window.location;

    beforeAll(() => {
      Object.defineProperty(window, 'location', { value: {} });
    });

    afterAll(() => {
      Object.defineProperty(window, 'location', { value: origLocation });
    });

    beforeEach(async () => {
      window.location.protocol = 'https:';
      await caches.delete(constants.CACHE_KEY);
    });

    it('caches requests with ETags', async () => {
      expect.assertions(2);
      await callApi({ url: mockCacheUrl, method: 'GET' });
      const calls = fetchMock.calls(mockCacheUrl);
      expect(calls).toHaveLength(1);
      const supersetCache = await caches.open(constants.CACHE_KEY);
      const cachedResponse = await supersetCache.match(mockCacheUrl);
      expect(cachedResponse).toBeDefined();
    });

    it('will not use cache when running off an insecure connection', async () => {
      expect.assertions(2);
      window.location.protocol = 'http:';

      await callApi({ url: mockCacheUrl, method: 'GET' });
      const calls = fetchMock.calls(mockCacheUrl);
      expect(calls).toHaveLength(1);

      const supersetCache = await caches.open(constants.CACHE_KEY);
      const cachedResponse = await supersetCache.match(mockCacheUrl);
      expect(cachedResponse).toBeUndefined();
    });

    it('works when the Cache API is disabled', async () => {
      expect.assertions(5);
      // eslint-disable-next-line no-import-assign
      Object.defineProperty(constants, 'CACHE_AVAILABLE', { value: false });

      const firstResponse = await callApi({ url: mockCacheUrl, method: 'GET' });
      const calls = fetchMock.calls(mockCacheUrl);
      expect(calls).toHaveLength(1);
      const firstBody = await firstResponse.text();
      expect(firstBody).toEqual('BODY');

      const secondResponse = await callApi({ url: mockCacheUrl, method: 'GET' });
      const fetchParams = calls[1][1];
      expect(calls).toHaveLength(2);
      // second call should not have If-None-Match header
      expect(fetchParams.headers).toBeUndefined();
      const secondBody = await secondResponse.text();
      expect(secondBody).toEqual('BODY');

      // eslint-disable-next-line no-import-assign
      Object.defineProperty(constants, 'CACHE_AVAILABLE', { value: true });
    });

    it('sends known ETags in the If-None-Match header', async () => {
      expect.assertions(3);
      // first call sets the cache
      await callApi({ url: mockCacheUrl, method: 'GET' });
      const calls = fetchMock.calls(mockCacheUrl);
      expect(calls).toHaveLength(1);

      // second call sends the Etag in the If-None-Match header
      await callApi({ url: mockCacheUrl, method: 'GET' });
      const fetchParams = calls[1][1];
      const headers = { 'If-None-Match': 'etag' };
      expect(calls).toHaveLength(2);
      expect(fetchParams.headers).toEqual(
        expect.objectContaining(headers) as typeof fetchParams.headers,
      );
    });

    it('reuses cached responses on 304 status', async () => {
      expect.assertions(3);
      // first call sets the cache
      await callApi({ url: mockCacheUrl, method: 'GET' });
      const calls = fetchMock.calls(mockCacheUrl);
      expect(calls).toHaveLength(1);
      // second call reuses the cached payload on a 304
      const mockCachedPayload = { status: 304 };
      fetchMock.get(mockCacheUrl, mockCachedPayload, { overwriteRoutes: true });

      const secondResponse = await callApi({ url: mockCacheUrl, method: 'GET' });
      expect(calls).toHaveLength(2);
      const secondBody = await secondResponse.text();
      expect(secondBody).toEqual('BODY');
    });

    it('throws error when cache fails on 304', async () => {
      expect.assertions(2);

      // this should never happen, since a 304 is only returned if we have
      // the cached response and sent the If-None-Match header
      const mockUncachedUrl = '/mock/uncached/url';
      const mockCachedPayload = { status: 304 };
      let error;
      fetchMock.get(mockUncachedUrl, mockCachedPayload);

      try {
        await callApi({ url: mockUncachedUrl, method: 'GET' });
      } catch (err) {
        error = err;
      } finally {
        const calls = fetchMock.calls(mockUncachedUrl);
        expect(calls).toHaveLength(1);
        expect((error as { message: string }).message).toEqual(
          'Received 304 but no content is cached!',
        );
      }
    });

    it('returns original response if no Etag', async () => {
      expect.assertions(3);
      const url = mockGetUrl;
      const response = await callApi({ url, method: 'GET' });
      const calls = fetchMock.calls(url);
      expect(calls).toHaveLength(1);
      expect(response.status).toEqual(200);
      const body = await response.json();
      expect(body as typeof mockGetPayload).toEqual(mockGetPayload);
    });

    it('returns original response if status not 304 or 200', async () => {
      expect.assertions(2);
      const url = mockNotFound;
      const response = await callApi({ url, method: 'GET' });
      const calls = fetchMock.calls(url);
      expect(calls).toHaveLength(1);
      expect(response.status).toEqual(404);
    });
  });

  it('rejects after retrying thrice if the request throws', async () => {
    expect.assertions(3);
    let error;
    try {
      await callApi({
        fetchRetryOptions: DEFAULT_FETCH_RETRY_OPTIONS,
        url: mockErrorUrl,
        method: 'GET',
      });
    } catch (err) {
      error = err;
    } finally {
      const err = error as { status: number; statusText: string };
      expect(fetchMock.calls(mockErrorUrl)).toHaveLength(4);
      expect(err.status).toBe(mockErrorPayload.status);
      expect(err.statusText).toBe(mockErrorPayload.statusText);
    }
  });

  it('rejects without retries if the config is set to 0 retries', async () => {
    expect.assertions(3);
    let error;
    try {
      await callApi({
        fetchRetryOptions: { retries: 0 },
        url: mockErrorUrl,
        method: 'GET',
      });
    } catch (err) {
      error = err as { status: number; statusText: string };
    } finally {
      expect(fetchMock.calls(mockErrorUrl)).toHaveLength(1);
      expect(error?.status).toBe(mockErrorPayload.status);
      expect(error?.statusText).toBe(mockErrorPayload.statusText);
    }
  });

  it('rejects after retrying thrice if the request returns a 503', async () => {
    expect.assertions(2);
    const url = mock503;
    const response = await callApi({
      fetchRetryOptions: DEFAULT_FETCH_RETRY_OPTIONS,
      url,
      method: 'GET',
    });
    const calls = fetchMock.calls(url);
    expect(calls).toHaveLength(4);
    expect(response.status).toEqual(503);
  });

  it('invalid json for postPayload should thrown error', async () => {
    expect.assertions(2);
    let error;
    try {
      await callApi({
        url: mockPostUrl,
        method: 'POST',
        postPayload: 'haha',
      });
    } catch (err) {
      error = err;
    } finally {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toEqual('Invalid payload:\n\nhaha');
    }
  });

  it('should accept search params object', async () => {
    expect.assertions(3);
    window.location.href = 'http://localhost';
    fetchMock.get(`glob:*/get-search*`, { yes: 'ok' });
    const response = await callApi({
      url: '/get-search',
      searchParams: {
        abc: 1,
      },
      method: 'GET',
    });
    const result = await response.json();
    expect(response.status).toEqual(200);
    expect(result).toEqual({ yes: 'ok' });
    expect(fetchMock.lastUrl()).toEqual(`http://localhost/get-search?abc=1`);
  });

  it('should accept URLSearchParams', async () => {
    expect.assertions(2);
    window.location.href = 'http://localhost';
    fetchMock.post(`glob:*/post-search*`, { yes: 'ok' });
    await callApi({
      url: '/post-search',
      searchParams: new URLSearchParams({
        abc: '1',
      }),
      method: 'POST',
      jsonPayload: { request: 'ok' },
    });
    expect(fetchMock.lastUrl()).toEqual(`http://localhost/post-search?abc=1`);
    expect(fetchMock.lastOptions()).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ request: 'ok' }),
      }),
    );
  });

  it('should throw when both payloads provided', async () => {
    expect.assertions(1);
    fetchMock.post('/post-both-payload', {});

    let error;
    try {
      await callApi({
        url: '/post-both-payload',
        method: 'POST',
        postPayload: { a: 1 },
        jsonPayload: '{}',
      });
    } catch (err) {
      error = err;
    } finally {
      expect((error as Error).message).toContain('provide only one of jsonPayload or postPayload');
    }
  });

  it('should accept FormData as postPayload', async () => {
    expect.assertions(1);
    fetchMock.post('/post-formdata', {});
    const payload = new FormData();
    await callApi({
      url: '/post-formdata',
      method: 'POST',
      postPayload: payload,
    });
    expect(fetchMock.lastOptions().body).toBe(payload);
  });

  it('should ignore "null" postPayload string', async () => {
    expect.assertions(1);
    fetchMock.post('/post-null-postpayload', {});
    await callApi({
      url: '/post-formdata',
      method: 'POST',
      postPayload: 'null',
    });
    expect(fetchMock.lastOptions().body).toBeUndefined();
  });
});

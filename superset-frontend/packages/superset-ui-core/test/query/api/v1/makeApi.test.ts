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
import {
  JsonValue,
  SupersetClientClass,
} from '@superset-ui/core/src/connection';
import { makeApi, SupersetApiError } from '@superset-ui/core/src/query';
import setupClientForTest from '../setupClientForTest';

describe('makeApi()', () => {
  beforeAll(setupClientForTest);
  afterEach(fetchMock.restore);

  it('should expose method and endpoint', () => {
    const api = makeApi({
      method: 'GET',
      endpoint: '/test',
    });
    expect(api.method).toEqual('GET');
    expect(api.endpoint).toEqual('/test');
    expect(api.requestType).toEqual('search');
  });

  it('should allow custom client', async () => {
    expect.assertions(2);
    const api = makeApi({
      method: 'GET',
      endpoint: '/test-custom-client',
    });
    const client = new SupersetClientClass({ baseUrl: 'http://foo/' });
    const mockResponse = { yes: 'ok' };
    const mockRequest = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    Object.assign(client, {
      request: mockRequest,
    });
    const result = await api(null, { client });
    expect(result).toEqual(mockResponse);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('should obtain json response by default', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'GET',
      endpoint: '/test',
    });
    fetchMock.get('glob:*/test', { yes: 'ok' });
    expect(await api({})).toEqual({ yes: 'ok' });
  });

  it('should allow custom parseResponse', async () => {
    expect.assertions(2);
    const responseJson = { items: [1, 2, 3] };
    fetchMock.post('glob:*/test', responseJson);
    const api = makeApi({
      method: 'POST',
      endpoint: '/test',
      processResponse: (json: typeof responseJson) =>
        json.items.reduce((a: number, b: number) => a + b),
    });
    expect(api.method).toEqual('POST');
    expect(await api({})).toBe(6);
  });

  it('should post FormData when requestType=form', async () => {
    expect.assertions(3);
    const api = makeApi({
      method: 'POST',
      endpoint: '/test-formdata',
      requestType: 'form',
    });
    fetchMock.post('glob:*/test-formdata', { test: 'ok' });

    expect(await api({ request: 'test' })).toEqual({ test: 'ok' });

    const expected = new FormData();
    expected.append('request', JSON.stringify('test'));
    const received = fetchMock.lastOptions().body as FormData;

    expect(received).toBeInstanceOf(FormData);
    expect(received.get('request')).toEqual(expected.get('request'));
  });

  it('should use searchParams for method=GET (`requestType=search` implied)', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'GET',
      endpoint: '/test-get-search',
    });
    fetchMock.get('glob:*/test-get-search*', { search: 'get' });
    await api({ p1: 1, p2: 2, p3: [1, 2] });
    expect(fetchMock.lastUrl()).toContain(
      '/test-get-search?p1=1&p2=2&p3=1%2C2',
    );
  });

  it('should serialize rison for method=GET, requestType=rison', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'GET',
      endpoint: '/test-post-search',
      requestType: 'rison',
    });
    fetchMock.get('glob:*/test-post-search*', { rison: 'get' });
    await api({ p1: 1, p3: [1, 2] });
    expect(fetchMock.lastUrl()).toContain(
      '/test-post-search?q=(p1:1,p3:!(1,2))',
    );
  });

  it('should use searchParams for method=POST, requestType=search', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'POST',
      endpoint: '/test-post-search',
      requestType: 'search',
    });
    fetchMock.post('glob:*/test-post-search*', { search: 'post' });
    await api({ p1: 1, p3: [1, 2] });
    expect(fetchMock.lastUrl()).toContain('/test-post-search?p1=1&p3=1%2C2');
  });

  it('should throw when requestType is invalid', () => {
    expect(() => {
      makeApi({
        method: 'POST',
        endpoint: '/test-formdata',
        // @ts-ignore
        requestType: 'text',
      });
    }).toThrow('Invalid request payload type');
  });

  it('should handle errors', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'POST',
      endpoint: '/test-formdata',
      requestType: 'form',
    });
    let error;

    fetchMock.post('glob:*/test-formdata', { test: 'ok' });

    try {
      await api('<This is an invalid JSON string>');
    } catch (err) {
      error = err;
    } finally {
      expect((error as SupersetApiError).message).toContain('Invalid payload');
    }
  });

  it('should handle error on 200 response', async () => {
    expect.assertions(1);
    const api = makeApi({
      method: 'POST',
      endpoint: '/test-200-error',
      requestType: 'json',
    });
    fetchMock.post('glob:*/test-200-error', { error: 'not ok' });

    let error;
    try {
      await api({});
    } catch (err) {
      error = err;
    } finally {
      expect((error as SupersetApiError).message).toContain('not ok');
    }
  });

  it('should parse text response when responseType=text', async () => {
    expect.assertions(1);
    const api = makeApi<JsonValue, string, 'text'>({
      method: 'PUT',
      endpoint: '/test-parse-text',
      requestType: 'form',
      responseType: 'text',
      processResponse: text => `${text}?`,
    });
    fetchMock.put('glob:*/test-parse-text', 'ok');
    const result = await api({ field1: 11 });
    expect(result).toBe('ok?');
  });

  it('should return raw resposnse when responseType=raw', async () => {
    expect.assertions(2);
    const api = makeApi<JsonValue, number, 'raw'>({
      method: 'DELETE',
      endpoint: '/test-raw-response',
      responseType: 'raw',
      processResponse: response => response.status,
    });
    fetchMock.delete('glob:*/test-raw-response?*', 'ok');
    const result = await api({ field1: 11 }, {});
    expect(result).toEqual(200);
    expect(fetchMock.lastUrl()).toContain('/test-raw-response?field1=11');
  });
});

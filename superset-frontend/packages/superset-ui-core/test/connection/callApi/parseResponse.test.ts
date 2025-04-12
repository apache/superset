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
import callApi from '../../../src/connection/callApi/callApi';
import parseResponse from '../../../src/connection/callApi/parseResponse';

import { LOGIN_GLOB } from '../fixtures/constants';

describe('parseResponse()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { result: '1234' });
  });

  afterAll(() => fetchMock.restore());

  const mockGetUrl = '/mock/get/url';
  const mockPostUrl = '/mock/post/url';
  const mockErrorUrl = '/mock/error/url';
  const mockNoParseUrl = '/mock/noparse/url';

  const mockGetPayload = { get: 'payload' };
  const mockPostPayload = { post: 'payload' };
  const mockErrorPayload = { status: 500, statusText: 'Internal error' };

  beforeEach(() => {
    fetchMock.get(mockGetUrl, mockGetPayload);
    fetchMock.post(mockPostUrl, mockPostPayload);
    fetchMock.get(mockErrorUrl, () => Promise.reject(mockErrorPayload));
    fetchMock.get(mockNoParseUrl, new Response('test response'));
  });

  afterEach(() => fetchMock.reset());

  it('returns a Promise', () => {
    const apiPromise = callApi({ url: mockGetUrl, method: 'GET' });
    const parsedResponsePromise = parseResponse(apiPromise);
    expect(parsedResponsePromise).toBeInstanceOf(Promise);
  });

  it('resolves to { json, response } if the request succeeds', async () => {
    expect.assertions(4);
    const args = await parseResponse(
      callApi({ url: mockGetUrl, method: 'GET' }),
    );
    expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
    const keys = Object.keys(args);
    expect(keys).toContain('response');
    expect(keys).toContain('json');
    expect(args.json).toEqual(
      expect.objectContaining(mockGetPayload) as typeof args.json,
    );
  });

  it('throws if `parseMethod=json` and .json() fails', async () => {
    expect.assertions(3);

    const mockTextUrl = '/mock/text/url';
    const mockTextResponse =
      '<html><head></head><body>I could be a stack trace or something</body></html>';
    fetchMock.get(mockTextUrl, mockTextResponse);

    let error;
    try {
      await parseResponse(callApi({ url: mockTextUrl, method: 'GET' }));
    } catch (err) {
      error = err as Error;
    } finally {
      expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
      expect(error?.stack).toBeDefined();
      expect(error?.message).toContain('Unexpected token');
    }
  });

  it('resolves to { text, response } if the `parseMethod=text`', async () => {
    expect.assertions(4);

    // test with json + bigint to ensure that it was not first parsed as json
    const mockTextParseUrl = '/mock/textparse/url';
    const mockTextJsonResponse = '{ "value": 9223372036854775807 }';
    fetchMock.get(mockTextParseUrl, mockTextJsonResponse);

    const args = await parseResponse(
      callApi({ url: mockTextParseUrl, method: 'GET' }),
      'text',
    );
    expect(fetchMock.calls(mockTextParseUrl)).toHaveLength(1);
    const keys = Object.keys(args);
    expect(keys).toContain('response');
    expect(keys).toContain('text');
    expect(args.text).toBe(mockTextJsonResponse);
  });

  it('throws if parseMethod is not null|json|text', async () => {
    expect.assertions(1);

    let error;
    try {
      await parseResponse(
        callApi({ url: mockNoParseUrl, method: 'GET' }),
        'something-else' as never,
      );
    } catch (err) {
      error = err;
    } finally {
      expect(error.message).toEqual(
        expect.stringContaining('Expected parseResponse=json'),
      );
    }
  });

  it('resolves to unmodified `Response` object if `parseMethod=null|raw`', async () => {
    expect.assertions(3);
    const responseNull = await parseResponse(
      callApi({ url: mockNoParseUrl, method: 'GET' }),
      null,
    );
    const responseRaw = await parseResponse(
      callApi({ url: mockNoParseUrl, method: 'GET' }),
      'raw',
    );
    expect(fetchMock.calls(mockNoParseUrl)).toHaveLength(2);
    expect(responseNull.bodyUsed).toBe(false);
    expect(responseRaw.bodyUsed).toBe(false);
  });

  it('resolves to big number value if `parseMethod=json-bigint`', async () => {
    const mockBigIntUrl = '/mock/get/bigInt';
    const mockGetBigIntPayload = `{
      "value": 9223372036854775807, "minus": { "value": -483729382918228373892, "str": "something" },
      "number": 1234, "floatValue": { "plus": 0.3452211361231223, "minus": -0.3452211361231223 },
      "string.constructor": "data.constructor",
      "constructor": "constructor"
    }`;
    fetchMock.get(mockBigIntUrl, mockGetBigIntPayload);
    const responseBigNumber = await parseResponse(
      callApi({ url: mockBigIntUrl, method: 'GET' }),
      'json-bigint',
    );
    expect(`${responseBigNumber.json.value}`).toEqual('9223372036854775807');
    expect(`${responseBigNumber.json.minus.value}`).toEqual(
      '-483729382918228373892',
    );
    expect(responseBigNumber.json.number).toEqual(1234);
    expect(responseBigNumber.json.floatValue.plus).toEqual(0.3452211361231223);
    expect(responseBigNumber.json.floatValue.minus).toEqual(
      -0.3452211361231223,
    );
    expect(
      responseBigNumber.json.floatValue.plus +
        responseBigNumber.json.floatValue.minus,
    ).toEqual(0);
    expect(
      responseBigNumber.json.floatValue.plus /
        responseBigNumber.json.floatValue.minus,
    ).toEqual(-1);
    expect(Math.min(responseBigNumber.json.floatValue.plus, 0)).toEqual(0);
    expect(Math.abs(responseBigNumber.json.floatValue.minus)).toEqual(
      responseBigNumber.json.floatValue.plus,
    );
    expect(responseBigNumber.json['string.constructor']).toEqual(
      'data.constructor',
    );
    expect(responseBigNumber.json.constructor).toEqual('constructor');
  });

  it('rejects if request.ok=false', async () => {
    expect.assertions(3);
    const mockNotOkayUrl = '/mock/notokay/url';
    fetchMock.get(mockNotOkayUrl, 404); // 404s result in not response.ok=false

    const apiPromise = callApi({ url: mockNotOkayUrl, method: 'GET' });

    let error;
    try {
      await parseResponse(apiPromise);
    } catch (err) {
      error = err as { ok: boolean; status: number };
    } finally {
      expect(fetchMock.calls(mockNotOkayUrl)).toHaveLength(1);
      expect(error?.ok).toBe(false);
      expect(error?.status).toBe(404);
    }
  });
});

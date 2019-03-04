/* eslint promise/no-callback-in-promise: 'off' */
import fetchMock from 'fetch-mock';
import callApi from '../../src/callApi/callApi';

import { LOGIN_GLOB } from '../fixtures/constants';
import throwIfCalled from '../utils/throwIfCalled';
import { CallApi } from '../../src/types';

describe('callApi()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
  });

  afterAll(fetchMock.restore);

  const mockGetUrl = '/mock/get/url';
  const mockPostUrl = '/mock/post/url';
  const mockPutUrl = '/mock/put/url';
  const mockPatchUrl = '/mock/patch/url';

  const mockGetPayload = { get: 'payload' };
  const mockPostPayload = { post: 'payload' };
  const mockPutPayload = { post: 'payload' };
  const mockPatchPayload = { post: 'payload' };

  fetchMock.get(mockGetUrl, mockGetPayload);
  fetchMock.post(mockPostUrl, mockPostPayload);
  fetchMock.put(mockPutUrl, mockPutPayload);
  fetchMock.patch(mockPatchUrl, mockPatchPayload);

  afterEach(fetchMock.reset);

  describe('request config', () => {
    it('calls the right url with the specified method', () => {
      expect.assertions(4);

      return Promise.all([
        callApi({ url: mockGetUrl, method: 'GET' }),
        callApi({ url: mockPostUrl, method: 'POST' }),
        callApi({ url: mockPutUrl, method: 'PUT' }),
        callApi({ url: mockPatchUrl, method: 'PATCH' }),
      ]).then(() => {
        expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
        expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
        expect(fetchMock.calls(mockPutUrl)).toHaveLength(1);
        expect(fetchMock.calls(mockPatchUrl)).toHaveLength(1);

        return Promise.resolve();
      });
    });

    it('passes along mode, cache, credentials, headers, body, signal, and redirect parameters in the request', () => {
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

      return callApi(mockRequest).then(() => {
        const calls = fetchMock.calls(mockGetUrl);
        const fetchParams = calls[0][1];
        expect(calls).toHaveLength(1);
        expect(fetchParams.mode).toBe(mockRequest.mode);
        expect(fetchParams.cache).toBe(mockRequest.cache);
        expect(fetchParams.credentials).toBe(mockRequest.credentials);
        expect(fetchParams.headers).toEqual(expect.objectContaining(mockRequest.headers as Object));
        expect(fetchParams.redirect).toBe(mockRequest.redirect);
        expect(fetchParams.signal).toBe(mockRequest.signal);
        expect(fetchParams.body).toBe(mockRequest.body);

        return Promise.resolve();
      });
    });
  });

  describe('POST requests', () => {
    it('encodes key,value pairs from postPayload', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 } as any;

      return callApi({ url: mockPostUrl, method: 'POST', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(body.get(key)).toBe(JSON.stringify(postPayload[key]));
        });

        return Promise.resolve();
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (POST)', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      return callApi({ url: mockPostUrl, method: 'POST', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;
        expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
        expect(body.get('noValue')).toBeNull();

        return Promise.resolve();
      });
    });

    it('respects the stringify flag in POST requests', () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      } as any;

      expect.assertions(1 + 2 * Object.keys(postPayload).length);

      return Promise.all([
        callApi({ url: mockPostUrl, method: 'POST', postPayload }),
        callApi({ url: mockPostUrl, method: 'POST', postPayload, stringify: false }),
      ]).then(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).toHaveLength(2);

        const stringified = calls[0][1].body as FormData;
        const unstringified = calls[1][1].body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(stringified.get(key)).toBe(JSON.stringify(postPayload[key]));
          expect(unstringified.get(key)).toBe(String(postPayload[key]));
        });

        return Promise.resolve();
      });
    });
  });

  describe('PUT requests', () => {
    it('encodes key,value pairs from postPayload', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 } as any;

      return callApi({ url: mockPutUrl, method: 'PUT', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPutUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(body.get(key)).toBe(JSON.stringify(postPayload[key]));
        });

        return Promise.resolve();
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (PUT)', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      return callApi({ url: mockPutUrl, method: 'PUT', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPutUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;
        expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
        expect(body.get('noValue')).toBeNull();

        return Promise.resolve();
      });
    });

    it('respects the stringify flag in PUT requests', () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      } as any;

      expect.assertions(1 + 2 * Object.keys(postPayload).length);

      return Promise.all([
        callApi({ url: mockPutUrl, method: 'PUT', postPayload }),
        callApi({ url: mockPutUrl, method: 'PUT', postPayload, stringify: false }),
      ]).then(() => {
        const calls = fetchMock.calls(mockPutUrl);
        expect(calls).toHaveLength(2);

        const stringified = calls[0][1].body as FormData;
        const unstringified = calls[1][1].body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(stringified.get(key)).toBe(JSON.stringify(postPayload[key]));
          expect(unstringified.get(key)).toBe(String(postPayload[key]));
        });

        return Promise.resolve();
      });
    });
  });

  describe('PATCH requests', () => {
    it('encodes key,value pairs from postPayload', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', anotherKey: 1237 } as any;

      return callApi({ url: mockPatchUrl, method: 'PATCH', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPatchUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(body.get(key)).toBe(JSON.stringify(postPayload[key]));
        });

        return Promise.resolve();
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values (PATCH)', () => {
      expect.assertions(3);
      const postPayload = { key: 'value', noValue: undefined };

      return callApi({ url: mockPatchUrl, method: 'PATCH', postPayload }).then(() => {
        const calls = fetchMock.calls(mockPatchUrl);
        expect(calls).toHaveLength(1);

        const fetchParams = calls[0][1];
        const body = fetchParams.body as FormData;
        expect(body.get('key')).toBe(JSON.stringify(postPayload.key));
        expect(body.get('noValue')).toBeNull();

        return Promise.resolve();
      });
    });

    it('respects the stringify flag in PATCH requests', () => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      } as any;

      expect.assertions(1 + 2 * Object.keys(postPayload).length);

      return Promise.all([
        callApi({ url: mockPatchUrl, method: 'PATCH', postPayload }),
        callApi({ url: mockPatchUrl, method: 'PATCH', postPayload, stringify: false }),
      ]).then(() => {
        const calls = fetchMock.calls(mockPatchUrl);
        expect(calls).toHaveLength(2);

        const stringified = calls[0][1].body as FormData;
        const unstringified = calls[1][1].body as FormData;

        Object.keys(postPayload).forEach(key => {
          expect(stringified.get(key)).toBe(JSON.stringify(postPayload[key]));
          expect(unstringified.get(key)).toBe(String(postPayload[key]));
        });

        return Promise.resolve();
      });
    });
  });

  it('rejects if the request throws', () => {
    const mockErrorUrl = '/mock/error/url';
    const mockErrorPayload = { status: 500, statusText: 'Internal error' };
    fetchMock.get(mockErrorUrl, () => Promise.reject(mockErrorPayload));

    expect.assertions(3);

    return callApi({ url: mockErrorUrl, method: 'GET' })
      .then(throwIfCalled)
      .catch(error => {
        expect(fetchMock.calls(mockErrorUrl)).toHaveLength(1);
        expect(error.status).toBe(mockErrorPayload.status);
        expect(error.statusText).toBe(mockErrorPayload.statusText);
      });
  });
});

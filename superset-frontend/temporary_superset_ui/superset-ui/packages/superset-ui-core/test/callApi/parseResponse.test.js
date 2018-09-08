/* eslint promise/no-callback-in-promise: 'off' */
import fetchMock from 'fetch-mock';
import callApi from '../../src/callApi/callApi';
import parseResponse from '../../src/callApi/parseResponse';

import { LOGIN_GLOB } from '../fixtures/constants';
import throwIfCalled from '../utils/throwIfCalled';

describe('parseResponse()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
  });

  afterAll(fetchMock.restore);

  const mockGetUrl = '/mock/get/url';
  const mockPostUrl = '/mock/post/url';
  const mockErrorUrl = '/mock/error/url';

  const mockGetPayload = { get: 'payload' };
  const mockPostPayload = { post: 'payload' };
  const mockErrorPayload = { status: 500, statusText: 'Internal error' };

  fetchMock.get(mockGetUrl, mockGetPayload);
  fetchMock.post(mockPostUrl, mockPostPayload);
  fetchMock.get(mockErrorUrl, () => Promise.reject(mockErrorPayload));

  afterEach(fetchMock.reset);

  it('returns a Promise', () => {
    const apiPromise = callApi({ url: mockGetUrl, method: 'GET' });
    const parsedResponsePromise = parseResponse(apiPromise);
    expect(parsedResponsePromise).toEqual(expect.any(Promise));
  });

  it('resolves to { json, response } if the request succeeds', done => {
    expect.assertions(3);
    const apiPromise = callApi({ url: mockGetUrl, method: 'GET' });

    parseResponse(apiPromise)
      .then(args => {
        expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
        expect(Object.keys(args)).toEqual(expect.arrayContaining(['response', 'json']));
        expect(args.json).toEqual(expect.objectContaining(mockGetPayload));

        return done();
      })
      .catch(throwIfCalled);
  });

  it('resolves to { text, response } if the request succeeds with text response', done => {
    expect.assertions(3);

    const mockTextUrl = '/mock/text/url';
    const mockTextResponse =
      '<html><head></head><body>I could be a stack trace or something</body></html>';
    fetchMock.get(mockTextUrl, mockTextResponse);

    const apiPromise = callApi({ url: mockTextUrl, method: 'GET' });
    parseResponse(apiPromise)
      .then(args => {
        expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
        expect(Object.keys(args)).toEqual(expect.arrayContaining(['response', 'text']));
        expect(args.text).toBe(mockTextResponse);

        return done();
      })
      .catch(throwIfCalled);
  });

  it('rejects if the request throws', done => {
    expect.assertions(3);

    callApi({ url: mockErrorUrl, method: 'GET' })
      .then(throwIfCalled)
      .catch(error => {
        expect(fetchMock.calls(mockErrorUrl)).toHaveLength(1);
        expect(error.status).toBe(mockErrorPayload.status);
        expect(error.statusText).toBe(mockErrorPayload.statusText);

        return done();
      });
  });
});

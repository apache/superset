import fetchMock from 'fetch-mock';
import callApi from '../../src/callApi/callApi';
import parseResponse from '../../src/callApi/parseResponse';

import { LOGIN_GLOB } from '../fixtures/constants';
import throwIfCalled from '../utils/throwIfCalled';
import { SupersetClientResponse } from '../../src';

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

  it('resolves to { json, response } if the request succeeds', () => {
    expect.assertions(3);
    const apiPromise = callApi({ url: mockGetUrl, method: 'GET' });

    return parseResponse(apiPromise).then(args => {
      expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
      expect(Object.keys(args)).toEqual(expect.arrayContaining(['response', 'json']));
      expect(args.json).toEqual(expect.objectContaining(mockGetPayload));

      return Promise.resolve();
    });
  });

  it('throws if `parseMethod=json` and .json() fails', () => {
    expect.assertions(3);

    const mockTextUrl = '/mock/text/url';
    const mockTextResponse =
      '<html><head></head><body>I could be a stack trace or something</body></html>';
    fetchMock.get(mockTextUrl, mockTextResponse);

    const apiPromise = callApi({ url: mockTextUrl, method: 'GET' });

    return parseResponse(apiPromise, 'json')
      .then(throwIfCalled)
      .catch(error => {
        expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
        expect(error.stack).toBeDefined();
        expect(error.message.includes('Unexpected token')).toBe(true);

        return Promise.resolve();
      });
  });

  it('resolves to { text, response } if the `parseMethod=text`', () => {
    expect.assertions(3);

    // test with json + bigint to ensure that it was not first parsed as json
    const mockTextParseUrl = '/mock/textparse/url';
    const mockTextJsonResponse = '{ "value": 9223372036854775807 }';
    fetchMock.get(mockTextParseUrl, mockTextJsonResponse);

    const apiPromise = callApi({ url: mockTextParseUrl, method: 'GET' });

    return parseResponse(apiPromise, 'text').then(args => {
      expect(fetchMock.calls(mockTextParseUrl)).toHaveLength(1);
      expect(Object.keys(args)).toEqual(expect.arrayContaining(['response', 'text']));
      expect(args.text).toBe(mockTextJsonResponse);

      return Promise.resolve();
    });
  });

  it('resolves to the unmodified `Response` object if `parseMethod=null`', () => {
    expect.assertions(2);

    const mockNoParseUrl = '/mock/noparse/url';
    const mockResponse = new Response('test response');
    fetchMock.get(mockNoParseUrl, mockResponse);

    const apiPromise = callApi({ url: mockNoParseUrl, method: 'GET' });

    return parseResponse(apiPromise, null).then((clientResponse: SupersetClientResponse) => {
      const response = clientResponse as Response;
      expect(fetchMock.calls(mockNoParseUrl)).toHaveLength(1);
      expect(response.bodyUsed).toBe(false);

      return Promise.resolve();
    });
  });

  it('rejects if request.ok=false', () => {
    const mockNotOkayUrl = '/mock/notokay/url';
    fetchMock.get(mockNotOkayUrl, 404); // 404s result in not response.ok=false

    expect.assertions(3);
    const apiPromise = callApi({ url: mockNotOkayUrl, method: 'GET' });

    return parseResponse(apiPromise)
      .then(throwIfCalled)
      .catch(response => {
        expect(fetchMock.calls(mockNotOkayUrl)).toHaveLength(1);
        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
      });
  });
});

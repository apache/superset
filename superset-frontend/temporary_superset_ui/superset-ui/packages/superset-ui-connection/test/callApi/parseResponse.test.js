import fetchMock from 'fetch-mock';
import callApi from '../../src/callApi/callApi';
import parseResponse from '../../src/callApi/parseResponse';

import { LOGIN_GLOB } from '../fixtures/constants';

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

  it('throw errors if parseMethod is not null|json|text', () => {
    const mockNoParseUrl = '/mock/noparse/url';
    const mockResponse = new Response('test response');
    fetchMock.get(mockNoParseUrl, mockResponse);

    const apiPromise = callApi({ url: mockNoParseUrl, method: 'GET' });

    expect(() => parseResponse(apiPromise, 'something-else')).toThrow();
  });
});

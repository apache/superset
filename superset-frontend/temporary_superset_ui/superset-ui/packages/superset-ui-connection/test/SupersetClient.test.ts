import fetchMock from 'fetch-mock';

import { SupersetClient, SupersetClientClass } from '../src';
import { LOGIN_GLOB } from './fixtures/constants';

describe('SupersetClient', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '' });
  });

  afterAll(fetchMock.restore);

  afterEach(SupersetClient.reset);

  it('exposes reset, configure, init, get, post, isAuthenticated, and reAuthenticate methods', () => {
    expect(SupersetClient.configure).toEqual(expect.any(Function));
    expect(SupersetClient.init).toEqual(expect.any(Function));
    expect(SupersetClient.get).toEqual(expect.any(Function));
    expect(SupersetClient.post).toEqual(expect.any(Function));
    expect(SupersetClient.isAuthenticated).toEqual(expect.any(Function));
    expect(SupersetClient.reAuthenticate).toEqual(expect.any(Function));
    expect(SupersetClient.request).toEqual(expect.any(Function));
    expect(SupersetClient.reset).toEqual(expect.any(Function));
  });

  it('throws if you call init, get, post, isAuthenticated, or reAuthenticate before configure', () => {
    expect(SupersetClient.init).toThrow();
    expect(SupersetClient.get).toThrow();
    expect(SupersetClient.post).toThrow();
    expect(SupersetClient.isAuthenticated).toThrow();
    expect(SupersetClient.reAuthenticate).toThrow();
    expect(SupersetClient.request).toThrow();

    expect(SupersetClient.configure).not.toThrow();
  });

  // this also tests that the ^above doesn't throw if configure is called appropriately
  it('calls appropriate SupersetClient methods when configured', () => {
    const mockGetUrl = '/mock/get/url';
    const mockPostUrl = '/mock/post/url';
    const mockRequestUrl = '/mock/request/url';
    const mockPutUrl = '/mock/put/url';
    const mockDeleteUrl = '/mock/delete/url';
    const mockGetPayload = { get: 'payload' };
    const mockPostPayload = { post: 'payload' };
    fetchMock.get(mockGetUrl, mockGetPayload);
    fetchMock.post(mockPostUrl, mockPostPayload);

    const initSpy = jest.spyOn(SupersetClientClass.prototype, 'init');
    const getSpy = jest.spyOn(SupersetClientClass.prototype, 'get');
    const postSpy = jest.spyOn(SupersetClientClass.prototype, 'post');
    const putSpy = jest.spyOn(SupersetClientClass.prototype, 'put');
    const deleteSpy = jest.spyOn(SupersetClientClass.prototype, 'delete');
    const authenticatedSpy = jest.spyOn(SupersetClientClass.prototype, 'isAuthenticated');
    const csrfSpy = jest.spyOn(SupersetClientClass.prototype, 'getCSRFToken');
    const requestSpy = jest.spyOn(SupersetClientClass.prototype, 'request');

    SupersetClient.configure({});
    SupersetClient.init();

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(authenticatedSpy).toHaveBeenCalledTimes(1);
    expect(csrfSpy).toHaveBeenCalledTimes(1);

    SupersetClient.get({ url: mockGetUrl });
    SupersetClient.post({ url: mockPostUrl });
    SupersetClient.delete({ url: mockDeleteUrl });
    SupersetClient.put({ url: mockPutUrl });
    SupersetClient.request({ url: mockRequestUrl });
    SupersetClient.isAuthenticated();
    SupersetClient.reAuthenticate();

    expect(initSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledTimes(5); // request rewires to get
    expect(csrfSpy).toHaveBeenCalledTimes(2); // from init() + reAuthenticate()

    initSpy.mockRestore();
    getSpy.mockRestore();
    putSpy.mockRestore();
    deleteSpy.mockRestore();
    requestSpy.mockRestore();
    postSpy.mockRestore();
    authenticatedSpy.mockRestore();
    csrfSpy.mockRestore();

    fetchMock.reset();
  });
});

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
    expect(SupersetClient.reset).toEqual(expect.any(Function));
  });

  it('throws if you call init, get, post, isAuthenticated, or reAuthenticate before configure', () => {
    expect(SupersetClient.init).toThrow();
    expect(SupersetClient.get).toThrow();
    expect(SupersetClient.post).toThrow();
    expect(SupersetClient.isAuthenticated).toThrow();
    expect(SupersetClient.reAuthenticate).toThrow();

    expect(SupersetClient.configure).not.toThrow();
  });

  // this also tests that the ^above doesn't throw if configure is called appropriately
  it('calls appropriate SupersetClient methods when configured', () => {
    const mockGetUrl = '/mock/get/url';
    const mockPostUrl = '/mock/post/url';
    const mockGetPayload = { get: 'payload' };
    const mockPostPayload = { post: 'payload' };
    fetchMock.get(mockGetUrl, mockGetPayload);
    fetchMock.post(mockPostUrl, mockPostPayload);

    const initSpy = jest.spyOn(SupersetClientClass.prototype, 'init');
    const getSpy = jest.spyOn(SupersetClientClass.prototype, 'get');
    const postSpy = jest.spyOn(SupersetClientClass.prototype, 'post');
    const authenticatedSpy = jest.spyOn(SupersetClientClass.prototype, 'isAuthenticated');
    const csrfSpy = jest.spyOn(SupersetClientClass.prototype, 'getCSRFToken');

    SupersetClient.configure({});
    SupersetClient.init();

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(authenticatedSpy).toHaveBeenCalledTimes(1);
    expect(csrfSpy).toHaveBeenCalledTimes(1);

    SupersetClient.get({ url: mockGetUrl });
    SupersetClient.post({ url: mockPostUrl });
    SupersetClient.isAuthenticated();
    SupersetClient.reAuthenticate();

    expect(initSpy).toHaveBeenCalledTimes(2);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(csrfSpy).toHaveBeenCalledTimes(2); // from init() + reAuthenticate()

    initSpy.mockRestore();
    getSpy.mockRestore();
    postSpy.mockRestore();
    authenticatedSpy.mockRestore();
    csrfSpy.mockRestore();

    fetchMock.reset();
  });
});

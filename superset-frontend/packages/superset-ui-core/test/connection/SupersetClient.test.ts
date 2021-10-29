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

import { SupersetClient, SupersetClientClass } from '@superset-ui/core/src/connection';
import { LOGIN_GLOB } from './fixtures/constants';

describe('SupersetClient', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { result: '' });
  });

  afterAll(fetchMock.restore);

  afterEach(SupersetClient.reset);

  it('exposes reset, configure, init, get, post, isAuthenticated, and reAuthenticate methods', () => {
    expect(typeof SupersetClient.configure).toBe('function');
    expect(typeof SupersetClient.init).toBe('function');
    expect(typeof SupersetClient.get).toBe('function');
    expect(typeof SupersetClient.post).toBe('function');
    expect(typeof SupersetClient.isAuthenticated).toBe('function');
    expect(typeof SupersetClient.reAuthenticate).toBe('function');
    expect(typeof SupersetClient.request).toBe('function');
    expect(typeof SupersetClient.reset).toBe('function');
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
  it('calls appropriate SupersetClient methods when configured', async () => {
    expect.assertions(10);
    const mockGetUrl = '/mock/get/url';
    const mockPostUrl = '/mock/post/url';
    const mockRequestUrl = '/mock/request/url';
    const mockPutUrl = '/mock/put/url';
    const mockDeleteUrl = '/mock/delete/url';
    const mockGetPayload = { get: 'payload' };
    const mockPostPayload = { post: 'payload' };
    const mockDeletePayload = { delete: 'ok' };
    const mockPutPayload = { put: 'ok' };
    fetchMock.get(mockGetUrl, mockGetPayload);
    fetchMock.post(mockPostUrl, mockPostPayload);
    fetchMock.delete(mockDeleteUrl, mockDeletePayload);
    fetchMock.put(mockPutUrl, mockPutPayload);
    fetchMock.get(mockRequestUrl, mockGetPayload);

    const initSpy = jest.spyOn(SupersetClientClass.prototype, 'init');
    const getSpy = jest.spyOn(SupersetClientClass.prototype, 'get');
    const postSpy = jest.spyOn(SupersetClientClass.prototype, 'post');
    const putSpy = jest.spyOn(SupersetClientClass.prototype, 'put');
    const deleteSpy = jest.spyOn(SupersetClientClass.prototype, 'delete');
    const authenticatedSpy = jest.spyOn(SupersetClientClass.prototype, 'isAuthenticated');
    const csrfSpy = jest.spyOn(SupersetClientClass.prototype, 'getCSRFToken');
    const requestSpy = jest.spyOn(SupersetClientClass.prototype, 'request');

    SupersetClient.configure({});
    await SupersetClient.init();

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(authenticatedSpy).toHaveBeenCalledTimes(2);
    expect(csrfSpy).toHaveBeenCalledTimes(1);

    await SupersetClient.get({ url: mockGetUrl });
    await SupersetClient.post({ url: mockPostUrl });
    await SupersetClient.delete({ url: mockDeleteUrl });
    await SupersetClient.put({ url: mockPutUrl });
    await SupersetClient.request({ url: mockRequestUrl });
    SupersetClient.isAuthenticated();
    await SupersetClient.reAuthenticate();

    expect(initSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledTimes(1);
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

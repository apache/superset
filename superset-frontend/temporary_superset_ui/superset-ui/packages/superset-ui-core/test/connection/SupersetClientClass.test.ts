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
import { SupersetClientClass, ClientConfig } from '@superset-ui/core/src/connection';
import { LOGIN_GLOB } from './fixtures/constants';

describe('SupersetClientClass', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { result: '' });
  });

  afterAll(fetchMock.restore);

  describe('new SupersetClientClass()', () => {
    it('fallback protocol to https when setting only host', () => {
      const client = new SupersetClientClass({ host: 'TEST-HOST' });
      expect(client.baseUrl).toEqual('https://test-host');
    });
  });

  describe('.getUrl()', () => {
    let client = new SupersetClientClass();

    beforeEach(() => {
      client = new SupersetClientClass({ protocol: 'https:', host: 'CONFIG_HOST' });
    });

    it('uses url if passed', () => {
      expect(client.getUrl({ url: 'myUrl', endpoint: 'blah', host: 'blah' })).toBe('myUrl');
    });

    it('constructs a valid url from config.protocol + host + endpoint if passed', () => {
      expect(client.getUrl({ endpoint: '/test', host: 'myhost' })).toBe('https://myhost/test');
      expect(client.getUrl({ endpoint: '/test', host: 'myhost/' })).toBe('https://myhost/test');
      expect(client.getUrl({ endpoint: 'test', host: 'myhost' })).toBe('https://myhost/test');
      expect(client.getUrl({ endpoint: '/test/test//', host: 'myhost/' })).toBe(
        'https://myhost/test/test//',
      );
    });

    it('constructs a valid url from config.host + endpoint if host is omitted', () => {
      expect(client.getUrl({ endpoint: '/test' })).toBe('https://config_host/test');
    });

    it('does not throw if url, endpoint, and host are all empty', () => {
      client = new SupersetClientClass({ protocol: 'https:', host: '' });
      expect(client.getUrl()).toBe('https://localhost/');
    });
  });

  describe('.init()', () => {
    afterEach(() => {
      fetchMock.reset();
      // reset
      fetchMock.get(LOGIN_GLOB, { result: 1234 }, { overwriteRoutes: true });
    });

    it('calls api/v1/security/csrf_token/ when init() is called if no CSRF token is passed', async () => {
      expect.assertions(1);
      await new SupersetClientClass().init();
      expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(1);
    });

    it('does NOT call api/v1/security/csrf_token/ when init() is called if a CSRF token is passed', async () => {
      expect.assertions(1);
      await new SupersetClientClass({ csrfToken: 'abc' }).init();
      expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(0);
    });

    it('calls api/v1/security/csrf_token/ when init(force=true) is called even if a CSRF token is passed', async () => {
      expect.assertions(4);
      const initialToken = 'initial_token';
      const client = new SupersetClientClass({ csrfToken: initialToken });

      await client.init();
      expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(0);
      expect(client.csrfToken).toBe(initialToken);

      await client.init(true);
      expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(1);
      expect(client.csrfToken).not.toBe(initialToken);
    });

    it('throws if api/v1/security/csrf_token/ returns an error', async () => {
      expect.assertions(1);
      const rejectError = { status: 403 };
      fetchMock.get(LOGIN_GLOB, () => Promise.reject(rejectError), {
        overwriteRoutes: true,
      });

      let error;
      try {
        await new SupersetClientClass({}).init();
      } catch (err) {
        error = err;
      } finally {
        expect(error as typeof rejectError).toEqual(rejectError);
      }
    });

    const invalidCsrfTokenError = { error: 'Failed to fetch CSRF token' };

    it('throws if api/v1/security/csrf_token/ does not return a token', async () => {
      expect.assertions(1);
      fetchMock.get(LOGIN_GLOB, {}, { overwriteRoutes: true });

      let error;
      try {
        await new SupersetClientClass({}).init();
      } catch (err) {
        error = err;
      } finally {
        expect(error as typeof invalidCsrfTokenError).toEqual(invalidCsrfTokenError);
      }
    });

    it('does not set csrfToken if response is not json', async () => {
      expect.assertions(1);
      fetchMock.get(LOGIN_GLOB, '123', {
        overwriteRoutes: true,
      });

      let error;
      try {
        await new SupersetClientClass({}).init();
      } catch (err) {
        error = err;
      } finally {
        expect(error as typeof invalidCsrfTokenError).toEqual(invalidCsrfTokenError);
      }
    });
  });

  describe('.isAuthenticated()', () => {
    afterEach(fetchMock.reset);

    it('returns true if there is a token and false if not', async () => {
      expect.assertions(2);
      const client = new SupersetClientClass({});
      expect(client.isAuthenticated()).toBe(false);
      await client.init();
      expect(client.isAuthenticated()).toBe(true);
    });

    it('returns true if a token is passed at configuration', () => {
      expect.assertions(2);
      const clientWithoutToken = new SupersetClientClass({ csrfToken: undefined });
      const clientWithToken = new SupersetClientClass({ csrfToken: 'token' });
      expect(clientWithoutToken.isAuthenticated()).toBe(false);
      expect(clientWithToken.isAuthenticated()).toBe(true);
    });
  });

  describe('.ensureAuth()', () => {
    it(`returns a promise that rejects if .init() has not been called`, async () => {
      expect.assertions(2);

      const client = new SupersetClientClass({});
      let error;

      try {
        await client.ensureAuth();
      } catch (err) {
        error = err;
      } finally {
        expect(error).toEqual({ error: expect.any(String) });
      }
      expect(client.isAuthenticated()).toBe(false);
    });

    it('returns a promise that resolves if .init() resolves successfully', async () => {
      expect.assertions(1);

      const client = new SupersetClientClass({});
      await client.init();
      await client.ensureAuth();

      expect(client.isAuthenticated()).toBe(true);
    });

    it(`returns a promise that rejects if .init() is unsuccessful`, async () => {
      expect.assertions(4);

      const rejectValue = { status: 403 };
      fetchMock.get(LOGIN_GLOB, () => Promise.reject(rejectValue), {
        overwriteRoutes: true,
      });

      const client = new SupersetClientClass({});
      let error;
      let error2;

      try {
        await client.init();
      } catch (err) {
        error = err;
      } finally {
        expect(error).toEqual(expect.objectContaining(rejectValue));
        expect(client.isAuthenticated()).toBe(false);
        try {
          await client.ensureAuth();
        } catch (err) {
          error2 = err;
        } finally {
          expect(error2).toEqual(expect.objectContaining(rejectValue));
          expect(client.isAuthenticated()).toBe(false);
        }
      }

      // reset
      fetchMock.get(
        LOGIN_GLOB,
        { result: 1234 },
        {
          overwriteRoutes: true,
        },
      );
    });
  });

  describe('requests', () => {
    afterEach(fetchMock.reset);
    const protocol = 'https:';
    const host = 'host';
    const mockGetEndpoint = '/get/url';
    const mockRequestEndpoint = '/request/url';
    const mockPostEndpoint = '/post/url';
    const mockPutEndpoint = '/put/url';
    const mockDeleteEndpoint = '/delete/url';
    const mockTextEndpoint = '/text/endpoint';
    const mockGetUrl = `${protocol}//${host}${mockGetEndpoint}`;
    const mockRequestUrl = `${protocol}//${host}${mockRequestEndpoint}`;
    const mockPostUrl = `${protocol}//${host}${mockPostEndpoint}`;
    const mockTextUrl = `${protocol}//${host}${mockTextEndpoint}`;
    const mockPutUrl = `${protocol}//${host}${mockPutEndpoint}`;
    const mockDeleteUrl = `${protocol}//${host}${mockDeleteEndpoint}`;
    const mockTextJsonResponse = '{ "value": 9223372036854775807 }';
    const mockPayload = { json: () => Promise.resolve('payload') };

    fetchMock.get(mockGetUrl, mockPayload);
    fetchMock.post(mockPostUrl, mockPayload);
    fetchMock.put(mockPutUrl, mockPayload);
    fetchMock.delete(mockDeleteUrl, mockPayload);
    fetchMock.delete(mockRequestUrl, mockPayload);
    fetchMock.get(mockTextUrl, mockTextJsonResponse);
    fetchMock.post(mockTextUrl, mockTextJsonResponse);

    it('checks for authentication before every get and post request', async () => {
      expect.assertions(6);

      const authSpy = jest.spyOn(SupersetClientClass.prototype, 'ensureAuth');
      const client = new SupersetClientClass({ protocol, host });

      await client.init();
      await client.get({ url: mockGetUrl });
      await client.post({ url: mockPostUrl });
      await client.put({ url: mockPutUrl });
      await client.delete({ url: mockDeleteUrl });
      await client.request({ url: mockRequestUrl, method: 'DELETE' });

      expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockDeleteUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockPutUrl)).toHaveLength(1);
      expect(fetchMock.calls(mockRequestUrl)).toHaveLength(1);

      expect(authSpy).toHaveBeenCalledTimes(5);
      authSpy.mockRestore();
    });

    it('sets protocol, host, headers, mode, and credentials from config', async () => {
      expect.assertions(3);

      const clientConfig: ClientConfig = {
        host,
        protocol,
        mode: 'cors',
        credentials: 'include',
        headers: { my: 'header' },
      };

      const client = new SupersetClientClass(clientConfig);
      await client.init();
      await client.get({ url: mockGetUrl });

      const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
      expect(fetchRequest.mode).toBe(clientConfig.mode);
      expect(fetchRequest.credentials).toBe(clientConfig.credentials);
      expect(fetchRequest.headers).toEqual(
        expect.objectContaining(clientConfig.headers) as typeof fetchRequest.headers,
      );
    });

    describe('.get()', () => {
      it('makes a request using url or endpoint', async () => {
        expect.assertions(2);

        const client = new SupersetClientClass({ protocol, host });
        await client.init();

        await client.get({ url: mockGetUrl });
        expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);

        await client.get({ endpoint: mockGetEndpoint });
        expect(fetchMock.calls(mockGetUrl)).toHaveLength(2);
      });

      it('supports parsing a response as text', async () => {
        expect.assertions(2);
        const client = new SupersetClientClass({ protocol, host });
        await client.init();
        const { text } = await client.get({ url: mockTextUrl, parseMethod: 'text' });
        expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
        expect(text).toBe(mockTextJsonResponse);
      });

      it('allows overriding host, headers, mode, and credentials per-request', async () => {
        expect.assertions(3);

        const clientConfig: ClientConfig = {
          host,
          protocol,
          mode: 'cors',
          credentials: 'include',
          headers: { my: 'header' },
        };
        const overrideConfig: ClientConfig = {
          host: 'override_host',
          mode: 'no-cors',
          credentials: 'omit',
          headers: { my: 'override', another: 'header' },
        };

        const client = new SupersetClientClass(clientConfig);
        await client.init();
        await client.get({ url: mockGetUrl, ...overrideConfig });

        const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
        expect(fetchRequest.mode).toBe(overrideConfig.mode);
        expect(fetchRequest.credentials).toBe(overrideConfig.credentials);
        expect(fetchRequest.headers).toEqual(
          expect.objectContaining(overrideConfig.headers) as typeof fetchRequest.headers,
        );
      });
    });

    describe('.post()', () => {
      it('makes a request using url or endpoint', async () => {
        expect.assertions(2);

        const client = new SupersetClientClass({ protocol, host });
        await client.init();

        await client.post({ url: mockPostUrl });
        expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);

        await client.post({ endpoint: mockPostEndpoint });
        expect(fetchMock.calls(mockPostUrl)).toHaveLength(2);
      });

      it('allows overriding host, headers, mode, and credentials per-request', async () => {
        expect.assertions(3);
        const clientConfig: ClientConfig = {
          host,
          protocol,
          mode: 'cors',
          credentials: 'include',
          headers: { my: 'header' },
        };
        const overrideConfig: ClientConfig = {
          host: 'override_host',
          mode: 'no-cors',
          credentials: 'omit',
          headers: { my: 'override', another: 'header' },
        };

        const client = new SupersetClientClass(clientConfig);
        await client.init();
        await client.post({ url: mockPostUrl, ...overrideConfig });

        const fetchRequest = fetchMock.calls(mockPostUrl)[0][1];

        expect(fetchRequest.mode).toBe(overrideConfig.mode);
        expect(fetchRequest.credentials).toBe(overrideConfig.credentials);
        expect(fetchRequest.headers).toEqual(
          expect.objectContaining(overrideConfig.headers) as typeof fetchRequest.headers,
        );
      });

      it('supports parsing a response as text', async () => {
        expect.assertions(2);
        const client = new SupersetClientClass({ protocol, host });
        await client.init();
        const { text } = await client.post({ url: mockTextUrl, parseMethod: 'text' });
        expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
        expect(text).toBe(mockTextJsonResponse);
      });

      it('passes postPayload key,values in the body', async () => {
        expect.assertions(3);

        const postPayload = { number: 123, array: [1, 2, 3] };
        const client = new SupersetClientClass({ protocol, host });
        await client.init();
        await client.post({ url: mockPostUrl, postPayload });

        const formData = fetchMock.calls(mockPostUrl)[0][1].body as FormData;

        expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
        Object.entries(postPayload).forEach(([key, value]) => {
          expect(formData.get(key)).toBe(JSON.stringify(value));
        });
      });

      it('respects the stringify parameter for postPayload key,values', async () => {
        expect.assertions(3);

        const postPayload = { number: 123, array: [1, 2, 3] };
        const client = new SupersetClientClass({ protocol, host });
        await client.init();
        await client.post({ url: mockPostUrl, postPayload, stringify: false });

        const formData = fetchMock.calls(mockPostUrl)[0][1].body as FormData;

        expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
        Object.entries(postPayload).forEach(([key, value]) => {
          expect(formData.get(key)).toBe(String(value));
        });
      });
    });
  });
});

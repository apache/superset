import fetchMock from 'fetch-mock';

import PublicAPI, { SupersetClient, ClientConfig } from '../src/SupersetClient';
import throwIfCalled from './utils/throwIfCalled';
import { LOGIN_GLOB } from './fixtures/constants';

describe('SupersetClient', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '' });
  });

  afterAll(fetchMock.restore);

  afterEach(PublicAPI.reset);

  describe('Public API', () => {
    it('exposes reset, configure, init, get, post, isAuthenticated, and reAuthenticate methods', () => {
      expect(PublicAPI.configure).toEqual(expect.any(Function));
      expect(PublicAPI.init).toEqual(expect.any(Function));
      expect(PublicAPI.get).toEqual(expect.any(Function));
      expect(PublicAPI.post).toEqual(expect.any(Function));
      expect(PublicAPI.isAuthenticated).toEqual(expect.any(Function));
      expect(PublicAPI.reAuthenticate).toEqual(expect.any(Function));
      expect(PublicAPI.reset).toEqual(expect.any(Function));
    });

    it('throws if you call init, get, post, isAuthenticated, or reAuthenticate before configure', () => {
      expect(PublicAPI.init).toThrow();
      expect(PublicAPI.get).toThrow();
      expect(PublicAPI.post).toThrow();
      expect(PublicAPI.isAuthenticated).toThrow();
      expect(PublicAPI.reAuthenticate).toThrow();

      expect(PublicAPI.configure).not.toThrow();
    });

    // this also tests that the ^above doesn't throw if configure is called appropriately
    it('calls appropriate SupersetClient methods when configured', () => {
      const mockGetUrl = '/mock/get/url';
      const mockPostUrl = '/mock/post/url';
      const mockGetPayload = { get: 'payload' };
      const mockPostPayload = { post: 'payload' };
      fetchMock.get(mockGetUrl, mockGetPayload);
      fetchMock.post(mockPostUrl, mockPostPayload);

      const initSpy = jest.spyOn(SupersetClient.prototype, 'init');
      const getSpy = jest.spyOn(SupersetClient.prototype, 'get');
      const postSpy = jest.spyOn(SupersetClient.prototype, 'post');
      const authenticatedSpy = jest.spyOn(SupersetClient.prototype, 'isAuthenticated');
      const csrfSpy = jest.spyOn(SupersetClient.prototype, 'getCSRFToken');

      PublicAPI.configure({});
      PublicAPI.init();

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(authenticatedSpy).toHaveBeenCalledTimes(1);
      expect(csrfSpy).toHaveBeenCalledTimes(1);

      PublicAPI.get({ url: mockGetUrl });
      PublicAPI.post({ url: mockPostUrl });
      PublicAPI.isAuthenticated();
      PublicAPI.reAuthenticate();

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

  describe('SupersetClient', () => {
    describe('getUrl', () => {
      let client;
      beforeEach(() => {
        client = new SupersetClient({ protocol: 'https:', host: 'CONFIG_HOST' });
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
        expect(client.getUrl({ endpoint: '/test' })).toBe('https://CONFIG_HOST/test');
      });

      it('does not throw if url, endpoint, and host are', () => {
        client = new SupersetClient({ protocol: 'https:', host: '' });
        expect(client.getUrl()).toBe('https:///');
      });
    });

    describe('CSRF', () => {
      afterEach(fetchMock.reset);

      it('calls superset/csrf_token/ when init() is called if no CSRF token is passed', () => {
        expect.assertions(1);
        const client = new SupersetClient({});

        return client.init().then(() => {
          expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(1);

          return Promise.resolve();
        });
      });

      it('does NOT call superset/csrf_token/ when init() is called if a CSRF token is passed', () => {
        expect.assertions(1);
        const client = new SupersetClient({ csrfToken: 'abc' });

        return client.init().then(() => {
          expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(0);

          return Promise.resolve();
        });
      });

      it('calls superset/csrf_token/ when init(force=true) is called even if a CSRF token is passed', () => {
        expect.assertions(4);
        const initialToken = 'inital_token';
        const client = new SupersetClient({ csrfToken: initialToken });

        return client.init().then(() => {
          expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(0);
          expect(client.csrfToken).toBe(initialToken);

          return client.init(true).then(() => {
            expect(fetchMock.calls(LOGIN_GLOB)).toHaveLength(1);
            expect(client.csrfToken).not.toBe(initialToken);

            return Promise.resolve();
          });
        });
      });

      it('isAuthenticated() returns true if there is a token and false if not', () => {
        expect.assertions(2);
        const client = new SupersetClient({});
        expect(client.isAuthenticated()).toBe(false);

        return client.init().then(() => {
          expect(client.isAuthenticated()).toBe(true);

          return Promise.resolve();
        });
      });

      it('isAuthenticated() returns true if a token is passed at configuration', () => {
        expect.assertions(2);
        const clientWithoutToken = new SupersetClient({ csrfToken: null });
        const clientWithToken = new SupersetClient({ csrfToken: 'token' });

        expect(clientWithoutToken.isAuthenticated()).toBe(false);
        expect(clientWithToken.isAuthenticated()).toBe(true);
      });

      it('init() throws if superset/csrf_token/ returns an error', () => {
        expect.assertions(1);

        fetchMock.get(LOGIN_GLOB, () => Promise.reject({ status: 403 }), {
          overwriteRoutes: true,
        });

        const client = new SupersetClient({});

        return client
          .init()
          .then(throwIfCalled)
          .catch(error => {
            expect(error.status).toBe(403);

            // reset
            fetchMock.get(
              LOGIN_GLOB,
              { csrf_token: '1234' },
              {
                overwriteRoutes: true,
              },
            );

            return Promise.resolve();
          });
      });

      it('init() throws if superset/csrf_token/ does not return a token', () => {
        expect.assertions(1);
        fetchMock.get(LOGIN_GLOB, {}, { overwriteRoutes: true });

        const client = new SupersetClient({});

        return client
          .init()
          .then(throwIfCalled)
          .catch(error => {
            expect(error).toBeDefined();

            // reset
            fetchMock.get(
              LOGIN_GLOB,
              { csrf_token: 1234 },
              {
                overwriteRoutes: true,
              },
            );

            return Promise.resolve();
          });
      });
    });

    describe('CSRF queuing', () => {
      it(`client.ensureAuth() returns a promise that rejects init() has not been called`, () => {
        expect.assertions(2);

        const client = new SupersetClient({});

        return client
          .ensureAuth()
          .then(throwIfCalled)
          .catch(error => {
            expect(error).toEqual(expect.objectContaining({ error: expect.any(String) }));
            expect(client.isAuthenticated()).toBe(false);

            return Promise.resolve();
          });
      });

      it('client.ensureAuth() returns a promise that resolves if client.init() resolves successfully', () => {
        expect.assertions(1);

        const client = new SupersetClient({});

        return client.init().then(() =>
          client
            .ensureAuth()
            .then(throwIfCalled)
            .catch(() => {
              expect(client.isAuthenticated()).toBe(true);

              return Promise.resolve();
            }),
        );
      });

      it(`client.ensureAuth() returns a promise that rejects if init() is unsuccessful`, () => {
        const rejectValue = { status: 403 };
        fetchMock.get(LOGIN_GLOB, () => Promise.reject(rejectValue), {
          overwriteRoutes: true,
        });

        expect.assertions(3);

        const client = new SupersetClient({});

        return client
          .init()
          .then(throwIfCalled)
          .catch(error => {
            expect(error).toEqual(expect.objectContaining(rejectValue));

            return client
              .ensureAuth()
              .then(throwIfCalled)
              .catch(error2 => {
                expect(error2).toEqual(expect.objectContaining(rejectValue));
                expect(client.isAuthenticated()).toBe(false);

                // reset
                fetchMock.get(
                  LOGIN_GLOB,
                  { csrf_token: 1234 },
                  {
                    overwriteRoutes: true,
                  },
                );

                return Promise.resolve();
              });
          });
      });
    });

    describe('requests', () => {
      afterEach(fetchMock.reset);
      const protocol = 'https:';
      const host = 'HOST';
      const mockGetEndpoint = '/get/url';
      const mockPostEndpoint = '/post/url';
      const mockTextEndpoint = '/text/endpoint';
      const mockGetUrl = `${protocol}//${host}${mockGetEndpoint}`;
      const mockPostUrl = `${protocol}//${host}${mockPostEndpoint}`;
      const mockTextUrl = `${protocol}//${host}${mockTextEndpoint}`;
      const mockTextJsonResponse = '{ "value": 9223372036854775807 }';

      fetchMock.get(mockGetUrl, { json: 'payload' });
      fetchMock.post(mockPostUrl, { json: 'payload' });
      fetchMock.get(mockTextUrl, mockTextJsonResponse);
      fetchMock.post(mockTextUrl, mockTextJsonResponse);

      it('checks for authentication before every get and post request', () => {
        expect.assertions(3);
        const authSpy = jest.spyOn(SupersetClient.prototype, 'ensureAuth');
        const client = new SupersetClient({ protocol, host });

        return client.init().then(() =>
          Promise.all([client.get({ url: mockGetUrl }), client.post({ url: mockPostUrl })]).then(
            () => {
              expect(fetchMock.calls(mockGetUrl)).toHaveLength(1);
              expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
              expect(authSpy).toHaveBeenCalledTimes(2);
              authSpy.mockRestore();

              return Promise.resolve();
            },
          ),
        );
      });

      it('sets protocol, host, headers, mode, and credentials from config', () => {
        expect.assertions(3);
        const clientConfig: ClientConfig = {
          host,
          protocol,
          mode: 'cors',
          credentials: 'include',
          headers: { my: 'header' },
        };

        const client = new SupersetClient(clientConfig);

        return client.init().then(() =>
          client.get({ url: mockGetUrl }).then(() => {
            const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
            expect(fetchRequest.mode).toBe(clientConfig.mode);
            expect(fetchRequest.credentials).toBe(clientConfig.credentials);
            expect(fetchRequest.headers).toEqual(expect.objectContaining(clientConfig.headers));

            return Promise.resolve();
          }),
        );
      });

      describe('GET', () => {
        it('makes a request using url or endpoint', () => {
          expect.assertions(1);
          const client = new SupersetClient({ protocol, host });

          return client.init().then(() =>
            Promise.all([
              client.get({ url: mockGetUrl }),
              client.get({ endpoint: mockGetEndpoint }),
            ]).then(() => {
              expect(fetchMock.calls(mockGetUrl)).toHaveLength(2);

              return Promise.resolve();
            }),
          );
        });

        it('supports parsing a response as text', () => {
          expect.assertions(2);
          const client = new SupersetClient({ protocol, host });

          return client
            .init()
            .then(() =>
              client
                .get({ url: mockTextUrl, parseMethod: 'text' })
                .then(({ text }) => {
                  expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
                  expect(text).toBe(mockTextJsonResponse);

                  return Promise.resolve();
                })
                .catch(throwIfCalled),
            )
            .catch(throwIfCalled);
        });

        it('allows overriding host, headers, mode, and credentials per-request', () => {
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

          const client = new SupersetClient(clientConfig);

          return client
            .init()
            .then(() =>
              client
                .get({ url: mockGetUrl, ...overrideConfig })
                .then(() => {
                  const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
                  expect(fetchRequest.mode).toBe(overrideConfig.mode);
                  expect(fetchRequest.credentials).toBe(overrideConfig.credentials);
                  expect(fetchRequest.headers).toEqual(
                    expect.objectContaining(overrideConfig.headers),
                  );

                  return Promise.resolve();
                })
                .catch(throwIfCalled),
            )
            .catch(throwIfCalled);
        });
      });

      describe('POST', () => {
        it('makes a request using url or endpoint', () => {
          expect.assertions(1);
          const client = new SupersetClient({ protocol, host });

          return client.init().then(() =>
            Promise.all([
              client.post({ url: mockPostUrl }),
              client.post({ endpoint: mockPostEndpoint }),
            ]).then(() => {
              expect(fetchMock.calls(mockPostUrl)).toHaveLength(2);

              return Promise.resolve();
            }),
          );
        });

        it('allows overriding host, headers, mode, and credentials per-request', () => {
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

          const client = new SupersetClient(clientConfig);

          return client.init().then(() =>
            client.post({ url: mockPostUrl, ...overrideConfig }).then(() => {
              const fetchRequest = fetchMock.calls(mockPostUrl)[0][1];
              expect(fetchRequest.mode).toBe(overrideConfig.mode);
              expect(fetchRequest.credentials).toBe(overrideConfig.credentials);
              expect(fetchRequest.headers).toEqual(expect.objectContaining(overrideConfig.headers));

              return Promise.resolve();
            }),
          );
        });

        it('supports parsing a response as text', () => {
          expect.assertions(2);
          const client = new SupersetClient({ protocol, host });

          return client.init().then(() =>
            client.post({ url: mockTextUrl, parseMethod: 'text' }).then(({ text }) => {
              expect(fetchMock.calls(mockTextUrl)).toHaveLength(1);
              expect(text).toBe(mockTextJsonResponse);

              return Promise.resolve();
            }),
          );
        });

        it('passes postPayload key,values in the body', () => {
          expect.assertions(3);

          const postPayload = { number: 123, array: [1, 2, 3] };
          const client = new SupersetClient({ protocol, host });

          return client.init().then(() =>
            client.post({ url: mockPostUrl, postPayload }).then(() => {
              const formData = fetchMock.calls(mockPostUrl)[0][1].body;
              expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
              Object.keys(postPayload).forEach(key => {
                expect(formData.get(key)).toBe(JSON.stringify(postPayload[key]));
              });

              return Promise.resolve();
            }),
          );
        });

        it('respects the stringify parameter for postPayload key,values', () => {
          expect.assertions(3);
          const postPayload = { number: 123, array: [1, 2, 3] };
          const client = new SupersetClient({ protocol, host });

          return client.init().then(() =>
            client.post({ url: mockPostUrl, postPayload, stringify: false }).then(() => {
              const formData = fetchMock.calls(mockPostUrl)[0][1].body;
              expect(fetchMock.calls(mockPostUrl)).toHaveLength(1);
              Object.keys(postPayload).forEach(key => {
                expect(formData.get(key)).toBe(String(postPayload[key]));
              });

              return Promise.resolve();
            }),
          );
        });
      });
    });
  });
});

/* eslint import/no-extraneous-dependencies: 0 */
import { it, describe, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import PublicAPI, { SupersetClient } from '../src/SupersetClient';

const LOGIN_GLOB = 'glob:*superset/csrf_token/*';

describe('SupersetClient', () => {
  before(() => {
    // clear the base config for Superset tests
    PublicAPI.reset();
  });

  afterEach(() => {
    PublicAPI.reset();
  });

  after(() => {
    // this is the base config for Superset tests, remove when moved to separate package
    fetchMock.get('glob:*superset/csrf_token/*', { csrf_token: '1234' }, { overwriteRoutes: true });
    PublicAPI.configure({ protocol: 'http', host: 'localhost' })
      .init()
      .then(() => fetchMock.reset());
  });

  describe('API', () => {
    it('exposes reset, configure, init, get, post, isAuthenticated, and reAuthenticate methods', () => {
      expect(typeof PublicAPI.configure).to.equal('function');
      expect(typeof PublicAPI.init).to.equal('function');
      expect(typeof PublicAPI.get).to.equal('function');
      expect(typeof PublicAPI.post).to.equal('function');
      expect(typeof PublicAPI.isAuthenticated).to.equal('function');
      expect(typeof PublicAPI.reAuthenticate).to.equal('function');
      expect(typeof PublicAPI.reset).to.equal('function');
    });

    it('throws if you call init, get, post, isAuthenticated, or reAuthenticate before configure', () => {
      expect(PublicAPI.init).to.throw();
      expect(PublicAPI.get).to.throw();
      expect(PublicAPI.post).to.throw();
      expect(PublicAPI.isAuthenticated).to.throw();
      expect(PublicAPI.reAuthenticate).to.throw();

      expect(PublicAPI.configure).to.not.throw();
    });

    // this also tests that the ^above doesn't throw if configure is called appropriately
    it('calls appropriate SupersetClient methods when configured', () => {
      const initSpy = sinon.stub(SupersetClient.prototype, 'init');
      const getSpy = sinon.stub(SupersetClient.prototype, 'get');
      const postSpy = sinon.stub(SupersetClient.prototype, 'post');
      const authenticatedSpy = sinon.stub(SupersetClient.prototype, 'isAuthenticated');
      const csrfSpy = sinon.stub(SupersetClient.prototype, 'getCSRFToken');

      PublicAPI.configure({});
      PublicAPI.init();
      PublicAPI.get({});
      PublicAPI.post({});
      PublicAPI.isAuthenticated();
      PublicAPI.reAuthenticate({});

      expect(initSpy.callCount).to.equal(1);
      expect(getSpy.callCount).to.equal(1);
      expect(postSpy.callCount).to.equal(1);
      expect(authenticatedSpy.callCount).to.equal(1);
      expect(csrfSpy.callCount).to.equal(1); // from reAuthenticate()

      initSpy.restore();
      getSpy.restore();
      postSpy.restore();
      authenticatedSpy.restore();
      csrfSpy.restore();
    });
  });

  describe('SupersetClient', () => {
    describe('CSRF', () => {
      afterEach(fetchMock.reset);

      it('calls superset/csrf_token/ upon initialization', (done) => {
        const successSpy = sinon.spy();
        const errorSpy = sinon.spy();
        const client = new SupersetClient({});
        client.init().then(successSpy, errorSpy);

        setTimeout(() => {
          expect(fetchMock.calls(LOGIN_GLOB)).to.have.lengthOf(1);
          expect(successSpy.callCount).to.equal(1);
          expect(errorSpy.callCount).to.equal(0);
          done();
        });
      });

      it('isAuthenticated() returns true if there is a token and false if not', (done) => {
        const client = new SupersetClient({});
        expect(client.isAuthenticated()).to.equal(false);
        client.init();
        setTimeout(() => {
          expect(client.isAuthenticated()).to.equal(true);
          done();
        });
      });

      it('throws if superset/csrf_token/ does not return a token', (done) => {
        fetchMock.get(LOGIN_GLOB, () => Promise.reject({ status: 403 }), {
          overwriteRoutes: true,
        });

        const successSpy = sinon.spy();
        const errorSpy = sinon.spy();
        const client = new SupersetClient({});
        client.init().then(successSpy, errorSpy);

        setTimeout(() => {
          expect(successSpy.callCount).to.equal(0);
          expect(errorSpy.callCount).to.equal(1);

          // reset
          fetchMock.get(
            LOGIN_GLOB,
            { csrf_token: 1234 },
            {
              overwriteRoutes: true,
            },
          );
          done();
        });
      });
    });

    describe('requests', () => {
      afterEach(fetchMock.reset);
      const protocol = 'PROTOCOL';
      const host = 'HOST';
      const mockGetEndpoint = '/get/url';
      const mockPostEndpoint = '/post/url';
      const mockGetUrl = `${protocol}://${host}${mockGetEndpoint}`;
      const mockPostUrl = `${protocol}://${host}${mockPostEndpoint}`;

      fetchMock.get(mockGetUrl, 'Ok');
      fetchMock.post(mockPostUrl, 'Ok');

      it('checks for authentication before every get and post request', (done) => {
        const authSpy = sinon.stub(SupersetClient.prototype, 'ensureAuth').resolves();
        const client = new SupersetClient({ protocol, host });
        client.init();
        client.get({ url: mockGetUrl });
        client.post({ url: mockPostUrl });

        setTimeout(() => {
          expect(fetchMock.calls(mockGetUrl)).to.have.lengthOf(1);
          expect(fetchMock.calls(mockPostUrl)).to.have.lengthOf(1);
          expect(authSpy.callCount).to.equal(2);
          done();
        });
      });

      it('sets protocol, host, headers, mode, and credentials from config', (done) => {
        const clientConfig = {
          host,
          protocol,
          mode: 'a la mode',
          credentials: 'mad cred',
          headers: { my: 'header' },
        };

        const client = new SupersetClient(clientConfig);
        client.init();
        client.get({ url: mockGetUrl });

        setTimeout(() => {
          const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
          expect(fetchRequest.mode).to.equal(clientConfig.mode);
          expect(fetchRequest.credentials).to.equal(clientConfig.credentials);
          expect(fetchRequest.headers).to.deep.equal(clientConfig.headers);
          done();
        });
      });

      describe('GET', () => {
        it('makes a request using url or endpoint', (done) => {
          const client = new SupersetClient({ protocol, host });
          client.init();
          client.get({ url: mockGetUrl });
          client.get({ endpoint: mockGetEndpoint });
          setTimeout(() => {
            expect(fetchMock.calls(mockGetUrl)).to.have.lengthOf(2);
            done();
          });
        });

        it('allows overriding host, headers, mode, and credentials per-request', (done) => {
          const clientConfig = {
            host,
            protocol,
            mode: 'a la mode',
            credentials: 'mad cred',
            headers: { my: 'header' },
          };

          const overrideConfig = {
            host: 'override_host',
            mode: 'override mode',
            credentials: 'override credentials',
            headers: { my: 'override', another: 'header' },
          };

          const client = new SupersetClient(clientConfig);
          client.init();
          client.get({ url: mockGetUrl, ...overrideConfig });

          setTimeout(() => {
            const fetchRequest = fetchMock.calls(mockGetUrl)[0][1];
            expect(fetchRequest.mode).to.equal(overrideConfig.mode);
            expect(fetchRequest.credentials).to.equal(overrideConfig.credentials);
            expect(fetchRequest.headers).to.deep.equal(overrideConfig.headers);
            done();
          });
        });
      });

      describe('POST', () => {
        it('makes a request using url or endpoint', (done) => {
          const client = new SupersetClient({ protocol, host });
          client.init();
          client.post({ url: mockPostUrl });
          client.post({ endpoint: mockPostEndpoint });
          setTimeout(() => {
            expect(fetchMock.calls(mockPostUrl)).to.have.lengthOf(2);
            done();
          });
        });

        it('allows overriding host, headers, mode, and credentials per-request', (done) => {
          const clientConfig = {
            host,
            protocol,
            mode: 'a la mode',
            credentials: 'mad cred',
            headers: { my: 'header' },
          };

          const overrideConfig = {
            host: 'override_host',
            mode: 'override mode',
            credentials: 'override credentials',
            headers: { my: 'override', another: 'header' },
          };

          const client = new SupersetClient(clientConfig);
          client.init();
          client.post({ url: mockPostUrl, ...overrideConfig });

          setTimeout(() => {
            const fetchRequest = fetchMock.calls(mockPostUrl)[0][1];
            expect(fetchRequest.mode).to.equal(overrideConfig.mode);
            expect(fetchRequest.credentials).to.equal(overrideConfig.credentials);
            expect(fetchRequest.headers).to.deep.equal(overrideConfig.headers);
            done();
          });
        });

        it('passes postPayload key,values in the body', (done) => {
          const postPayload = { number: 123, array: [1, 2, 3] };
          const client = new SupersetClient({ protocol, host });
          client.init();
          client.post({ url: mockPostUrl, postPayload });
          setTimeout(() => {
            const formData = fetchMock.calls(mockPostUrl)[0][1].body;
            expect(fetchMock.calls(mockPostUrl)).to.have.lengthOf(1);
            Object.keys(postPayload).forEach((key) => {
              expect(formData.get(key)).to.equal(JSON.stringify(postPayload[key]));
            });

            done();
          });
        });

        it('respects the stringify parameter for postPayload key,values', (done) => {
          const postPayload = { number: 123, array: [1, 2, 3] };
          const client = new SupersetClient({ protocol, host });
          client.init();
          client.post({ url: mockPostUrl, postPayload, stringify: false });
          setTimeout(() => {
            const formData = fetchMock.calls(mockPostUrl)[0][1].body;
            expect(fetchMock.calls(mockPostUrl)).to.have.lengthOf(1);
            Object.keys(postPayload).forEach((key) => {
              expect(formData.get(key)).to.equal(String(postPayload[key]));
            });

            done();
          });
        });
      });
    });
  });
});

/* eslint import/no-extraneous-dependencies: 0 */
import { it, describe, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import { callApi } from '../src';

describe('callApi', () => {
  const mockGetUrl = '/mock/get/url';
  const mockPostUrl = '/mock/post/url';
  const mockGetPayload = { get: 'payload' };
  const mockPostPayload = { post: 'payload' };
  fetchMock.get(mockGetUrl, mockGetPayload);
  fetchMock.post(mockPostUrl, mockPostPayload);

  afterEach(fetchMock.reset);

  describe('request config', () => {
    it('calls the right url with the specified method', (done) => {
      callApi({ url: mockGetUrl, method: 'GET' });
      callApi({ url: mockPostUrl, method: 'POST' });

      setTimeout(() => {
        expect(fetchMock.calls(mockGetUrl)).to.have.lengthOf(1);
        expect(fetchMock.calls(mockPostUrl)).to.have.lengthOf(1);
        done();
      });
    });

    it('passes along mode, cache, credentials, headers, body, signal, and redirect parameters in the request', (done) => {
      const mockRequest = {
        url: mockGetUrl,
        mode: 'my-mode',
        cache: 'cash money',
        credentials: 'mad cred',
        headers: {
          custom: 'header',
        },
        redirect: 'no thanks',
        signal: () => {},
        body: 'BODY',
      };

      callApi(mockRequest);

      setTimeout(() => {
        const calls = fetchMock.calls(mockGetUrl);
        const fetchParams = calls[0][1];
        expect(calls).to.have.lengthOf(1);
        expect(fetchParams.mode).to.equal(mockRequest.mode);
        expect(fetchParams.cache).to.equal(mockRequest.cache);
        expect(fetchParams.credentials).to.equal(mockRequest.credentials);
        expect(fetchParams.headers).to.deep.equal(mockRequest.headers);
        expect(fetchParams.redirect).to.equal(mockRequest.redirect);
        expect(fetchParams.signal).to.equal(mockRequest.signal);
        expect(fetchParams.body).to.equal(mockRequest.body);

        done();
      });
    });
  });

  describe('POST requests', () => {
    it('encodes key,value pairs from postPayload', (done) => {
      const postPayload = { key: 'value', anotherKey: 1237 };
      callApi({ url: mockPostUrl, method: 'POST', postPayload });

      setTimeout(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).to.have.lengthOf(1);

        const fetchParams = calls[0][1];
        const { body } = fetchParams;

        Object.keys(postPayload).forEach((key) => {
          expect(body.get(key)).to.equal(JSON.stringify(postPayload[key]));
        });

        done();
      });
    });

    // the reason for this is to omit strings like 'undefined' from making their way to the backend
    it('omits key,value pairs from postPayload that have undefined values', (done) => {
      const postPayload = { key: 'value', noValue: undefined };
      callApi({ url: mockPostUrl, method: 'POST', postPayload });

      setTimeout(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).to.have.lengthOf(1);

        const fetchParams = calls[0][1];
        const { body } = fetchParams;
        expect(body.get('key')).to.equal(JSON.stringify(postPayload.key));
        expect(body.get('noValue')).to.equal(null);

        done();
      });
    });

    it('respects the stringify flag in POST requests', (done) => {
      const postPayload = {
        string: 'value',
        number: 1237,
        array: [1, 2, 3],
        object: { a: 'a', 1: 1 },
        null: null,
        emptyString: '',
      };

      callApi({ url: mockPostUrl, method: 'POST', postPayload });
      callApi({ url: mockPostUrl, method: 'POST', postPayload, stringify: false });

      setTimeout(() => {
        const calls = fetchMock.calls(mockPostUrl);
        expect(calls).to.have.lengthOf(2);

        const stringified = calls[0][1].body;
        const unstringified = calls[1][1].body;

        Object.keys(postPayload).forEach((key) => {
          expect(stringified.get(key)).to.equal(JSON.stringify(postPayload[key]));
          expect(unstringified.get(key)).to.equal(String(postPayload[key]));
        });

        done();
      });
    });
  });

  describe('Promises', () => {
    let promiseResolveSpy;
    let promiseRejectSpy;

    beforeEach(() => {
      promiseResolveSpy = sinon.spy(Promise, 'resolve');
      promiseRejectSpy = sinon.spy(Promise, 'reject');
    });

    afterEach(() => {
      promiseResolveSpy.restore();
      promiseRejectSpy.restore();
    });

    it('resolves to { json, response } if the request succeeds', (done) => {
      callApi({ url: mockGetUrl, method: 'GET' });

      setTimeout(() => {
        expect(fetchMock.calls(mockGetUrl)).to.have.lengthOf(1);

        // 1. fetch resolves
        // 2. timeout promise (unresolved)
        // 3. final resolve with json payload
        expect(promiseResolveSpy.callCount).to.equal(3);
        expect(promiseRejectSpy.callCount).to.equal(0);
        const finalPromiseArgs = promiseResolveSpy.getCall(2).args[0];
        expect(finalPromiseArgs).to.have.keys(['response', 'json']);
        expect(finalPromiseArgs.json).to.deep.equal(mockGetPayload);

        done();
      });
    });

    it('resolves to { text, response } if the request succeeds with text response', (done) => {
      const mockTextUrl = '/mock/text/url';
      const mockTextResponse =
        '<html><head></head><body>I could be a stack trace or something</body></html>';
      fetchMock.get(mockTextUrl, mockTextResponse);

      callApi({ url: mockTextUrl, method: 'GET' });

      setTimeout(() => {
        expect(fetchMock.calls(mockTextUrl)).to.have.lengthOf(1);

        // 1. fetch resolves
        // 2. timeout promise (unresolved)
        // 3. (error) json parse fails => rejects
        // 4. final resolve with text payload
        expect(promiseResolveSpy.callCount).to.equal(3);
        expect(promiseRejectSpy.callCount).to.equal(1);

        const finalPromiseArgs = promiseResolveSpy.getCall(2).args[0];
        expect(finalPromiseArgs).to.have.keys(['response', 'text']);
        expect(finalPromiseArgs.text).to.deep.equal(mockTextResponse);

        done();
      });
    });

    it('rejects if the request throws', (done) => {
      const mockErrorUrl = '/mock/error/url';
      const mockResponse = { status: 500, statusText: 'Internal errorz!' };
      fetchMock.get(mockErrorUrl, () => Promise.reject(mockResponse));

      let thrownError;
      callApi({ url: mockErrorUrl, method: 'GET' })
        .then(() => {})
        .catch((error) => {
          thrownError = error;
        });

      setTimeout(() => {
        expect(fetchMock.calls(mockErrorUrl)).to.have.lengthOf(1);

        // 1. fetch resolves
        // 2. timeout promise (unresolved)
        // 3. reject above
        // 3. rejects from fetch error
        expect(promiseResolveSpy.callCount).to.equal(2);
        expect(promiseRejectSpy.callCount).to.equal(2);

        expect(thrownError.status).to.equal(mockResponse.status);
        expect(thrownError.statusText).to.equal(mockResponse.statusText);

        done();
      });
    });

    it('rejects if the request exceeds the timeout passed', (done) => {
      const mockTimeoutUrl = '/mock/timeout/url';
      const unresolvingPromise = new Promise(() => {});

      fetchMock.get(mockTimeoutUrl, () => unresolvingPromise);

      let error;
      callApi({ url: mockTimeoutUrl, method: 'GET', timeout: 0 })
        .then(() => {})
        .catch((timeoutError) => {
          error = timeoutError;
        });

      setTimeout(() => {
        expect(fetchMock.calls(mockTimeoutUrl)).to.have.lengthOf(1);

        // 1. unresolved fetch
        // 2. Promise.race resolves with timeout error, not seen in reject spy because it calls
        //    reject not Promise.reject. We assert this via the error closure above.
        expect(promiseResolveSpy.callCount).to.equal(2);
        expect(promiseRejectSpy.callCount).to.equal(0);
        expect(error).to.have.keys(['error', 'statusText']);
        expect(error.statusText).to.equal('timeout');

        done();
      }, 10);
    });
  });
});

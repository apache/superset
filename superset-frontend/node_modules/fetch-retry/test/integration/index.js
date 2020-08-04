'use strict';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();
const childProcess = require('child_process');
const fetch = require('isomorphic-fetch');
const fetchRetry = require('../../')(fetch);

describe('fetch-retry integration tests', () => {

  const baseUrl = 'http://localhost:3000/mock';

  before(() => {
    const process = childProcess.fork('./test/integration/mock-api/index.js');

    process.on('error', err => {
      console.log(err);
    });
  });

  after(() => {
    return fetchRetry(baseUrl + '/stop', {
      method: 'POST'
    });
  });

  const setupResponses = (responses) => {
    return fetchRetry(baseUrl, {
      method: 'POST',
      body: JSON.stringify(responses),
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  const getCallCount = () => {
    return fetchRetry(`${baseUrl}/calls`)
      .then(response => {
        return response.text();
      })
      .then(text => {
        return Number.parseInt(text);
      });
  };

  [200, 503, 404].forEach(statusCode => {

    describe('when endpoint returns ' + statusCode, () => {

      before(() => {
        return setupResponses([statusCode]);
      });

      it('does not retry request', () => {
        return fetchRetry(baseUrl)
          .then(getCallCount)
          .should.eventually.equal(1);
      });

    });

  });

  describe('when configured to retry on a specific HTTP code', () => {

    describe('and it never succeeds', () => {

      const retryOn = [503];

      beforeEach(() => {
        return setupResponses([503, 503, 503, 503]);
      });

      it('retries the request #retries times', () => {
        const init = {
          retries: 3,
          retryDelay: 100,
          retryOn
        };

        const expectedCallCount = init.retries + 1;

        return fetchRetry(baseUrl, init)
          .then(getCallCount)
          .should.eventually.equal(expectedCallCount);
      });

      it('eventually resolves the promise with the response of the last request', () => {
        const init = {
          retries: 3,
          retryDelay: 100,
          retryOn
        };

        const expectedResponse = {
          status: 503,
          ok: false
        };

        return fetchRetry(baseUrl, init)
          .then(response => {
            return {
              status: response.status,
              ok: response.ok
            };
          })
          .should.become(expectedResponse);
      });

    });

    describe('and it eventually succeeds', () => {

      const retryOnStatus = 503;
      const responses = [503, 503, 200];
      const requestsToRetry = responses
        .filter(response => response === retryOnStatus)
        .length;

      beforeEach(() => {
        return setupResponses(responses);
      });

      it('retries the request up to #retries times', () => {
        const init = {
          retries: 3,
          retryDelay: 100,
          retryOn: [retryOnStatus]
        };

        const expectedCallCount = requestsToRetry + 1;

        return fetchRetry(baseUrl, init)
          .then(getCallCount)
          .should.eventually.equal(expectedCallCount);
      });

      it('eventually resolves the promise with the received response of the last request', () => {
        const init = {
          retries: 3,
          retryDelay: 100,
          retryOn: [retryOnStatus]
        };

        const expectedResponse = {
          status: 200,
          ok: true
        };

        return fetchRetry(baseUrl, init)
          .then(response => {
            return {
              status: response.status,
              ok: response.ok
            };
          })
          .should.become(expectedResponse);
      });

    });

  });

  describe('when configured to retry on a set of HTTP codes', () => {

    describe('and it never succeeds', () => {

      const retryOn = [503, 404];

      beforeEach(() => {
        return setupResponses([503, 404, 404, 503]);
      });

      it('retries the request #retries times', () => {
        const init = {
          retries: 3,
          retryDelay: 100,
          retryOn
        };

        const expectedCallCount = init.retries + 1;

        return fetchRetry(baseUrl, init)
          .then(getCallCount)
          .should.eventually.equal(expectedCallCount);
      });

    });

  });

});

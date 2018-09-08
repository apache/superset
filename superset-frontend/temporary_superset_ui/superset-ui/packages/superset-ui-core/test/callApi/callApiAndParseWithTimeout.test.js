/* eslint promise/no-callback-in-promise: 'off' */
import fetchMock from 'fetch-mock';

import callApiAndParseWithTimeout from '../../src/callApi/callApiAndParseWithTimeout';

// we import these via * so that we can spy on the 'default' property of the object
import * as callApi from '../../src/callApi/callApi';
import * as parseResponse from '../../src/callApi/parseResponse';
import * as rejectAfterTimeout from '../../src/callApi/rejectAfterTimeout';

import { LOGIN_GLOB } from '../fixtures/constants';
import throwIfCalled from '../utils/throwIfCalled';

describe('callApiAndParseWithTimeout()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
  });

  afterAll(fetchMock.restore);

  const mockGetUrl = '/mock/get/url';
  const mockGetPayload = { get: 'payload' };
  fetchMock.get(mockGetUrl, mockGetPayload);

  afterEach(fetchMock.reset);

  describe('callApi', () => {
    it('calls callApi()', () => {
      const callApiSpy = jest.spyOn(callApi, 'default');
      callApiAndParseWithTimeout({ url: mockGetUrl, method: 'GET' });

      expect(callApiSpy).toHaveBeenCalledTimes(1);
      callApiSpy.mockClear();
    });
  });

  describe('parseResponse', () => {
    it('calls parseResponse()', () => {
      const parseSpy = jest.spyOn(parseResponse, 'default');
      callApiAndParseWithTimeout({ url: mockGetUrl, method: 'GET' });

      expect(parseSpy).toHaveBeenCalledTimes(1);
      parseSpy.mockClear();
    });
  });

  describe('timeout', () => {
    it('does not create a rejection timer if no timeout passed', () => {
      const rejectionSpy = jest.spyOn(rejectAfterTimeout, 'default');
      callApiAndParseWithTimeout({ url: mockGetUrl, method: 'GET' });

      expect(rejectionSpy).toHaveBeenCalledTimes(0);
      rejectionSpy.mockClear();
    });

    it('creates a rejection timer if a timeout passed', () => {
      jest.useFakeTimers(); // prevents the timeout from rejecting + failing test
      const rejectionSpy = jest.spyOn(rejectAfterTimeout, 'default');
      callApiAndParseWithTimeout({ url: mockGetUrl, method: 'GET', timeout: 10 });

      expect(rejectionSpy).toHaveBeenCalledTimes(1);
      rejectionSpy.mockClear();
    });

    it('rejects if the request exceeds the timeout', done => {
      expect.assertions(4);
      jest.useFakeTimers();

      const mockTimeoutUrl = '/mock/timeout/url';
      const unresolvingPromise = new Promise(() => {});
      fetchMock.get(mockTimeoutUrl, () => unresolvingPromise);

      callApiAndParseWithTimeout({ url: mockTimeoutUrl, method: 'GET', timeout: 1 })
        .then(throwIfCalled)
        .catch(timeoutError => {
          expect(setTimeout).toHaveBeenCalledTimes(1);
          expect(fetchMock.calls(mockTimeoutUrl)).toHaveLength(1);
          expect(Object.keys(timeoutError)).toEqual(
            expect.arrayContaining(['error', 'statusText']),
          );
          expect(timeoutError.statusText).toBe('timeout');

          return done();
        });

      jest.runOnlyPendingTimers();
    });

    it('resolves if the request does not exceed the timeout', done => {
      expect.assertions(1);
      jest.useFakeTimers();

      callApiAndParseWithTimeout({ url: mockGetUrl, method: 'GET', timeout: 100 })
        .then(response => {
          expect(response.json).toEqual(expect.objectContaining(mockGetPayload));

          return done();
        })
        .catch(throwIfCalled);
    });
  });
});

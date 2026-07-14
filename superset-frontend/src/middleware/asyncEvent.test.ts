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
import WS from 'jest-websocket-mock';
import { parseErrorJson, isFeatureEnabled } from '@superset-ui/core';
import * as asyncEvent from 'src/middleware/asyncEvent';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe('asyncEvent middleware', () => {
  const asyncPendingEvent = {
    status: 'pending',
    result_url: null,
    job_id: 'foo123',
    channel_id: '999',
    errors: [],
  };
  const asyncDoneEvent = {
    id: '1518951480106-0',
    status: 'done',
    result_url: '/api/v1/chart/data/cache-key-1',
    job_id: 'foo123',
    channel_id: '999',
    errors: [],
  };
  const asyncErrorEvent = {
    id: '1518951480107-0',
    status: 'error',
    result_url: null,
    job_id: 'foo123',
    channel_id: '999',
    errors: [{ message: "Error: relation 'foo' does not exist" }],
  };
  const chartData = {
    result: [
      {
        cache_key: '199f01f81f99c98693694821e4458111',
        cached_dttm: null,
        cache_timeout: 86400,
        annotation_data: {},
        error: null,
        is_cached: false,
        query:
          'SELECT product_line AS product_line,\n       sum(sales) AS "(Sales)"\nFROM cleaned_sales_data\nGROUP BY product_line\nLIMIT 50000',
        status: 'success',
        stacktrace: null,
        rowcount: 7,
        colnames: ['product_line', '(Sales)'],
        coltypes: [1, 0],
        data: [
          {
            product_line: 'Classic Cars',
            '(Sales)': 3919615.66,
          },
        ],
        applied_filters: [
          {
            column: '__time_range',
          },
        ],
        rejected_filters: [],
      },
    ],
  };

  const EVENTS_ENDPOINT = 'glob:*/api/v1/async_event/*';
  const CACHED_DATA_ENDPOINT = 'glob:*/api/v1/chart/data/*';

  beforeEach(async () => {
    mockedIsFeatureEnabled.mockImplementation(
      featureFlag => featureFlag === 'GLOBAL_ASYNC_QUERIES',
    );
  });

  afterEach(() => {
    fetchMock.reset();
    mockedIsFeatureEnabled.mockRestore();
  });

  afterAll(() => fetchMock.reset());

  describe('polling transport', () => {
    const config = {
      GLOBAL_ASYNC_QUERIES_TRANSPORT: 'polling',
      GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 50,
      GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL: '',
    };

    beforeEach(async () => {
      fetchMock.get(EVENTS_ENDPOINT, {
        status: 200,
        body: { result: [asyncDoneEvent] },
      });
      fetchMock.get(CACHED_DATA_ENDPOINT, {
        status: 200,
        body: { result: chartData },
      });
      asyncEvent.init(config);
    });

    it('resolves with chart data on event done status', async () => {
      const actualResolved =
        await asyncEvent.waitForAsyncData(asyncPendingEvent);
      expect(actualResolved).toEqual([chartData]);

      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
    });

    it('rejects on event error status', async () => {
      fetchMock.reset();
      fetchMock.get(EVENTS_ENDPOINT, {
        status: 200,
        body: { result: [asyncErrorEvent] },
      });
      const errorResponse = parseErrorJson(asyncErrorEvent);
      let error: any = null;
      try {
        await asyncEvent.waitForAsyncData(asyncPendingEvent);
      } catch (err) {
        error = err;
      } finally {
        expect(error).toEqual(errorResponse);
      }

      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(0);
    });

    it('rejects on cached data fetch error', async () => {
      fetchMock.reset();
      fetchMock.get(EVENTS_ENDPOINT, {
        status: 200,
        body: { result: [asyncDoneEvent] },
      });
      fetchMock.get(CACHED_DATA_ENDPOINT, {
        status: 400,
      });

      let error = '';
      try {
        await asyncEvent.waitForAsyncData(asyncPendingEvent);
      } catch (err) {
        [{ error }] = err;
      } finally {
        expect(error).toEqual('Bad request');
      }

      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
    });

    test('backs off exponentially when polling requests keep failing', async () => {
      // stop the real-timer polling loop started by beforeEach before
      // switching to fake timers, so all polls run on the fake clock
      mockedIsFeatureEnabled.mockReturnValueOnce(false);
      asyncEvent.init(config);
      jest.useFakeTimers();
      try {
        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, { status: 403 });
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});

        // first poll fires after the configured delay and fails
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        // next poll is delayed by 2x the configured delay, so nothing yet
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(2);

        // after the second failure the delay grows to 4x
        await jest.advanceTimersByTimeAsync(
          3 * config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(2);

        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(3);
      } finally {
        jest.useRealTimers();
      }
    });

    test('resumes the configured polling delay after a successful poll', async () => {
      // stop the real-timer polling loop started by beforeEach before
      // switching to fake timers, so all polls run on the fake clock
      mockedIsFeatureEnabled.mockReturnValueOnce(false);
      asyncEvent.init(config);
      jest.useFakeTimers();
      try {
        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, { status: 403 });
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});

        // two failed polls: 1x delay, then 2x delay
        await jest.advanceTimersByTimeAsync(
          3 * config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(2);

        // subsequent polls succeed, resetting the backoff
        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, {
          status: 200,
          body: { result: [] },
        });

        // third poll fires 4x delay after the second failure and succeeds
        await jest.advanceTimersByTimeAsync(
          4 * config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        // polling is back to the configured delay
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(2);
      } finally {
        jest.useRealTimers();
      }
    });

    test('caps the polling backoff delay at 60 seconds', async () => {
      const MAX_ERROR_POLLING_DELAY_MS = 60000;
      // stop the real-timer polling loop started by beforeEach before
      // switching to fake timers, so all polls run on the fake clock
      mockedIsFeatureEnabled.mockReturnValueOnce(false);
      asyncEvent.init(config);
      jest.useFakeTimers();
      try {
        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, { status: 403 });
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});

        // first poll fires after the configured delay and fails
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        // walk the uncapped backoff: after failure N the next delay is
        // 2^N times the configured delay, which stays below the cap through
        // failure 10 (50ms * 2^10 = 51.2s)
        for (let failures = 1; failures <= 10; failures += 1) {
          // Sequential by design: each fake-timer advance must resolve before
          // the next poll-count assertion. (eslint 8.x on 6.0 flags this;
          // apache/master's newer eslint does not — the code is identical.)
          // eslint-disable-next-line no-await-in-loop
          await jest.advanceTimersByTimeAsync(
            config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY * 2 ** failures,
          );
          expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(failures + 1);
        }

        // after failure 11 the uncapped delay would be 102.4s, so the cap
        // takes over: no poll just before the 60s mark...
        await jest.advanceTimersByTimeAsync(MAX_ERROR_POLLING_DELAY_MS - 1);
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(11);

        // ...and the next poll fires exactly at 60s
        await jest.advanceTimersByTimeAsync(1);
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(12);

        // additional failures remain capped at 60s
        await jest.advanceTimersByTimeAsync(MAX_ERROR_POLLING_DELAY_MS);
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(13);
      } finally {
        jest.useRealTimers();
      }
    });

    test('does not start a second loop when re-initialized during an in-flight poll', async () => {
      // stop the real-timer polling loop started by beforeEach before
      // switching to fake timers, so all polls run on the fake clock
      mockedIsFeatureEnabled.mockReturnValueOnce(false);
      asyncEvent.init(config);
      jest.useFakeTimers();
      try {
        fetchMock.reset();
        let resolveFetch: (response: any) => void = () => {};
        fetchMock.get(
          EVENTS_ENDPOINT,
          new Promise(resolve => {
            resolveFetch = resolve;
          }),
        );
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});

        // first poll fires and stays in-flight
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        // re-init while that fetch is pending, then let it resolve; the
        // stale invocation must not schedule a second loop
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});
        resolveFetch({ status: 200, body: { result: [] } });
        await jest.advanceTimersByTimeAsync(0);

        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, {
          status: 200,
          body: { result: [] },
        });

        // exactly one poll per delay from here on
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(2);
      } finally {
        jest.useRealTimers();
      }
    });

    test('does not resume polling when re-initialized with the feature disabled during an in-flight poll', async () => {
      // stop the real-timer polling loop started by beforeEach before
      // switching to fake timers, so all polls run on the fake clock
      mockedIsFeatureEnabled.mockReturnValueOnce(false);
      asyncEvent.init(config);
      jest.useFakeTimers();
      try {
        fetchMock.reset();
        let resolveFetch: (response: any) => void = () => {};
        fetchMock.get(
          EVENTS_ENDPOINT,
          new Promise(resolve => {
            resolveFetch = resolve;
          }),
        );
        asyncEvent.init(config);
        asyncEvent.waitForAsyncData(asyncPendingEvent).catch(() => {});

        // first poll fires and stays in-flight
        await jest.advanceTimersByTimeAsync(
          config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);

        // disable the feature and re-init while the fetch is pending; the
        // stale invocation must not restart the stopped loop when it resumes
        mockedIsFeatureEnabled.mockReturnValueOnce(false);
        asyncEvent.init(config);
        resolveFetch({ status: 200, body: { result: [] } });
        await jest.advanceTimersByTimeAsync(0);

        fetchMock.reset();
        fetchMock.get(EVENTS_ENDPOINT, {
          status: 200,
          body: { result: [] },
        });

        await jest.advanceTimersByTimeAsync(
          10 * config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY,
        );
        expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('ws transport', () => {
    let wsServer: WS;
    const config = {
      GLOBAL_ASYNC_QUERIES_TRANSPORT: 'ws',
      GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 50,
      GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL: 'ws://127.0.0.1:8080/',
    };

    beforeEach(async () => {
      fetchMock.get(EVENTS_ENDPOINT, {
        status: 200,
        body: { result: [asyncDoneEvent] },
      });
      fetchMock.get(CACHED_DATA_ENDPOINT, {
        status: 200,
        body: { result: chartData },
      });

      wsServer = new WS(config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL);
      asyncEvent.init(config);
    });

    afterEach(() => {
      WS.clean();
    });

    it('resolves with chart data on event done status', async () => {
      await wsServer.connected;

      const promise = asyncEvent.waitForAsyncData(asyncPendingEvent);

      wsServer.send(JSON.stringify(asyncDoneEvent));

      await expect(promise).resolves.toEqual([chartData]);

      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(0);
    });

    it('rejects on event error status', async () => {
      await wsServer.connected;

      const promise = asyncEvent.waitForAsyncData(asyncPendingEvent);

      wsServer.send(JSON.stringify(asyncErrorEvent));

      const errorResponse = parseErrorJson(asyncErrorEvent);

      await expect(promise).rejects.toEqual(errorResponse);

      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(0);
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(0);
    });

    it('rejects on cached data fetch error', async () => {
      fetchMock.reset();
      fetchMock.get(CACHED_DATA_ENDPOINT, {
        status: 400,
      });

      await wsServer.connected;

      const promise = asyncEvent.waitForAsyncData(asyncPendingEvent);

      wsServer.send(JSON.stringify(asyncDoneEvent));

      let error = '';
      try {
        await promise;
      } catch (err) {
        [{ error }] = err;
      } finally {
        expect(error).toEqual('Bad request');
      }

      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(0);
    });

    it('resolves when events are received before listener', async () => {
      await wsServer.connected;

      wsServer.send(JSON.stringify(asyncDoneEvent));

      const promise = asyncEvent.waitForAsyncData(asyncPendingEvent);
      await expect(promise).resolves.toEqual([chartData]);

      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(0);
    });
  });
});

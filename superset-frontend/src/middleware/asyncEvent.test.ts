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
import sinon from 'sinon';
import * as uiCore from '@superset-ui/core';
import * as asyncEvent from 'src/middleware/asyncEvent';

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
  let featureEnabledStub: any;

  beforeEach(async () => {
    featureEnabledStub = sinon.stub(uiCore, 'isFeatureEnabled');
    featureEnabledStub.withArgs('GLOBAL_ASYNC_QUERIES').returns(true);
  });

  afterEach(() => {
    fetchMock.reset();
    featureEnabledStub.restore();
  });

  afterAll(fetchMock.reset);

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
      await expect(
        asyncEvent.waitForAsyncData(asyncPendingEvent),
      ).resolves.toEqual([chartData]);

      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
    });

    it('rejects on event error status', async () => {
      fetchMock.reset();
      fetchMock.get(EVENTS_ENDPOINT, {
        status: 200,
        body: { result: [asyncErrorEvent] },
      });
      const errorResponse = await uiCore.parseErrorJson(asyncErrorEvent);
      await expect(
        asyncEvent.waitForAsyncData(asyncPendingEvent),
      ).rejects.toEqual(errorResponse);

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

      const errorResponse = [{ error: 'Bad Request' }];
      await expect(
        asyncEvent.waitForAsyncData(asyncPendingEvent),
      ).rejects.toEqual(errorResponse);

      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(1);
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

      const errorResponse = await uiCore.parseErrorJson(asyncErrorEvent);

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

      const errorResponse = [{ error: 'Bad Request' }];

      await expect(promise).rejects.toEqual(errorResponse);

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

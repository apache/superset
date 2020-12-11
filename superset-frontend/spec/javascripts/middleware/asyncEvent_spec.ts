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
import sinon from 'sinon';
import * as featureFlags from 'src/featureFlags';
import initAsyncEvents from 'src/middleware/asyncEvent';

jest.useFakeTimers();

describe('asyncEvent middleware', () => {
  const next = sinon.spy();
  const state = {
    charts: {
      123: {
        id: 123,
        status: 'loading',
        asyncJobId: 'foo123',
      },
      345: {
        id: 345,
        status: 'loading',
        asyncJobId: 'foo345',
      },
    },
  };
  const events = [
    {
      status: 'done',
      result_url: '/api/v1/chart/data/cache-key-1',
      job_id: 'foo123',
      channel_id: '999',
      errors: [],
    },
    {
      status: 'done',
      result_url: '/api/v1/chart/data/cache-key-2',
      job_id: 'foo345',
      channel_id: '999',
      errors: [],
    },
  ];
  const mockStore = {
    getState: () => state,
    dispatch: sinon.stub(),
  };
  const action = {
    type: 'GENERIC_ACTION',
  };
  const EVENTS_ENDPOINT = 'glob:*/api/v1/async_event/*';
  const CACHED_DATA_ENDPOINT = 'glob:*/api/v1/chart/data/*';
  const config = {
    GLOBAL_ASYNC_QUERIES_TRANSPORT: 'polling',
    GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 500,
  };
  let featureEnabledStub: any;

  function setup() {
    const getPendingComponents = sinon.stub();
    const successAction = sinon.spy();
    const errorAction = sinon.spy();
    const testCallback = sinon.stub();
    const testCallbackPromise = sinon.stub();
    testCallbackPromise.returns(
      new Promise(resolve => {
        testCallback.callsFake(resolve);
      }),
    );

    return {
      getPendingComponents,
      successAction,
      errorAction,
      testCallback,
      testCallbackPromise,
    };
  }

  beforeEach(() => {
    fetchMock.get(EVENTS_ENDPOINT, {
      status: 200,
      body: { result: [] },
    });
    fetchMock.get(CACHED_DATA_ENDPOINT, {
      status: 200,
      body: { result: { some: 'data' } },
    });
    featureEnabledStub = sinon.stub(featureFlags, 'isFeatureEnabled');
    featureEnabledStub.withArgs('GLOBAL_ASYNC_QUERIES').returns(true);
  });
  afterEach(() => {
    fetchMock.reset();
    next.resetHistory();
    featureEnabledStub.restore();
  });
  afterAll(fetchMock.reset);

  it('should initialize and call next', () => {
    const { getPendingComponents, successAction, errorAction } = setup();
    getPendingComponents.returns([]);
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
    });
    asyncEventMiddleware(mockStore)(next)(action);
    expect(next.callCount).toBe(1);
  });

  it('should fetch events when there are pending components', () => {
    const {
      getPendingComponents,
      successAction,
      errorAction,
      testCallback,
      testCallbackPromise,
    } = setup();
    getPendingComponents.returns(Object.values(state.charts));
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
      processEventsCallback: testCallback,
    });

    asyncEventMiddleware(mockStore)(next)(action);

    return testCallbackPromise().then(() => {
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
    });
  });

  it('should fetch cached when there are successful events', () => {
    const {
      getPendingComponents,
      successAction,
      errorAction,
      testCallback,
      testCallbackPromise,
    } = setup();
    fetchMock.reset();
    fetchMock.get(EVENTS_ENDPOINT, {
      status: 200,
      body: { result: events },
    });
    fetchMock.get(CACHED_DATA_ENDPOINT, {
      status: 200,
      body: { result: { some: 'data' } },
    });
    getPendingComponents.returns(Object.values(state.charts));
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
      processEventsCallback: testCallback,
    });

    asyncEventMiddleware(mockStore)(next)(action);

    return testCallbackPromise().then(() => {
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(2);
      expect(successAction.callCount).toBe(2);
    });
  });

  it('should call errorAction for cache fetch error responses', () => {
    const {
      getPendingComponents,
      successAction,
      errorAction,
      testCallback,
      testCallbackPromise,
    } = setup();
    fetchMock.reset();
    fetchMock.get(EVENTS_ENDPOINT, {
      status: 200,
      body: { result: events },
    });
    fetchMock.get(CACHED_DATA_ENDPOINT, {
      status: 400,
      body: { errors: ['error'] },
    });
    getPendingComponents.returns(Object.values(state.charts));
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
      processEventsCallback: testCallback,
    });

    asyncEventMiddleware(mockStore)(next)(action);

    return testCallbackPromise().then(() => {
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
      expect(fetchMock.calls(CACHED_DATA_ENDPOINT)).toHaveLength(2);
      expect(errorAction.callCount).toBe(2);
    });
  });

  it('should handle event fetching error responses', () => {
    const {
      getPendingComponents,
      successAction,
      errorAction,
      testCallback,
      testCallbackPromise,
    } = setup();
    fetchMock.reset();
    fetchMock.get(EVENTS_ENDPOINT, {
      status: 400,
      body: { message: 'error' },
    });
    getPendingComponents.returns(Object.values(state.charts));
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
      processEventsCallback: testCallback,
    });

    asyncEventMiddleware(mockStore)(next)(action);

    return testCallbackPromise().then(() => {
      expect(fetchMock.calls(EVENTS_ENDPOINT)).toHaveLength(1);
    });
  });

  it('should not fetch events when async queries are disabled', () => {
    featureEnabledStub.restore();
    featureEnabledStub = sinon.stub(featureFlags, 'isFeatureEnabled');
    featureEnabledStub.withArgs('GLOBAL_ASYNC_QUERIES').returns(false);
    const { getPendingComponents, successAction, errorAction } = setup();
    getPendingComponents.returns(Object.values(state.charts));
    const asyncEventMiddleware = initAsyncEvents({
      config,
      getPendingComponents,
      successAction,
      errorAction,
    });

    asyncEventMiddleware(mockStore)(next)(action);
    expect(getPendingComponents.called).toBe(false);
  });
});

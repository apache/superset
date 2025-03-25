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
import { SupersetClient } from '@superset-ui/core';
import sinon from 'sinon';
import { LOG_EVENT } from 'src/logger/actions';
import {
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_SPA_NAVIGATION,
} from 'src/logger/LogUtils';
import logger from 'src/middleware/loggerMiddleware';

describe('logger middleware', () => {
  const dashboardId = 123;
  const next = sinon.spy();
  const mockStore = {
    getState: () => ({
      dashboardInfo: {
        id: dashboardId,
      },
      impressionId: 'impression_id',
    }),
  };
  const action = {
    type: LOG_EVENT,
    payload: {
      eventName: LOG_ACTIONS_LOAD_CHART,
      eventData: {
        key: 'value',
        start_offset: 100,
      },
    },
  };

  const timeSandbox = sinon.createSandbox({
    useFakeTimers: true,
  });

  let postStub;
  beforeEach(() => {
    postStub = sinon.stub(SupersetClient, 'post');
  });
  afterEach(() => {
    next.resetHistory();
    postStub.restore();
    timeSandbox.clock.reset();
  });

  it('should listen to LOG_EVENT action type', () => {
    const action1 = {
      type: 'ACTION_TYPE',
      payload: {
        some: 'data',
      },
    };
    logger(mockStore)(next)(action1);
    expect(next.callCount).toBe(1);
  });

  it('should POST an event to /superset/log/ when called', () => {
    logger(mockStore)(next)(action);
    expect(next.callCount).toBe(0);

    timeSandbox.clock.tick(2000);
    expect(SupersetClient.post.callCount).toBe(1);
    expect(SupersetClient.post.getCall(0).args[0].endpoint).toMatch(
      '/superset/log/',
    );
  });

  it('should include ts, start_offset, event_name, impression_id, source, and source_id in every event', () => {
    const fetchLog = logger(mockStore)(next);
    fetchLog({
      type: LOG_EVENT,
      payload: {
        eventName: LOG_ACTIONS_SPA_NAVIGATION,
        eventData: { path: `/dashboard/${dashboardId}/` },
      },
    });
    timeSandbox.clock.tick(2000);
    fetchLog(action);
    timeSandbox.clock.tick(2000);
    expect(SupersetClient.post.callCount).toBe(2);
    const { events } = SupersetClient.post.getCall(1).args[0].postPayload;
    const mockEventdata = action.payload.eventData;
    const mockEventname = action.payload.eventName;
    expect(events[0]).toMatchObject({
      key: mockEventdata.key,
      event_name: mockEventname,
      impression_id: mockStore.getState().impressionId,
      source: 'dashboard',
      source_id: mockStore.getState().dashboardInfo.id,
      event_type: 'timing',
      dashboard_id: mockStore.getState().dashboardInfo.id,
    });

    expect(typeof events[0].ts).toBe('number');
    expect(typeof events[0].start_offset).toBe('number');
  });

  it('should debounce a few log requests to one', () => {
    const clock = sinon.useFakeTimers();
    logger(mockStore)(next)(action);
    logger(mockStore)(next)(action);
    logger(mockStore)(next)(action);
    clock.tick(2000);

    expect(SupersetClient.post.callCount).toBe(1);
    expect(
      SupersetClient.post.getCall(0).args[0].postPayload.events,
    ).toHaveLength(3);
  });

  it('should use navigator.sendBeacon if it exists', () => {
    const clock = sinon.useFakeTimers();
    const beaconMock = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      value: beaconMock,
    });

    logger(mockStore)(next)(action);
    expect(beaconMock.mock.calls.length).toBe(0);
    clock.tick(2000);

    expect(beaconMock.mock.calls.length).toBe(1);
    const endpoint = beaconMock.mock.calls[0][0];
    expect(endpoint).toMatch('/superset/log/');
  });

  it('should pass a guest token to sendBeacon if present', () => {
    const clock = sinon.useFakeTimers();
    const beaconMock = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      value: beaconMock,
    });
    SupersetClient.configure({ guestToken: 'token' });

    logger(mockStore)(next)(action);
    expect(beaconMock.mock.calls.length).toBe(0);
    clock.tick(2000);
    expect(beaconMock.mock.calls.length).toBe(1);

    const formData = beaconMock.mock.calls[0][1];
    expect(formData.getAll('guest_token')[0]).toMatch('token');
  });
});

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
import sinon, { SinonSpy, SinonStub } from 'sinon';
import { SupersetClient } from '@superset-ui/core';
import logger from 'src/middleware/loggerMiddleware';
import { LOG_EVENT } from 'src/logger/actions';
import {
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_SPA_NAVIGATION,
} from 'src/logger/LogUtils';
import { Dispatch } from 'redux';

interface LogEventAction {
  type: typeof LOG_EVENT;
  payload: {
    eventName: string;
    eventData: Record<string, unknown>;
  };
}

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('logger middleware', () => {
  const dashboardId = 123;
  const next: SinonSpy = sinon.spy();
  // Mock store with minimal state needed for tests
  const mockStore = {
    getState: () => ({
      dashboardInfo: {
        id: dashboardId,
      },
      impressionId: 'impression_id',
    }),
    dispatch: ((action: unknown) => action) as Dispatch,
  };
  const action: LogEventAction = {
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

  let postStub: SinonStub;
  beforeEach(() => {
    postStub = sinon.stub(SupersetClient, 'post');
  });
  afterEach(() => {
    next.resetHistory();
    postStub.restore();
    timeSandbox.clock.reset();
  });

  test('should listen to LOG_EVENT action type', () => {
    const action1 = {
      type: 'ACTION_TYPE',
      payload: {
        some: 'data',
      },
    };
    (logger as Function)(mockStore)(next)(action1);
    expect(next.callCount).toBe(1);
  });

  test('should POST an event to /superset/log/ when called', () => {
    (logger as Function)(mockStore)(next)(action);
    expect(next.callCount).toBe(0);

    timeSandbox.clock.tick(2000);
    expect(postStub.callCount).toBe(1);
    expect(postStub.getCall(0).args[0].endpoint).toMatch('/superset/log/');
  });

  test('should include ts, start_offset, event_name, impression_id, source, and source_id in every event', () => {
    // Set window.location to include /dashboard/ so the middleware adds dashboard context
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      value: { href: `http://localhost/dashboard/${dashboardId}/` },
      writable: true,
    });

    try {
      const fetchLog = (logger as Function)(mockStore)(next);
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
      expect(postStub.callCount).toBe(2);
      const { events } = postStub.getCall(1).args[0].postPayload;
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
    } finally {
      // Restore original location
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
      });
    }
  });

  test('should debounce a few log requests to one', () => {
    (logger as Function)(mockStore)(next)(action);
    (logger as Function)(mockStore)(next)(action);
    (logger as Function)(mockStore)(next)(action);
    timeSandbox.clock.tick(2000);

    expect(postStub.callCount).toBe(1);
    expect(postStub.getCall(0).args[0].postPayload.events).toHaveLength(3);
  });

  test('should use navigator.sendBeacon if it exists', () => {
    const beaconMock = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      value: beaconMock,
    });

    (logger as Function)(mockStore)(next)(action);
    expect(beaconMock.mock.calls.length).toBe(0);
    timeSandbox.clock.tick(2000);

    expect(beaconMock.mock.calls.length).toBe(1);
    const endpoint = beaconMock.mock.calls[0][0];
    expect(endpoint).toMatch('/superset/log/');
  });

  test('should pass a guest token to sendBeacon if present', () => {
    const beaconMock = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      value: beaconMock,
    });
    SupersetClient.configure({ guestToken: 'token' });

    (logger as Function)(mockStore)(next)(action);
    expect(beaconMock.mock.calls.length).toBe(0);
    timeSandbox.clock.tick(2000);
    expect(beaconMock.mock.calls.length).toBe(1);

    const formData = beaconMock.mock.calls[0][1];
    expect(formData.getAll('guest_token')[0]).toMatch('token');
  });
});

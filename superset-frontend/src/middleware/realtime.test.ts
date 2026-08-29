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
import {
  connectRealtime,
  dispatchRealtimeMessage,
  resetRealtimeForTests,
  subscribeRealtime,
  type RealtimeMessage,
} from 'src/middleware/realtime';

// A minimal fake WebSocket so connectRealtime can "open" a socket without a
// real network connection. Instances register themselves so a test can drive
// onmessage/onclose.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: (() => void) | null = null;

  onerror: (() => void) | null = null;

  close = jest.fn(() => {
    this.readyState = 3;
  });

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
}

const originalWebSocket = global.WebSocket;

beforeEach(() => {
  FakeWebSocket.instances = [];
  global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  resetRealtimeForTests();
  global.WebSocket = originalWebSocket;
});

const ENABLED = {
  WEBSOCKET_ENABLE: true,
  WEBSOCKET_URL: 'ws://localhost:8080/',
};

test('dispatches a parsed envelope to every subscribed handler', () => {
  const a = jest.fn();
  const b = jest.fn();
  subscribeRealtime(a);
  subscribeRealtime(b);

  dispatchRealtimeMessage(
    JSON.stringify({ channel: 'entity-changes:task', payload: { id: '7' } }),
  );

  const expected: RealtimeMessage = {
    channel: 'entity-changes:task',
    payload: { id: '7' },
  };
  expect(a).toHaveBeenCalledWith(expected);
  expect(b).toHaveBeenCalledWith(expected);
});

test('unsubscribe stops a handler from receiving further messages', () => {
  const handler = jest.fn();
  const unsubscribe = subscribeRealtime(handler);

  unsubscribe();
  dispatchRealtimeMessage(
    JSON.stringify({ channel: 'entity-changes:task', payload: {} }),
  );

  expect(handler).not.toHaveBeenCalled();
});

test('ignores malformed data and messages without a channel', () => {
  const handler = jest.fn();
  subscribeRealtime(handler);

  expect(() => dispatchRealtimeMessage('not json')).not.toThrow();
  dispatchRealtimeMessage(JSON.stringify({ payload: { id: '7' } })); // no channel

  expect(handler).not.toHaveBeenCalled();
});

test('a throwing handler does not break other handlers', () => {
  const bad = jest.fn(() => {
    throw new Error('boom');
  });
  const good = jest.fn();
  subscribeRealtime(bad);
  subscribeRealtime(good);

  expect(() =>
    dispatchRealtimeMessage(
      JSON.stringify({ channel: 'entity-changes:task', payload: {} }),
    ),
  ).not.toThrow();
  expect(good).toHaveBeenCalledTimes(1);
});

test('does not open a socket when disabled', () => {
  connectRealtime({ WEBSOCKET_ENABLE: false, WEBSOCKET_URL: 'ws://x/' });
  expect(FakeWebSocket.instances).toHaveLength(0);
});

test('opens a socket when enabled and routes its messages to handlers', () => {
  const handler = jest.fn();
  subscribeRealtime(handler);
  connectRealtime(ENABLED);

  expect(FakeWebSocket.instances).toHaveLength(1);
  const ws = FakeWebSocket.instances[0];
  // The connect URL is the configured base plus this tab's id, so the server
  // can bind a per-tab channel. getTabId is mocked to 'test-tab-id' (shim).
  const wsUrl = new URL(ws.url);
  expect(`${wsUrl.protocol}//${wsUrl.host}${wsUrl.pathname}`).toBe(
    ENABLED.WEBSOCKET_URL,
  );
  expect(wsUrl.searchParams.get('tab_id')).toBe('test-tab-id');

  ws.onmessage?.({
    data: JSON.stringify({ channel: 'realtime:user:1', payload: { ok: true } }),
  });

  expect(handler).toHaveBeenCalledWith({
    channel: 'realtime:user:1',
    payload: { ok: true },
  });
});

test('keeps the active socket when reconnecting with the same config', () => {
  connectRealtime(ENABLED);
  connectRealtime(ENABLED);

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(FakeWebSocket.instances[0].close).not.toHaveBeenCalled();
});

test('reconnects after the socket closes', () => {
  jest.useFakeTimers();
  connectRealtime(ENABLED);
  expect(FakeWebSocket.instances).toHaveLength(1);

  FakeWebSocket.instances[0].onclose?.();
  jest.advanceTimersByTime(5000);

  expect(FakeWebSocket.instances).toHaveLength(2);
  jest.useRealTimers();
});

test('disconnect closes the socket and stops reconnecting', () => {
  jest.useFakeTimers();
  connectRealtime(ENABLED);
  const ws = FakeWebSocket.instances[0];

  // disconnect via a superseding reset; the prior socket must not reconnect.
  resetRealtimeForTests();
  expect(ws.close).toHaveBeenCalled();

  ws.onclose?.(); // a late close from the torn-down socket
  jest.advanceTimersByTime(5000);
  expect(FakeWebSocket.instances).toHaveLength(1); // no new socket
  jest.useRealTimers();
});

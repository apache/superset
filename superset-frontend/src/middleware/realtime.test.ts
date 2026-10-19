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
import {
  connectRealtime,
  dispatchRealtimeMessage,
  getRealtimeState,
  resetRealtimeForTests,
  subscribeRealtime,
  subscribeRealtimeOpen,
  subscribeRealtimeState,
} from 'src/middleware/realtime';

// Controllable useTabId mock (overrides the global shim for this file) so we can
// drive both the current tab id sent in the `auth` frame and tab-id-change
// notifications. `var` + lazy init sidesteps jest.mock hoisting/TDZ.
/* eslint-disable no-var, vars-on-top */
var mockTabIdValue: string;
var mockTabIdListeners: Set<() => void>;
/* eslint-enable no-var, vars-on-top */
jest.mock('src/hooks/useTabId', () => {
  mockTabIdValue = 'test-tab-id';
  mockTabIdListeners = new Set();
  return {
    useTabId: () => 1,
    getTabId: () => mockTabIdValue,
    subscribeTabIdChange: (listener: () => void) => {
      mockTabIdListeners.add(listener);
      return () => mockTabIdListeners.delete(listener);
    },
  };
});

/** Simulate useTabId reassigning this tab a new id (TAB_ID_DENIED collision). */
const fireTabIdChange = (newId: string) => {
  mockTabIdValue = newId;
  mockTabIdListeners.forEach(listener => listener());
};

// A minimal fake WebSocket so connectRealtime can "open" a socket without a
// real network connection. Instances register themselves so a test can drive
// onopen/onmessage/onclose and inspect what the client sent.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readyState = 0;

  onopen: (() => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: ((event: { code: number }) => void) | null = null;

  onerror: (() => void) | null = null;

  sent: string[] = [];

  send = jest.fn((data: string) => {
    this.sent.push(data);
  });

  close = jest.fn(() => {
    this.readyState = 3;
  });

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  /** The `auth` frames the client has sent, parsed. */
  get authFrames(): Array<{ type: string; token: string; tab_id: string }> {
    return this.sent.map(frame => JSON.parse(frame));
  }
}

const originalWebSocket = global.WebSocket;

const ENABLED = {
  WEBSOCKET_ENABLE: true,
  WEBSOCKET_URL: 'ws://localhost:8080/',
};

let getSpy: jest.SpyInstance;
let ticketCount: number;

/** Resolve the ticket endpoint with a distinct token and the given lifetime. */
const serveTickets = (expiresIn = 60) => {
  ticketCount = 0;
  getSpy.mockImplementation(async () => {
    ticketCount += 1;
    return { json: { token: `ticket-${ticketCount}`, expires_in: expiresIn } };
  });
};

/** Reject the ticket endpoint like SupersetClient does: with the Response. */
const rejectTickets = (status: number) => {
  getSpy.mockRejectedValue({ status });
};

// Let pending promise continuations (the ticket fetch) run.
const flush = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const lastSocket = () =>
  FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

/** The server's acknowledgement of an `auth` frame. */
const ack = (ws: FakeWebSocket, expiresIn = 60) =>
  ws.onmessage?.({
    data: JSON.stringify({
      topic: 'realtime.auth',
      payload: { status: 'ok', expires_in: expiresIn },
    }),
  });

/** Connect, open the socket, and have the server acknowledge the first frame. */
const connectAuthenticated = async (expiresIn = 60) => {
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();
  ws.readyState = 1;
  ws.onopen?.();
  ack(ws, expiresIn);
  return ws;
};

beforeEach(() => {
  jest.useFakeTimers();
  FakeWebSocket.instances = [];
  global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  getSpy = jest.spyOn(SupersetClient, 'get');
  serveTickets();
});

afterEach(() => {
  resetRealtimeForTests();
  global.WebSocket = originalWebSocket;
  mockTabIdValue = 'test-tab-id';
  getSpy.mockRestore();
  jest.useRealTimers();
});

test('dispatches a parsed envelope to every handler of its topic', () => {
  const a = jest.fn();
  const b = jest.fn();
  subscribeRealtime('entity.changed', a);
  subscribeRealtime('entity.changed', b);

  dispatchRealtimeMessage(
    JSON.stringify({ topic: 'entity.changed', payload: { id: '7' } }),
  );

  expect(a).toHaveBeenCalledWith({ id: '7' });
  expect(b).toHaveBeenCalledWith({ id: '7' });
});

test('dispatches only to handlers subscribed to the message topic', () => {
  const taskStatus = jest.fn();
  const entityChanged = jest.fn();
  subscribeRealtime('task.status', taskStatus);
  subscribeRealtime('entity.changed', entityChanged);

  dispatchRealtimeMessage(
    JSON.stringify({ topic: 'task.status', payload: { task_id: 'a' } }),
  );

  expect(taskStatus).toHaveBeenCalledWith({ task_id: 'a' });
  expect(entityChanged).not.toHaveBeenCalled();
});

test('unsubscribe stops a handler from receiving further messages', () => {
  const handler = jest.fn();
  const unsubscribe = subscribeRealtime('entity.changed', handler);

  unsubscribe();
  dispatchRealtimeMessage(
    JSON.stringify({ topic: 'entity.changed', payload: {} }),
  );

  expect(handler).not.toHaveBeenCalled();
});

test('ignores malformed data and messages without a topic', () => {
  const handler = jest.fn();
  subscribeRealtime('entity.changed', handler);

  expect(() => dispatchRealtimeMessage('not json')).not.toThrow();
  dispatchRealtimeMessage(JSON.stringify({ payload: { id: '7' } })); // no topic

  expect(handler).not.toHaveBeenCalled();
});

test('a throwing handler does not break other handlers', () => {
  const bad = jest.fn(() => {
    throw new Error('boom');
  });
  const good = jest.fn();
  subscribeRealtime('entity.changed', bad);
  subscribeRealtime('entity.changed', good);

  expect(() =>
    dispatchRealtimeMessage(
      JSON.stringify({ topic: 'entity.changed', payload: {} }),
    ),
  ).not.toThrow();
  expect(good).toHaveBeenCalledTimes(1);
});

test('does not open a socket when disabled', async () => {
  connectRealtime({ WEBSOCKET_ENABLE: false, WEBSOCKET_URL: 'ws://x/' });
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(getSpy).not.toHaveBeenCalled();
});

test('fetches a ticket, keeps it out of the URL, and authenticates in-band', async () => {
  const states: string[] = [];
  subscribeRealtimeState(state => states.push(state));
  connectRealtime(ENABLED);
  await flush();

  expect(getSpy).toHaveBeenCalledWith({ endpoint: '/api/v1/realtime/token/' });
  const ws = lastSocket();
  expect(ws.url).toBe(ENABLED.WEBSOCKET_URL);

  ws.readyState = 1;
  ws.onopen?.();
  // The first frame carries the ticket and this tab's id.
  expect(ws.authFrames).toEqual([
    { type: 'auth', token: 'ticket-1', tab_id: 'test-tab-id' },
  ]);
  // Not reported open until the server acknowledges the ticket.
  expect(states).toEqual(['connecting']);

  ack(ws);
  expect(states).toEqual(['connecting', 'open']);
});

test('resolves a root-relative ws url against the page', async () => {
  connectRealtime({ WEBSOCKET_ENABLE: true, WEBSOCKET_URL: '/superset-ws' });
  await flush();

  const u = new URL(lastSocket().url);
  expect(u.protocol).toBe('ws:'); // jsdom page is http:// -> ws://
  expect(u.pathname).toBe('/superset-ws');
  expect(u.search).toBe('');
});

test('routes socket messages to handlers only after the server acknowledges auth', async () => {
  const handler = jest.fn();
  subscribeRealtime('task.status', handler);
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();
  const message = {
    data: JSON.stringify({ topic: 'task.status', payload: { ok: true } }),
  };

  ws.onmessage?.(message);
  expect(handler).not.toHaveBeenCalled();

  ack(ws);
  ws.onmessage?.(message);
  expect(handler).toHaveBeenCalledWith({ ok: true });
});

test('notifies open-listeners once per connection, when auth is acknowledged', async () => {
  const reasons: string[] = [];
  subscribeRealtimeOpen(reason => reasons.push(reason));
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();
  ws.readyState = 1;
  ws.onopen?.();
  expect(reasons).toEqual([]);

  ack(ws);
  ack(ws); // a refresh acknowledgement is not a new connection

  expect(reasons).toEqual(['initial']);
});

test('keeps the active socket when reconnecting with the same config', async () => {
  const ws = await connectAuthenticated();

  connectRealtime(ENABLED);
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(ws.close).not.toHaveBeenCalled();
});

test('refreshes the ticket on the open socket at 75% of its lifetime', async () => {
  const ws = await connectAuthenticated(60);
  expect(getSpy).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(44_000);
  await flush();
  expect(getSpy).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1_000);
  await flush();

  // A fresh ticket goes out on the same socket: no teardown, no reconnect.
  expect(getSpy).toHaveBeenCalledTimes(2);
  expect(ws.authFrames.map(frame => frame.token)).toEqual([
    'ticket-1',
    'ticket-2',
  ]);
  expect(ws.close).not.toHaveBeenCalled();
  expect(FakeWebSocket.instances).toHaveLength(1);

  // The server's reply schedules the next refresh from its reported lifetime.
  ack(ws, 60);
  jest.advanceTimersByTime(45_000);
  await flush();
  expect(ws.authFrames.map(frame => frame.token)).toEqual([
    'ticket-1',
    'ticket-2',
    'ticket-3',
  ]);
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('a socket survives several ticket lifetimes with zero reconnects', async () => {
  const ws = await connectAuthenticated(60);

  for (let i = 0; i < 4; i += 1) {
    jest.advanceTimersByTime(45_000);
    // eslint-disable-next-line no-await-in-loop
    await flush();
    ack(ws, 60);
  }

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(ws.close).not.toHaveBeenCalled();
  expect(ws.authFrames).toHaveLength(5);
});

test('retries a transient ticket failure during refresh until expiry', async () => {
  const ws = await connectAuthenticated(60);
  getSpy.mockRejectedValue({ status: 503 });

  jest.advanceTimersByTime(45_000);
  await flush();
  expect(getSpy).toHaveBeenCalledTimes(2);

  jest.advanceTimersByTime(1_000);
  await flush();
  expect(getSpy).toHaveBeenCalledTimes(3);

  // Service recovers: the next retry sends the fresh ticket.
  serveTickets(60);
  jest.advanceTimersByTime(2_000);
  await flush();
  expect(ws.authFrames).toHaveLength(2);
  expect(ws.close).not.toHaveBeenCalled();
});

test('stops retrying a failing refresh once the ticket has expired', async () => {
  await connectAuthenticated(60);
  getSpy.mockRejectedValue({ status: 503 });

  jest.advanceTimersByTime(45_000 + 15_000);
  await flush();
  const callsAtExpiry = getSpy.mock.calls.length;

  jest.advanceTimersByTime(60_000);
  await flush();

  expect(getSpy.mock.calls.length).toBe(callsAtExpiry);
});

test('an unauthorized ticket request is terminal: no socket, no retries', async () => {
  rejectTickets(401);
  const states: string[] = [];
  subscribeRealtimeState(state => states.push(state));

  connectRealtime(ENABLED);
  await flush();
  jest.advanceTimersByTime(5 * 60_000);
  await flush();

  expect(states).toEqual(['connecting', 'unauthorized']);
  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('a forbidden ticket request is terminal too', async () => {
  rejectTickets(403);
  const states: string[] = [];
  subscribeRealtimeState(state => states.push(state));

  connectRealtime(ENABLED);
  await flush();

  expect(states[states.length - 1]).toBe('unauthorized');
  expect(FakeWebSocket.instances).toHaveLength(0);
});

test('losing authorization at refresh closes the socket and stops connecting', async () => {
  const ws = await connectAuthenticated(60);
  const states: string[] = [];
  subscribeRealtimeState(state => states.push(state));
  rejectTickets(401);

  jest.advanceTimersByTime(45_000);
  await flush();
  jest.advanceTimersByTime(5 * 60_000);
  await flush();

  expect(states).toEqual(['unauthorized']);
  expect(ws.close).toHaveBeenCalled();
  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('reconnects immediately with a fresh ticket when the server closes with 4401', async () => {
  const ws = await connectAuthenticated();

  ws.readyState = 3;
  ws.onclose?.({ code: 4401 });
  await flush();

  // No backoff timer was needed.
  expect(FakeWebSocket.instances).toHaveLength(2);
  expect(getSpy).toHaveBeenCalledTimes(2);
  const next = lastSocket();
  next.readyState = 1;
  next.onopen?.();
  expect(next.authFrames[0].token).toBe('ticket-2');
});

test('reports a reconnect after 4401 as reason `reconnect`', async () => {
  const reasons: string[] = [];
  subscribeRealtimeOpen(reason => reasons.push(reason));
  const ws = await connectAuthenticated();

  ws.readyState = 3;
  ws.onclose?.({ code: 4401 });
  await flush();
  const next = lastSocket();
  next.readyState = 1;
  next.onopen?.();
  ack(next);

  expect(reasons).toEqual(['initial', 'reconnect']);
});

test('backs off after other closes, fetching a fresh ticket on each attempt', async () => {
  const ws = await connectAuthenticated();

  ws.readyState = 3;
  ws.onclose?.({ code: 1006 });
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(1);

  jest.advanceTimersByTime(5_000);
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(2);
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('a 4401 on a connection that never authenticated backs off', async () => {
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();
  ws.readyState = 1;
  ws.onopen?.();

  ws.readyState = 3;
  ws.onclose?.({ code: 4401 });
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(1);

  jest.advanceTimersByTime(5_000);
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(2);
});

test('abandons and retries a connection the server never acknowledges', async () => {
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();
  ws.readyState = 1;
  ws.onopen?.();

  jest.advanceTimersByTime(10_000);
  expect(ws.close).toHaveBeenCalled();

  jest.advanceTimersByTime(5_000);
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(2);
});

test('reports reconnecting then unhealthy after repeated failures, and open resets it', async () => {
  const states: string[] = [];
  subscribeRealtimeState(s => states.push(s));
  connectRealtime(ENABLED);
  await flush();

  // Three consecutive closes with no successful OPEN in between.
  for (let i = 0; i < 3; i += 1) {
    lastSocket().onclose?.({ code: 1006 });
    // Advance past the max backoff so the scheduled reconnect fires.
    jest.advanceTimersByTime(30_000);
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
  expect(states).toContain('reconnecting');
  expect(states).toContain('unhealthy');

  // A successful, acknowledged connection clears the failure state.
  const ws = lastSocket();
  ws.readyState = 1;
  ws.onopen?.();
  ack(ws);
  expect(states[states.length - 1]).toBe('open');
});

test('a failed ticket fetch is retried with backoff and counts toward unhealthy', async () => {
  getSpy.mockRejectedValue({ status: 500 });
  const states: string[] = [];
  subscribeRealtimeState(s => states.push(s));

  connectRealtime(ENABLED);
  await flush();
  for (let i = 0; i < 3; i += 1) {
    jest.advanceTimersByTime(30_000);
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }

  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(getSpy.mock.calls.length).toBeGreaterThan(1);
  expect(states).toContain('unhealthy');
});

test('a synchronous WebSocket constructor failure still schedules a reconnect', async () => {
  const Broken = jest.fn(() => {
    throw new Error('construct failed');
  });
  global.WebSocket = Broken as unknown as typeof WebSocket;

  connectRealtime(ENABLED);
  await flush();
  // The throw is caught; a reconnect is scheduled rather than dead-ending, so the
  // constructor is retried (repeatedly, with backoff) instead of only once.
  for (let i = 0; i < 3; i += 1) {
    jest.advanceTimersByTime(30_000);
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
  expect(Broken.mock.calls.length).toBeGreaterThan(1);
});

test('re-authenticates in place with the new tab id when the tab id changes', async () => {
  const ws = await connectAuthenticated();
  expect(ws.authFrames[0].tab_id).toBe('test-tab-id');

  // A duplicated tab is reassigned a new id: the server must rebind the per-tab
  // channel (else tab-targeted events miss it and only polling notices
  // completion), and it does so from an `auth` frame on the live socket.
  const reasons: string[] = [];
  subscribeRealtimeOpen(reason => reasons.push(reason));
  fireTabIdChange('tab-2');
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(ws.close).not.toHaveBeenCalled();
  expect(ws.authFrames[1]).toEqual({
    type: 'auth',
    token: 'ticket-2',
    tab_id: 'tab-2',
  });

  // The rebind acknowledgement raises exactly one reconciliation event, so a
  // message sent to the old tab channel in the meantime is not lost.
  expect(reasons).toEqual([]);
  ack(ws);
  expect(reasons).toEqual(['rebind']);
});

test('an ordinary ticket refresh acknowledgement raises no open event', async () => {
  const reasons: string[] = [];
  subscribeRealtimeOpen(reason => reasons.push(reason));
  const ws = await connectAuthenticated(60);
  expect(reasons).toEqual(['initial']);

  jest.advanceTimersByTime(45_000);
  await flush();
  ack(ws, 60);

  expect(reasons).toEqual(['initial']);
});

test('a tab id change before the socket is open is picked up by the first frame', async () => {
  connectRealtime(ENABLED);
  await flush();
  const ws = lastSocket();

  fireTabIdChange('tab-2');
  await flush();
  ws.readyState = 1;
  ws.onopen?.();

  expect(ws.authFrames).toEqual([
    { type: 'auth', token: 'ticket-1', tab_id: 'tab-2' },
  ]);
});

test('disconnect closes the socket and stops reconnecting', async () => {
  const ws = await connectAuthenticated();

  // disconnect via a superseding reset; the prior socket must not reconnect.
  resetRealtimeForTests();
  expect(ws.close).toHaveBeenCalled();

  ws.onclose?.({ code: 1006 }); // a late close from the torn-down socket
  jest.advanceTimersByTime(5_000);
  await flush();
  expect(FakeWebSocket.instances).toHaveLength(1); // no new socket
});

test('a ticket that arrives after disconnect does not open a socket', async () => {
  connectRealtime(ENABLED);
  resetRealtimeForTests();
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(0);
});

/** A ticket endpoint whose responses the test releases by hand. */
const deferTickets = () => {
  const pending: Array<
    (ticket: { token: string; expires_in: number }) => void
  > = [];
  getSpy.mockImplementation(
    () =>
      new Promise(resolve => {
        pending.push(json => resolve({ json }));
      }),
  );
  return pending;
};

test('a ticket fetched for a refresh is dropped if the client disconnected meanwhile', async () => {
  const ws = await connectAuthenticated(60);
  const pending = deferTickets();

  jest.advanceTimersByTime(45_000); // refresh starts; its fetch is in flight
  expect(pending).toHaveLength(1);
  resetRealtimeForTests();
  pending[0]({ token: 'late', expires_in: 60 });
  await flush();

  expect(ws.authFrames.map(frame => frame.token)).toEqual(['ticket-1']);
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('a superseded connect attempt cannot open a socket after a reconfigure', async () => {
  const pending = deferTickets();
  connectRealtime(ENABLED);
  await flush();
  connectRealtime({ ...ENABLED, WEBSOCKET_URL: 'ws://other:8080/' });
  await flush();
  expect(pending).toHaveLength(2);

  // The older attempt's ticket arrives last and must be ignored.
  pending[1]({ token: 'new', expires_in: 60 });
  await flush();
  pending[0]({ token: 'old', expires_in: 60 });
  await flush();

  expect(FakeWebSocket.instances).toHaveLength(1);
  expect(lastSocket().url).toBe('ws://other:8080/');
});

test('an auth ack from an obsolete socket does not authenticate the current one', async () => {
  const states: string[] = [];
  const reasons: string[] = [];
  const handler = jest.fn();
  subscribeRealtime('task.status', handler);
  const old = await connectAuthenticated(60);
  subscribeRealtimeState(state => states.push(state));
  subscribeRealtimeOpen(reason => reasons.push(reason));

  old.readyState = 3;
  old.onclose?.({ code: 1006 });
  jest.advanceTimersByTime(5_000);
  await flush();
  const current = lastSocket();
  expect(current).not.toBe(old);
  current.readyState = 1;
  current.onopen?.();

  // A delayed ack, a close and a message from the dead socket arrive late.
  ack(old, 60);
  old.onclose?.({ code: 4401 });
  old.onmessage?.({
    data: JSON.stringify({ topic: 'task.status', payload: { stale: true } }),
  });
  await flush();

  expect(states).not.toContain('open');
  expect(reasons).toEqual([]);
  expect(handler).not.toHaveBeenCalled();
  expect(FakeWebSocket.instances).toHaveLength(2);

  // The current socket still authenticates normally.
  ack(current, 60);
  expect(states[states.length - 1]).toBe('open');
  expect(reasons).toEqual(['reconnect']);
});

test.each([
  ['404 from an older web server', { status: 404 }],
  ['500', { status: 500 }],
  ['502', { status: 502 }],
  ['a network error', new TypeError('Failed to fetch')],
])(
  '%s is transient: it backs off and retries, never unauthorized',
  async (_label, error) => {
    getSpy.mockRejectedValue(error);
    const states: string[] = [];
    subscribeRealtimeState(state => states.push(state));

    connectRealtime(ENABLED);
    await flush();
    jest.advanceTimersByTime(5_000);
    await flush();

    expect(states).not.toContain('unauthorized');
    expect(states).toContain('reconnecting');
    expect(getSpy.mock.calls.length).toBeGreaterThan(1);

    // Once the endpoint appears (the rollout finished) the client connects.
    serveTickets();
    jest.advanceTimersByTime(30_000);
    await flush();
    expect(FakeWebSocket.instances).toHaveLength(1);
  },
);

test('getRealtimeState reflects the latest transition', async () => {
  rejectTickets(401);
  connectRealtime(ENABLED);
  await flush();

  expect(getRealtimeState()).toBe('unauthorized');
});

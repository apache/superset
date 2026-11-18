/*
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

import { Capability } from '../src/capabilities';
import {
  BridgeLimits,
  ChannelError,
  createChannelKey,
  createFrameChannel,
  DEFAULT_BRIDGE_LIMITS,
  HANDSHAKE_TIMEOUT_MS,
} from '../src/host';
import {
  BindingData,
  FrameRequest,
  FrameState,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
} from '../src/protocol';
import { createFakeWindow, fakeFrame } from './fakes';

const HOST_ORIGIN = 'https://superset.example.com';
const region = {
  binding: 'revenue_by_region',
  dimension: 'region',
  values: ['EMEA'],
};
const state: FrameState = {
  status: 'ok',
  filters: [{ kind: 'filter', source: 'year-filter', value: 2026 }],
  theme: { mode: 'light', tokens: { colorPrimary: '#20a7c9' } },
};
const revenue: BindingData = {
  rows: [
    { region: 'EMEA', revenue: 10 },
    { region: 'APAC', revenue: 7 },
    { region: null, revenue: 1 },
  ],
};

interface SetupOptions {
  limits?: Partial<BridgeLimits>;
  onHandshakeTimeout?: () => void;
  queriesPerRequest?: number;
}

function setup(
  grant: Capability[] = [Capability.DATA, Capability.CROSS_FILTER],
  { limits, onHandshakeTimeout, queriesPerRequest }: SetupOptions = {},
) {
  const host = createFakeWindow({ origin: HOST_ORIGIN });
  const frameWindow = createFakeWindow({ parent: host.window });
  const requests: FrameRequest[] = [];
  const errors: ChannelError[] = [];
  const channel = createFrameChannel({
    frame: fakeFrame(frameWindow.window),
    grant,
    onRequest: request => {
      requests.push(request);
    },
    onError: error => {
      errors.push(error);
    },
    limits,
    queriesPerRequest,
    onHandshakeTimeout,
    hostWindow: host.window,
  });
  const { k } = JSON.parse(channel.name) as { k: string };
  const fromFrame = (data: Record<string, unknown>) =>
    host.deliver(frameWindow.window, { k, ...data });
  const handshake = () =>
    fromFrame({
      type: 'ready',
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
    });
  const request = (body: Record<string, unknown>) =>
    fromFrame({ type: 'request', request: body });
  const crossFilter = (values: unknown[], dimension = 'region') =>
    request({
      type: 'setCrossFilter',
      value: { binding: 'revenue_by_region', dimension, values },
    });
  return {
    channel,
    crossFilter,
    errors,
    frameWindow,
    fromFrame,
    handshake,
    host,
    k,
    request,
    requests,
  };
}

/** A channel past its handshake that delivered `revenue` to the frame. */
function delivered(options: SetupOptions = {}) {
  const opened = setup(undefined, options);
  opened.handshake();
  opened.channel.postData('revenue_by_region', revenue);
  return opened;
}

afterEach(() => {
  vi.useRealTimers();
});

test('the iframe name carries the key, the grant and the host origin', () => {
  const { channel, k } = setup([Capability.DATA]);
  expect(JSON.parse(channel.name)).toEqual({
    k,
    grant: [Capability.DATA],
    origin: HOST_ORIGIN,
  });
  expect(k).toMatch(/^[0-9a-f]{32}$/);
});

test('a grant drops values that are not capabilities', () => {
  const { channel } = setup(['data', 'compute'] as unknown as Capability[]);
  expect(JSON.parse(channel.name).grant).toEqual([Capability.DATA]);
});

test('state waits for the handshake, then follows every update', () => {
  const { channel, frameWindow, handshake, k } = setup();
  channel.postState(state);
  expect(frameWindow.posted).toHaveLength(0);

  handshake();
  expect(frameWindow.posted).toEqual([
    {
      message: {
        k,
        type: 'state',
        state: { status: 'ok', filters: state.filters },
      },
      targetOrigin: '*',
    },
  ]);

  channel.postState({ ...state, status: 'loading' });
  expect(frameWindow.posted).toHaveLength(2);
});

test('data waits for the handshake, and goes before the state', () => {
  const { channel, frameWindow, handshake, k } = setup();
  const costs = { rows: [{ region: 'EMEA', cost: 4 }] };
  channel.postState(state);
  channel.postData('revenue_by_region', { rows: [] });
  channel.postData('revenue_by_region', revenue);
  channel.postData('costs', costs);
  expect(frameWindow.posted).toHaveLength(0);

  handshake();
  expect(frameWindow.posted.map(posted => posted.message)).toEqual([
    { k, type: 'data', binding: 'revenue_by_region', data: revenue },
    { k, type: 'data', binding: 'costs', data: costs },
    { k, type: 'state', state: { status: 'ok', filters: state.filters } },
  ]);
  expect(frameWindow.posted.every(posted => posted.targetOrigin === '*')).toBe(
    true,
  );
});

test("a binding's result is sent again only when it changes", () => {
  const { channel, frameWindow, handshake, k } = setup();
  handshake();
  const costs = { rows: [{ region: 'EMEA', cost: 4 }] };
  channel.postData('revenue_by_region', revenue);
  channel.postData('costs', costs);
  channel.postData('revenue_by_region', revenue);
  channel.postData('costs', costs);
  expect(frameWindow.posted).toHaveLength(2);

  const fresh = { rows: [{ region: 'EMEA', cost: 5 }] };
  channel.postData('revenue_by_region', revenue);
  channel.postData('costs', fresh);
  expect(frameWindow.posted).toHaveLength(3);
  expect(frameWindow.posted[2].message).toEqual({
    k,
    type: 'data',
    binding: 'costs',
    data: fresh,
  });
});

test('data needs the data capability', () => {
  const { channel, frameWindow, handshake } = setup([Capability.THEME]);
  channel.postData('revenue_by_region', revenue);
  handshake();
  channel.postData('revenue_by_region', revenue);
  expect(frameWindow.posted).toEqual([]);
});

test('state is trimmed to the grant', () => {
  const { channel, frameWindow, handshake, k } = setup([Capability.THEME]);
  handshake();
  channel.postState({ ...state, error: 'partial results' });
  expect(frameWindow.posted[0].message).toEqual({
    k,
    type: 'state',
    state: {
      status: 'ok',
      filters: [],
      theme: state.theme,
      error: 'partial results',
    },
  });
});

test('passes granted requests on, as clean copies', () => {
  const { fromFrame, requests } = delivered();
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: { ...region, extra: 'x' } },
  });
  fromFrame({
    type: 'request',
    request: {
      type: 'query',
      binding: 'revenue_by_region',
      params: { time_range: 'Last quarter' },
    },
  });
  expect(requests).toEqual([
    { type: 'setCrossFilter', value: region },
    {
      type: 'query',
      binding: 'revenue_by_region',
      params: { time_range: 'Last quarter' },
    },
  ]);
  expect(Object.keys(requests[0])).toEqual(['type', 'value']);
});

test('refuses requests that the grant does not cover', () => {
  const { errors, fromFrame, handshake, requests } = setup([Capability.THEME]);
  handshake();
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  fromFrame({ type: 'request', request: { type: 'refresh' } });

  expect(requests).toEqual([]);
  expect(errors.map(error => error.source)).toEqual(['host', 'host']);
  expect(errors[0].message).toMatch(/"cross_filter" capability/);
  expect(errors[1].message).toMatch(/"data" capability/);
});

test('refuses requests before the handshake', () => {
  const { errors, fromFrame, requests } = setup();
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  expect(requests).toEqual([]);
  expect(errors).toHaveLength(1);
  expect(errors[0].message).toMatch(/not ready/);
});

test('refuses a handshake in another protocol version', () => {
  const { channel, errors, frameWindow, fromFrame, requests } = setup();
  channel.postState(state);
  fromFrame({
    type: 'ready',
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION + 1,
  });
  fromFrame({
    type: 'request',
    request: { type: 'query', binding: 'b', params: {} },
  });

  expect(frameWindow.posted).toEqual([]);
  expect(requests).toEqual([]);
  expect(errors[0].source).toBe('host');
  expect(errors[0].message).toMatch(/speaks superset-artifacts 2/);
});

test('ignores messages from any other window, even with the right key', () => {
  const { errors, fromFrame, host, k, requests } = setup();
  const stranger = createFakeWindow();
  host.deliver(stranger.window, {
    k,
    type: 'ready',
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
  });
  host.deliver(stranger.window, {
    k,
    type: 'error',
    kind: 'error',
    message: 'spoofed',
  });
  expect(errors).toEqual([]);

  // The stranger's handshake didn't count for the real frame.
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  expect(requests).toEqual([]);
  expect(errors[0].message).toMatch(/not ready/);
});

test('ignores messages with another key', () => {
  const { errors, frameWindow, handshake, host, requests } = setup();
  handshake();
  host.deliver(frameWindow.window, {
    k: 'b'.repeat(32),
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('drops malformed messages without acting on them', () => {
  const { errors, fromFrame, handshake, requests } = setup();
  handshake();
  fromFrame({
    type: 'request',
    request: { type: 'query', binding: 'b', params: ['x'] },
  });
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: { binding: 'b', values: [] } },
  });
  fromFrame({ type: 'request', request: { type: 'navigate', url: '/' } });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('forwards the errors the frame reports', () => {
  const { errors, fromFrame } = setup();
  fromFrame({
    type: 'error',
    kind: 'error',
    message: 'x is not defined',
    stack: 'at app.js:3',
  });
  expect(errors).toEqual([
    {
      source: 'frame',
      kind: 'error',
      message: 'x is not defined',
      stack: 'at app.js:3',
    },
  ]);
});

test('ignores a frame that has no window any more', () => {
  const host = createFakeWindow({ origin: HOST_ORIGIN });
  const detached = createFakeWindow();
  const requests: FrameRequest[] = [];
  const channel = createFrameChannel({
    frame: fakeFrame(null),
    grant: [Capability.DATA],
    onRequest: request => {
      requests.push(request);
    },
    onError: () => {},
    hostWindow: host.window,
  });
  const { k } = JSON.parse(channel.name) as { k: string };
  host.deliver(detached.window, {
    k,
    type: 'request',
    request: { type: 'refresh' },
  });
  channel.postState(state);
  expect(requests).toEqual([]);
});

test('stops after dispose', () => {
  const { channel, frameWindow, fromFrame, handshake, host, requests } =
    setup();
  handshake();
  channel.dispose();
  expect(host.listeners('message')).toBe(0);

  channel.postState(state);
  channel.postData('revenue_by_region', revenue);
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  expect(frameWindow.posted).toEqual([]);
  expect(requests).toEqual([]);
});

test('channel keys are 128 random bits, in hex', () => {
  const keys = new Set(Array.from({ length: 20 }, () => createChannelKey()));
  expect(keys.size).toBe(20);
  keys.forEach(key => expect(key).toMatch(/^[0-9a-f]{32}$/));
});

test('a cross-filter may carry only values delivered for its binding', () => {
  const { crossFilter, errors, requests } = delivered();
  crossFilter(['EMEA', 'APAC']);
  crossFilter([null]);
  expect(requests).toHaveLength(2);

  crossFilter(['EMEA', "' OR 1=1 --"]);
  crossFilter(['LATAM']);
  expect(requests).toHaveLength(2);
  expect(errors.map(error => error.message)).toEqual([
    'refused setCrossFilter: its values must come from the "region" values ' +
      'delivered for "revenue_by_region"',
    'refused setCrossFilter: its values must come from the "region" values ' +
      'delivered for "revenue_by_region"',
  ]);
});

test('delivered values keep their type', () => {
  const { crossFilter, requests } = delivered();
  crossFilter([10], 'revenue');
  crossFilter(['10'], 'revenue');
  expect(requests).toHaveLength(1);
});

test('a cross-filter on a dimension the rows do not hold is refused', () => {
  const { crossFilter, errors, requests } = delivered();
  crossFilter([null], 'country');
  crossFilter([null], '__proto__');
  crossFilter([null], 'constructor');
  expect(requests).toEqual([]);
  expect(errors).toHaveLength(3);
});

test('a held result counts once the handshake sends it', () => {
  const { channel, crossFilter, handshake, requests } = setup();
  channel.postData('revenue_by_region', revenue);
  handshake();
  crossFilter(['EMEA']);
  expect(requests).toHaveLength(1);
});

test('a cross-filter is refused before any data for its binding', () => {
  const { channel, crossFilter, errors, handshake, requests } = setup();
  handshake();
  channel.postData('costs', { rows: [{ region: 'EMEA' }] });
  crossFilter(['EMEA']);
  expect(requests).toEqual([]);
  expect(errors.map(error => error.message)).toEqual([
    'refused setCrossFilter: no data was delivered for "revenue_by_region"',
  ]);
});

test('only the latest result of a binding counts', () => {
  const { channel, crossFilter, requests } = delivered();
  channel.postData('revenue_by_region', {
    rows: [{ region: 'EMEA', revenue: 12 }],
  });
  crossFilter(['APAC']);
  crossFilter(['EMEA']);
  expect(requests).toHaveLength(1);
});

test('clearing a cross-filter needs no delivered data', () => {
  const { handshake, request, requests } = setup();
  handshake();
  request({ type: 'setCrossFilter', value: null });
  expect(requests).toEqual([{ type: 'setCrossFilter', value: null }]);
});

test('a cross-filter carries a capped number of values', () => {
  const { crossFilter, errors, requests } = delivered({
    limits: { crossFilterValues: 2 },
  });
  crossFilter(['EMEA', 'APAC']);
  crossFilter(['EMEA', 'APAC', null]);
  expect(requests).toHaveLength(1);
  expect(errors[0].message).toBe(
    'refused setCrossFilter: a cross-filter carries at most 2 values',
  );
});

test("the frame's queries are capped, each request counting each binding", () => {
  const { channel, errors, request, requests } = delivered({
    limits: { queries: 5 },
  });
  channel.postData('costs', { rows: [] });
  request({ type: 'query', binding: 'costs', params: {} });
  request({ type: 'refresh' });
  request({ type: 'query', binding: 'costs', params: {} });
  expect(requests.map(({ type }) => type)).toEqual(['query', 'refresh']);
  expect(errors.map(error => error.message)).toEqual([
    'refused query: this frame may run at most 5 queries',
  ]);
});

test('a request costs every binding it fetches, delivered or not', () => {
  const { errors, handshake, request, requests } = setup(undefined, {
    limits: { queries: 16 },
    queriesPerRequest: 8,
  });
  handshake();
  // Nothing delivered yet, as while a binding the viewer can't read fails.
  request({ type: 'refresh' });
  request({ type: 'query', binding: 'b', params: {} });
  request({ type: 'query', binding: 'b', params: {} });
  expect(requests.map(({ type }) => type)).toEqual(['refresh', 'query']);
  expect(errors.map(error => error.message)).toEqual([
    'refused query: this frame may run at most 16 queries',
  ]);
});

test('a limit that is not a number keeps its default', () => {
  vi.useFakeTimers();
  const { errors, handshake, request, requests } = setup(undefined, {
    limits: {
      queries: undefined,
      requestsPerSecond: Number.NaN,
      crossFilterValues: -1,
    } as unknown as Partial<BridgeLimits>,
  });
  handshake();
  for (let sent = 0; sent <= DEFAULT_BRIDGE_LIMITS.queries; sent += 1) {
    request({ type: 'query', binding: 'b', params: {} });
    // Slower than the rate limit.
    vi.advanceTimersByTime(1000);
  }
  expect(requests).toHaveLength(DEFAULT_BRIDGE_LIMITS.queries);
  expect(errors.map(error => error.message)).toEqual([
    `refused query: this frame may run at most ${DEFAULT_BRIDGE_LIMITS.queries} queries`,
  ]);
});

test('requests over the rate are refused, and reported once a burst', () => {
  vi.useFakeTimers();
  const { errors, handshake, request, requests } = setup(undefined, {
    limits: { requestsPerSecond: 3, queries: 100 },
  });
  handshake();
  for (let sent = 0; sent < 5; sent += 1) request({ type: 'refresh' });
  expect(requests).toHaveLength(3);
  expect(errors.map(error => error.message)).toEqual([
    'refused requests over 3 a second',
  ]);

  vi.advanceTimersByTime(1000);
  request({ type: 'refresh' });
  expect(requests).toHaveLength(4);
});

test("a frame's errors are rate-limited apart from its requests", () => {
  vi.useFakeTimers();
  const { errors, fromFrame, handshake, request, requests } = setup(undefined, {
    limits: { requestsPerSecond: 3, queries: 100 },
  });
  handshake();
  for (let sent = 0; sent < 50; sent += 1) {
    fromFrame({ type: 'error', kind: 'error', message: `boom ${sent}` });
  }
  expect(errors.map(error => error.message)).toEqual([
    'boom 0',
    'boom 1',
    'boom 2',
    'refused errors over 3 a second',
  ]);
  // Its requests keep their own budget.
  request({ type: 'refresh' });
  expect(requests).toHaveLength(1);

  vi.advanceTimersByTime(1000);
  fromFrame({ type: 'error', kind: 'error', message: 'later' });
  expect(errors.at(-1)?.message).toBe('later');
});

test('the rate limit covers requests the channel refuses anyway', () => {
  vi.useFakeTimers();
  const { errors, request } = setup([Capability.THEME]);
  for (let sent = 0; sent < 50; sent += 1) request({ type: 'refresh' });
  expect(errors).toHaveLength(DEFAULT_BRIDGE_LIMITS.requestsPerSecond + 1);
});

test('a frame that never completes its handshake is reported once', () => {
  vi.useFakeTimers();
  const onHandshakeTimeout = vi.fn();
  setup(undefined, { onHandshakeTimeout });
  vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS - 1);
  expect(onHandshakeTimeout).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onHandshakeTimeout).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS * 2);
  expect(onHandshakeTimeout).toHaveBeenCalledTimes(1);
});

test('a handshake in time, or a disposed channel, is not a timeout', () => {
  vi.useFakeTimers();
  const onHandshakeTimeout = vi.fn();
  setup(undefined, { onHandshakeTimeout }).handshake();
  setup(undefined, { onHandshakeTimeout }).channel.dispose();
  // A handshake in the wrong version still answered: a new link won't help.
  setup(undefined, { onHandshakeTimeout }).fromFrame({
    type: 'ready',
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION + 1,
  });
  vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS * 2);
  expect(onHandshakeTimeout).not.toHaveBeenCalled();
});

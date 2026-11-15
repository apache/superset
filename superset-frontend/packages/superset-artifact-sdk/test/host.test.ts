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
  ChannelError,
  createChannelKey,
  createFrameChannel,
} from '../src/host';
import {
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
  bindings: { revenue_by_region: { rows: [{ region: 'EMEA', revenue: 10 }] } },
  filters: [{ kind: 'filter', source: 'year-filter', value: 2026 }],
  theme: { mode: 'light', tokens: { colorPrimary: '#20a7c9' } },
};

function setup(
  grant: Capability[] = [Capability.DATA, Capability.CROSS_FILTER],
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
  return {
    channel,
    errors,
    frameWindow,
    fromFrame,
    handshake,
    host,
    k,
    requests,
  };
}

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
        state: {
          status: 'ok',
          bindings: state.bindings,
          filters: state.filters,
        },
      },
      targetOrigin: '*',
    },
  ]);

  channel.postState({ ...state, status: 'loading' });
  expect(frameWindow.posted).toHaveLength(2);
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
      bindings: {},
      filters: [],
      theme: state.theme,
      error: 'partial results',
    },
  });
});

test('passes granted requests on, as clean copies', () => {
  const { fromFrame, handshake, requests } = setup();
  handshake();
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
  const { errors, fromFrame, handshake, requests } = setup([Capability.DATA]);
  handshake();
  fromFrame({
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  fromFrame({
    type: 'request',
    request: { type: 'emit', kind: 'drill', value: region },
  });
  fromFrame({ type: 'request', request: { type: 'refresh' } });

  expect(requests).toEqual([]);
  expect(errors.map(error => error.source)).toEqual(['host', 'host', 'host']);
  expect(errors[0].message).toMatch(/"cross_filter" capability/);
  expect(errors[1].message).toMatch(/"events" capability/);
  expect(errors[2].message).toMatch(/"refresh" capability/);
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
    grant: [Capability.REFRESH],
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

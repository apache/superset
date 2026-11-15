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
  DataEventValue,
  EmittedEventKind,
  encodeFrameConfig,
  FrameStatus,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
} from '../src/protocol';
import { CapabilityError, installRuntime } from '../src/runtime';
import { createFakeWindow } from './fakes';

const HOST_ORIGIN = 'https://superset.example.com';
const k = 'c'.repeat(32);
const okState = {
  status: 'ok',
  bindings: { sales: { rows: [{ region: 'EMEA', total: 10 }] } },
  filters: [{ kind: 'cross_filter', source: 'map', value: ['EMEA'] }],
  theme: { mode: 'dark', tokens: { colorPrimary: '#20a7c9' } },
};

function setup(usable: Capability[] = [Capability.DATA]) {
  const host = createFakeWindow({ origin: HOST_ORIGIN });
  const frame = createFakeWindow({
    name: encodeFrameConfig({ k, usable, origin: HOST_ORIGIN }),
    parent: host.window,
  });
  const runtime = installRuntime(frame.window);
  const fromHost = (data: Record<string, unknown>) =>
    frame.deliver(host.window, { k, ...data });
  /** What the runtime posted to the host after its handshake. */
  const sent = () => host.posted.slice(1).map(posted => posted.message);
  return { frame, fromHost, host, runtime, sent };
}

test('announces itself to the host, at the host origin', () => {
  const { frame, host, runtime } = setup();
  expect(host.posted).toEqual([
    {
      message: {
        k,
        type: 'ready',
        protocol: PROTOCOL_NAME,
        version: PROTOCOL_VERSION,
      },
      targetOrigin: HOST_ORIGIN,
    },
  ]);
  expect(runtime.capabilities).toEqual([Capability.DATA]);
  expect(Reflect.get(frame.window, 'superset')).toBe(runtime);
});

test('clears the channel key from the window name', () => {
  const { frame } = setup();
  expect(frame.window.name).toBe('');
});

test('replays the latest state to each listener, then follows updates', () => {
  const { fromHost, runtime } = setup();
  const seen: FrameStatus[] = [];
  runtime.onData(state => {
    seen.push(state.status);
  });
  expect(seen).toEqual(['loading']);

  fromHost({ type: 'state', state: okState });
  expect(seen).toEqual(['loading', 'ok']);
  expect(runtime.status()).toBe('ok');
  expect(runtime.data('sales')).toEqual(okState.bindings.sales);
  expect(runtime.data('missing')).toBeUndefined();
  expect(runtime.data('__proto__')).toBeUndefined();
  expect(runtime.filters()).toEqual(okState.filters);

  const late: FrameStatus[] = [];
  runtime.onData(state => {
    late.push(state.status);
  });
  expect(late).toEqual(['ok']);
});

test('unsubscribing stops the updates', () => {
  const { fromHost, runtime } = setup();
  const seen: FrameStatus[] = [];
  const unsubscribe = runtime.onData(state => {
    seen.push(state.status);
  });
  unsubscribe();
  fromHost({ type: 'state', state: okState });
  expect(seen).toEqual(['loading']);
});

test('takes state only from its parent, and only with its key', () => {
  const { frame, host, runtime } = setup();
  const stranger = createFakeWindow();
  frame.deliver(stranger.window, { k, type: 'state', state: okState });
  frame.deliver(host.window, {
    k: 'd'.repeat(32),
    type: 'state',
    state: okState,
  });
  frame.deliver(host.window, { k, type: 'state', state: { status: 'done' } });
  expect(runtime.status()).toBe('loading');
});

test('guards every data and event method by its capability', () => {
  const { runtime, sent } = setup([]);
  const value: DataEventValue = {
    binding: 'sales',
    dimension: 'region',
    values: ['EMEA'],
  };
  expect(() => runtime.data('sales')).toThrow(CapabilityError);
  expect(() => runtime.filters()).toThrow(CapabilityError);
  expect(() => runtime.query('sales')).toThrow(CapabilityError);
  expect(() => runtime.theme()).toThrow(CapabilityError);
  expect(() => runtime.setCrossFilter(value)).toThrow(
    /needs the "cross_filter" capability/,
  );
  expect(() => runtime.emit('drill', value)).toThrow(
    /needs the "events" capability/,
  );
  expect(() => runtime.refresh()).toThrow(/needs the "refresh" capability/);
  expect(runtime.status()).toBe('loading');
  expect(sent()).toEqual([]);
});

test('sends granted requests to the host', () => {
  const { runtime, sent } = setup([
    Capability.DATA,
    Capability.CROSS_FILTER,
    Capability.EVENTS,
    Capability.REFRESH,
  ]);
  const value: DataEventValue = {
    binding: 'sales',
    dimension: 'region',
    values: ['EMEA'],
  };
  runtime.query('sales', { time_range: 'Last week' });
  runtime.setCrossFilter(value);
  runtime.setCrossFilter(null);
  runtime.emit('highlight', value);
  runtime.refresh();
  expect(sent()).toEqual([
    {
      k,
      type: 'request',
      request: {
        type: 'query',
        binding: 'sales',
        params: { time_range: 'Last week' },
      },
    },
    { k, type: 'request', request: { type: 'setCrossFilter', value } },
    { k, type: 'request', request: { type: 'setCrossFilter', value: null } },
    {
      k,
      type: 'request',
      request: { type: 'emit', kind: 'highlight', value },
    },
    { k, type: 'request', request: { type: 'refresh' } },
  ]);
});

test('sends only the fields the protocol defines', () => {
  const { runtime, sent } = setup([Capability.CROSS_FILTER]);
  const value = {
    binding: 'sales',
    dimension: 'region',
    values: ['EMEA'],
    toString: () => 'not cloneable',
  };
  runtime.setCrossFilter(value);
  expect(sent()).toEqual([
    {
      k,
      type: 'request',
      request: {
        type: 'setCrossFilter',
        value: { binding: 'sales', dimension: 'region', values: ['EMEA'] },
      },
    },
  ]);
});

test('rejects malformed requests before they leave the frame', () => {
  const { runtime, sent } = setup([
    Capability.DATA,
    Capability.CROSS_FILTER,
    Capability.EVENTS,
  ]);
  expect(() => runtime.query('')).toThrow(TypeError);
  expect(() => runtime.setCrossFilter({} as DataEventValue)).toThrow(
    TypeError,
  );
  expect(() =>
    runtime.emit('cross_filter' as EmittedEventKind, null),
  ).toThrow(/setCrossFilter/);
  expect(sent()).toEqual([]);
});

test('gives the theme only with the theme capability', () => {
  const { fromHost, runtime } = setup([Capability.THEME]);
  fromHost({ type: 'state', state: okState });
  expect(runtime.theme()).toEqual(okState.theme);
});

test('reports uncaught errors and unhandled rejections', () => {
  const { frame, sent } = setup();
  frame.dispatch('error', {
    error: new Error('x is not defined'),
    message: 'Uncaught ReferenceError: x is not defined',
  });
  frame.dispatch('unhandledrejection', { reason: 'request failed' });

  const [uncaught, rejection] = sent() as Record<string, unknown>[];
  expect(uncaught.type).toBe('error');
  expect(uncaught.kind).toBe('error');
  expect(uncaught.message).toBe('x is not defined');
  expect(typeof uncaught.stack).toBe('string');
  expect(rejection).toEqual({
    k,
    type: 'error',
    kind: 'unhandledrejection',
    message: 'request failed',
  });
});

test('reports a listener that throws, instead of throwing', () => {
  const { fromHost, runtime, sent } = setup();
  runtime.onData(state => {
    if (state.status === 'ok') throw new Error('render failed');
  });
  fromHost({ type: 'state', state: okState });
  const [report] = sent() as Record<string, unknown>[];
  expect(report.kind).toBe('callback');
  expect(report.message).toBe('render failed');
});

test('stays disconnected without a valid config', () => {
  const host = createFakeWindow({ origin: HOST_ORIGIN });
  const frame = createFakeWindow({ name: 'not json', parent: host.window });
  const runtime = installRuntime(frame.window);
  expect(runtime.status()).toBe('error');
  expect(runtime.capabilities).toEqual([]);
  expect(() => runtime.data('sales')).toThrow(/no connection to a host/);
  frame.dispatch('error', { error: new Error('boom') });
  expect(host.posted).toEqual([]);
});

test('installing twice returns the same runtime', () => {
  const { frame, runtime } = setup();
  expect(installRuntime(frame.window)).toBe(runtime);
});

test('artifact code cannot replace the runtime or its methods', () => {
  const { frame, runtime } = setup();
  expect(Object.isFrozen(runtime)).toBe(true);
  const descriptor = Object.getOwnPropertyDescriptor(frame.window, 'superset');
  expect(descriptor?.writable).toBe(false);
});

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
  encodeFrameConfig,
  parseFrameConfig,
  parseFrameMessage,
  parseFrameRequest,
  parseHostMessage,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  REQUEST_CAPABILITY,
} from '../src/protocol';

const k = 'a'.repeat(32);
const HOST_ORIGIN = 'https://superset.example.com';
const region = {
  binding: 'revenue_by_region',
  dimension: 'region',
  values: ['EMEA'],
};
const state = {
  status: 'ok',
  filters: [{ kind: 'filter', source: 'year-filter', value: 2026 }],
  theme: { mode: 'dark', tokens: { colorPrimary: '#20a7c9' } },
};
const result = {
  rows: [{ region: 'EMEA', revenue: 10 }],
  columns: [{ name: 'region', type: 'STRING' }],
  definitions: {
    revenue: {
      kind: 'metric',
      expression: 'SUM(revenue)',
      format: '$,.2f',
    },
  },
};

test('the protocol has a name and a version', () => {
  expect(PROTOCOL_NAME).toBe('superset-artifacts');
  expect(PROTOCOL_VERSION).toBe(1);
});

test('every request needs its capability', () => {
  expect(REQUEST_CAPABILITY).toEqual({
    query: Capability.DATA,
    setCrossFilter: Capability.CROSS_FILTER,
    refresh: Capability.DATA,
  });
});

const validFrameMessages: [string, unknown][] = [
  [
    'a handshake',
    { k, type: 'ready', protocol: PROTOCOL_NAME, version: PROTOCOL_VERSION },
  ],
  [
    'a query',
    {
      k,
      type: 'request',
      request: {
        type: 'query',
        binding: 'revenue_by_region',
        params: { time_range: 'Last week' },
      },
    },
  ],
  [
    'a cross-filter',
    { k, type: 'request', request: { type: 'setCrossFilter', value: region } },
  ],
  [
    'a cleared cross-filter',
    { k, type: 'request', request: { type: 'setCrossFilter', value: null } },
  ],
  ['a refresh', { k, type: 'request', request: { type: 'refresh' } }],
  [
    'an error',
    {
      k,
      type: 'error',
      kind: 'unhandledrejection',
      message: 'boom',
      stack: '',
    },
  ],
];

validFrameMessages.forEach(([label, message]) => {
  test(`accepts ${label} from the frame`, () => {
    expect(parseFrameMessage(message)).toBeDefined();
  });
});

const invalidFrameMessages: [string, unknown][] = [
  ['null', null],
  ['a string', 'ready'],
  ['an array', [k, 'ready']],
  ['a message without a key', { type: 'refresh' }],
  ['a message with an empty key', { k: '', type: 'ready', version: 1 }],
  ['an unknown type', { k, type: 'eval', code: 'fetch("/")' }],
  ['a handshake without a version', { k, type: 'ready', protocol: 'x' }],
  [
    'a handshake with a fractional version',
    { k, type: 'ready', protocol: PROTOCOL_NAME, version: 1.5 },
  ],
  [
    'an unknown request',
    { k, type: 'request', request: { type: 'fetch', url: 'https://x.test' } },
  ],
  [
    'a query without a binding',
    { k, type: 'request', request: { type: 'query', params: {} } },
  ],
  [
    'a query with a list of parameters',
    {
      k,
      type: 'request',
      request: { type: 'query', binding: 'b', params: [] },
    },
  ],
  [
    'a cross-filter on objects',
    {
      k,
      type: 'request',
      request: { type: 'setCrossFilter', value: { ...region, values: [{}] } },
    },
  ],
  [
    'a cross-filter on a non-finite number',
    {
      k,
      type: 'request',
      request: {
        type: 'setCrossFilter',
        value: { ...region, values: [Number.NaN] },
      },
    },
  ],
  [
    'a cross-filter without a dimension',
    {
      k,
      type: 'request',
      request: { type: 'setCrossFilter', value: { binding: 'b', values: [] } },
    },
  ],
  [
    'an event other than a cross-filter',
    {
      k,
      type: 'request',
      request: { type: 'emit', kind: 'highlight', value: region },
    },
  ],
  ['an error without a message', { k, type: 'error', kind: 'error' }],
  [
    'an error of an unknown kind',
    { k, type: 'error', kind: 'panic', message: 'x' },
  ],
];

invalidFrameMessages.forEach(([label, message]) => {
  test(`rejects ${label} from the frame`, () => {
    expect(parseFrameMessage(message)).toBeUndefined();
  });
});

test('parsing keeps only the fields the protocol defines', () => {
  const parsed = parseFrameMessage({
    k,
    type: 'request',
    extra: true,
    request: {
      type: 'setCrossFilter',
      more: 1,
      value: { ...region, sql: "' OR 1=1 --" },
    },
  });
  expect(parsed).toEqual({
    k,
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
  expect(Object.keys(parsed as object)).toEqual(['k', 'type', 'request']);
});

test('parsed requests are copies of what the frame sent', () => {
  const values = ['EMEA'];
  const parsed = parseFrameMessage({
    k,
    type: 'request',
    request: { type: 'setCrossFilter', value: { ...region, values } },
  });
  values.push('APAC');
  expect(parsed).toEqual({
    k,
    type: 'request',
    request: { type: 'setCrossFilter', value: region },
  });
});

test('requests can be parsed on their own', () => {
  expect(parseFrameRequest({ type: 'refresh', extra: true })).toEqual({
    type: 'refresh',
  });
  expect(
    parseFrameRequest({ type: 'emit', kind: 'drill', value: null }),
  ).toBeUndefined();
});

test('accepts state from the host', () => {
  expect(parseHostMessage({ k, type: 'state', state })).toEqual({
    k,
    type: 'state',
    state,
  });
});

const invalidStates: [string, unknown][] = [
  ['an unknown status', { ...state, status: 'done' }],
  ['filters that are not a list', { ...state, filters: {} }],
  [
    'a filter of an unknown kind',
    { ...state, filters: [{ kind: 'sql', source: 'x', value: 1 }] },
  ],
  ['a theme without a mode', { ...state, theme: { tokens: {} } }],
  ['an error that is not text', { ...state, error: 42 }],
];

invalidStates.forEach(([label, invalid]) => {
  test(`rejects state with ${label}`, () => {
    expect(
      parseHostMessage({ k, type: 'state', state: invalid }),
    ).toBeUndefined();
  });
});

test('state leaves out the fields the protocol does not define', () => {
  const parsed = parseHostMessage({
    k,
    type: 'state',
    state: { ...state, bindings: { b: result } },
  });
  expect(parsed).toEqual({ k, type: 'state', state });
});

test("accepts one binding's result from the host", () => {
  expect(
    parseHostMessage({ k, type: 'data', binding: 'revenue', data: result }),
  ).toEqual({ k, type: 'data', binding: 'revenue', data: result });
});

const invalidData: [string, Record<string, unknown>][] = [
  ['no binding name', { binding: '', data: result }],
  ['rows that are not a list', { binding: 'b', data: { rows: {} } }],
  ['rows that are not objects', { binding: 'b', data: { rows: [1] } }],
  [
    'columns without names',
    { binding: 'b', data: { rows: [], columns: [{ type: 'STRING' }] } },
  ],
  ['no result at all', { binding: 'b' }],
];

invalidData.forEach(([label, fields]) => {
  test(`rejects data with ${label}`, () => {
    expect(parseHostMessage({ k, type: 'data', ...fields })).toBeUndefined();
  });
});

test('rejects host messages without a key, or of another type', () => {
  expect(parseHostMessage({ type: 'state', state })).toBeUndefined();
  expect(parseHostMessage({ k, type: 'ready', state })).toBeUndefined();
});

test('the frame config round-trips through the iframe name', () => {
  const config = {
    k,
    grant: [Capability.DATA, Capability.THEME],
    origin: HOST_ORIGIN,
  };
  expect(parseFrameConfig(encodeFrameConfig(config))).toEqual(config);
});

test('the frame config drops capabilities this SDK does not know', () => {
  const name = JSON.stringify({
    k,
    grant: ['data', 'compute', 7],
    origin: HOST_ORIGIN,
  });
  expect(parseFrameConfig(name)?.grant).toEqual([Capability.DATA]);
});

const invalidConfigs: [string, string][] = [
  ['an empty name', ''],
  ['a name that is not JSON', 'artifact-frame'],
  [
    'a config without a key',
    JSON.stringify({ grant: [], origin: HOST_ORIGIN }),
  ],
  ['a wildcard origin', JSON.stringify({ k, grant: [], origin: '*' })],
  ['an opaque origin', JSON.stringify({ k, grant: [], origin: 'null' })],
  [
    'an origin with a path',
    JSON.stringify({ k, grant: [], origin: `${HOST_ORIGIN}/canvas` }),
  ],
  [
    'a config without a grant, such as one with another key for it',
    JSON.stringify({ k, usable: ['data'], origin: HOST_ORIGIN }),
  ],
  [
    'a grant that is not a list',
    JSON.stringify({ k, grant: 'data', origin: HOST_ORIGIN }),
  ],
];

invalidConfigs.forEach(([label, name]) => {
  test(`rejects ${label} as the frame config`, () => {
    expect(parseFrameConfig(name)).toBeUndefined();
  });
});

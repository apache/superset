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

import { store } from 'src/views/store';
import { createTelemetry } from '.';

const dispatched = () =>
  (store.dispatch as jest.Mock).mock.calls.map(([action]) => action);

beforeEach(() => {
  jest
    .spyOn(store, 'dispatch')
    .mockImplementation(((action: unknown) => action) as typeof store.dispatch);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The thunk `logEvent` returns, run to recover what it would dispatch. */
const eventOf = (thunk: unknown) => {
  const dispatch = jest.fn();
  (thunk as (d: unknown) => void)(dispatch);
  return dispatch.mock.calls[0][0].payload;
};

test('an event is prefixed with the extension that raised it', () => {
  createTelemetry('acme.chat').logEvent('message_sent');

  const { eventName, eventData } = eventOf(dispatched()[0]);
  expect(eventName).toBe('ext_acme_chat_message_sent');
  expect(eventData.extension_id).toBe('acme.chat');
});

test('two extensions raising the same name stay distinguishable', () => {
  createTelemetry('acme.chat').logEvent('opened');
  createTelemetry('other.chat').logEvent('opened');

  const names = dispatched().map(thunk => eventOf(thunk).eventName);
  expect(names).toEqual(['ext_acme_chat_opened', 'ext_other_chat_opened']);
});

test('the extension cannot pass itself off as another one', () => {
  // The id is the host's to supply; anything the caller sends is just data.
  createTelemetry('acme.chat').logEvent('opened', {
    extension_id: 'someone.else',
  });

  const { eventData } = eventOf(dispatched()[0]);
  expect(eventData.extension_id).toBe('acme.chat');
});

test('a name with nothing usable in it is dropped rather than raised', () => {
  const telemetry = createTelemetry('acme.chat');

  expect(() => telemetry.logEvent('!!!')).not.toThrow();
  expect(() => telemetry.logEvent('')).not.toThrow();
  expect(dispatched()).toHaveLength(0);
});

test('a name is bounded, however long it arrives', () => {
  createTelemetry('acme.chat').logEvent('x'.repeat(500));

  const { eventName } = eventOf(dispatched()[0]);
  expect(eventName.length).toBeLessThanOrEqual('ext_acme_chat_'.length + 64);
});

test('non-scalar fields are dropped, not stringified', () => {
  // Stringifying is how an entire chat transcript ends up in a log row.
  createTelemetry('acme.chat').logEvent('message_sent', {
    tokens: 42,
    ok: true,
    transcript: { text: 'something a user typed' } as never,
    turns: ['a', 'b'] as never,
  });

  const { eventData } = eventOf(dispatched()[0]);
  expect(eventData.tokens).toBe(42);
  expect(eventData.ok).toBe(true);
  expect(eventData).not.toHaveProperty('transcript');
  expect(eventData).not.toHaveProperty('turns');
});

test('a string value is cut to a label, not merely shortened', () => {
  // Truncation is not a privacy control: the first N characters of someone's
  // message are still their message. The cap is set where a value can hold a
  // category or a model name and cannot hold prose.
  createTelemetry('acme.chat').logEvent('message_sent', {
    model: 'm'.repeat(1000),
  });

  const { eventData } = eventOf(dispatched()[0]);
  expect((eventData.model as string).length).toBe(64);
});

test('an extension reporting in a loop is rate limited, not allowed to flood', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const telemetry = createTelemetry('acme.chat');

  for (let i = 0; i < 500; i += 1) telemetry.logEvent('tick');

  expect(dispatched().length).toBeLessThanOrEqual(60);
  // Dropping must not itself become a flood.
  expect(console.warn).toHaveBeenCalledTimes(1);
});

test('one noisy extension does not silence another', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const noisy = createTelemetry('noisy.ext');
  const quiet = createTelemetry('quiet.ext');

  for (let i = 0; i < 500; i += 1) noisy.logEvent('tick');
  quiet.logEvent('opened');

  const names = dispatched().map(thunk => eventOf(thunk).eventName);
  expect(names).toContain('ext_quiet_ext_opened');
});

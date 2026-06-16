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
  MESSAGE_TYPE,
  isMessageOriginAllowed,
  validateMessageEvent,
} from './originValidation';

const makeEvent = (origin: string, data: unknown): MessageEvent =>
  ({ origin, data }) as MessageEvent;

const validData = { type: MESSAGE_TYPE, handshake: 'port transfer' };

test('isMessageOriginAllowed allows any origin when the list is undefined', () => {
  expect(isMessageOriginAllowed('https://anywhere.example.com')).toBe(true);
});

test('isMessageOriginAllowed allows any origin when the list is empty', () => {
  expect(isMessageOriginAllowed('https://anywhere.example.com', [])).toBe(true);
});

test('isMessageOriginAllowed allows an origin that is in the list', () => {
  expect(
    isMessageOriginAllowed('https://allowed.example.com', [
      'https://allowed.example.com',
    ]),
  ).toBe(true);
});

test('isMessageOriginAllowed matches a listed domain with a trailing slash', () => {
  expect(
    isMessageOriginAllowed('https://allowed.example.com', [
      'https://allowed.example.com/',
    ]),
  ).toBe(true);
});

test('isMessageOriginAllowed matches a listed domain that includes a path', () => {
  expect(
    isMessageOriginAllowed('https://allowed.example.com', [
      'https://allowed.example.com/embed',
    ]),
  ).toBe(true);
});

test('isMessageOriginAllowed rejects an origin that is not in the list and warns', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(
    isMessageOriginAllowed('https://evil.example.com', [
      'https://allowed.example.com',
    ]),
  ).toBe(false);
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test('validateMessageEvent accepts a valid embedded message from any origin when unrestricted', () => {
  const event = makeEvent('https://anywhere.example.com', validData);
  expect(validateMessageEvent(event)).toBe(true);
  expect(validateMessageEvent(event, [])).toBe(true);
});

test('validateMessageEvent accepts a valid embedded message from a listed origin', () => {
  const event = makeEvent('https://allowed.example.com', validData);
  expect(validateMessageEvent(event, ['https://allowed.example.com'])).toBe(
    true,
  );
});

test('validateMessageEvent rejects a message from an origin not in a non-empty list', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const event = makeEvent('https://evil.example.com', validData);
  expect(validateMessageEvent(event, ['https://allowed.example.com'])).toBe(
    false,
  );
  warn.mockRestore();
});

test('validateMessageEvent rejects a message whose data type does not match', () => {
  const event = makeEvent('https://allowed.example.com', {
    type: 'something-else',
  });
  expect(validateMessageEvent(event, ['https://allowed.example.com'])).toBe(
    false,
  );
});

test('validateMessageEvent rejects a message whose data is not an object', () => {
  const event = makeEvent('https://allowed.example.com', 'not-an-object');
  expect(validateMessageEvent(event)).toBe(false);
});

test('validateMessageEvent rejects a message whose data is null', () => {
  const event = makeEvent('https://allowed.example.com', null);
  expect(validateMessageEvent(event)).toBe(false);
});

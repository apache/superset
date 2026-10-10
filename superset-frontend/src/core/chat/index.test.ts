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
import { createElement } from 'react';
import { chat } from './index';
import ChatProvider from './ChatProvider';

const trigger = () => createElement('button', null, 'Bubble');
const panel = () => createElement('div', null, 'Panel');

beforeEach(() => {
  ChatProvider.getInstance().reset();
});

test('getChat returns undefined when no chat is registered', () => {
  expect(chat.getChat()).toBeUndefined();
});

test('registerChat makes the chat retrievable via getChat', () => {
  const descriptor = { id: 'acme.chat', name: 'Acme Chat' };
  chat.registerChat(descriptor, trigger, panel);

  expect(chat.getChat()).toEqual(descriptor);
});

test('the last-registered chat wins when multiple are registered', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  chat.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel);
  chat.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel);

  expect(chat.getChat()?.id).toBe('second.chat');
  jest.restoreAllMocks();
});

test('open and close toggle isOpen', () => {
  chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);

  expect(chat.isOpen()).toBe(false);
  chat.open();
  expect(chat.isOpen()).toBe(true);
  chat.close();
  expect(chat.isOpen()).toBe(false);
});

test('getDisplayMode defaults to floating', () => {
  expect(chat.getDisplayMode()).toBe('floating');
});

test('setDisplayMode updates the display mode', () => {
  chat.setDisplayMode('panel');
  expect(chat.getDisplayMode()).toBe('panel');
});

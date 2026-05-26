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
import { commands } from '@apache-superset/core';
import { registry, reset } from './sdkMock';
import { activate, VIEW_ID, CHATBOT_LOCATION } from '../activate';
import { isOpen } from '../state';
import { streamReply } from '../streaming/mockStream';
import {
  registerActiveController,
  unregisterActiveController,
  abortAllActiveControllers,
} from '../streaming/registry';

beforeEach(() => {
  reset();
});

test('registers one view at superset.chatbot and three chatbot commands', () => {
  const disposable = activate();

  try {
    expect(registry.views.size).toBe(1);
    const entry = registry.views.get(VIEW_ID);
    expect(entry?.location).toBe(CHATBOT_LOCATION);
    expect(entry?.view.icon).toBe('Bubble');

    expect(Array.from(registry.commands.keys()).sort()).toEqual([
      'core.chatbot__close',
      'core.chatbot__open',
      'core.chatbot__toggle',
    ]);
  } finally {
    disposable.dispose();
  }
});

test('executeCommand drives open/close/toggle through module state', async () => {
  const disposable = activate();
  try {
    expect(isOpen()).toBe(false);

    await commands.executeCommand('core.chatbot__open');
    expect(isOpen()).toBe(true);

    await commands.executeCommand('core.chatbot__toggle');
    expect(isOpen()).toBe(false);

    await commands.executeCommand('core.chatbot__toggle');
    expect(isOpen()).toBe(true);

    await commands.executeCommand('core.chatbot__close');
    expect(isOpen()).toBe(false);
  } finally {
    disposable.dispose();
  }
});

test('disposing the master disposable unregisters view + commands', () => {
  const disposable = activate();
  expect(registry.views.size).toBe(1);
  expect(registry.commands.size).toBe(3);

  disposable.dispose();

  expect(registry.views.size).toBe(0);
  expect(registry.commands.size).toBe(0);
});

test('disposal is idempotent', () => {
  const disposable = activate();
  disposable.dispose();
  expect(() => disposable.dispose()).not.toThrow();
  expect(registry.views.size).toBe(0);
});

test('re-activate after dispose works (validates replace semantics)', () => {
  const first = activate();
  first.dispose();

  const second = activate();
  try {
    expect(registry.views.size).toBe(1);
    expect(registry.commands.size).toBe(3);
    expect(isOpen()).toBe(false); // resetState() cleared open flag
  } finally {
    second.dispose();
  }
});

test('aborting an active controller stops the stream cleanly', async () => {
  const controller = new AbortController();
  registerActiveController(controller);

  const iter = streamReply('hello world', controller.signal);
  const received: string[] = [];

  const consume = (async () => {
    for await (const tok of iter) received.push(tok);
  })();

  // Abort after a single tick — the iterator must return without throwing.
  await new Promise(r => setTimeout(r, 50));
  abortAllActiveControllers();
  await expect(consume).resolves.toBeUndefined();

  unregisterActiveController(controller);
  expect(received.length).toBeLessThan(20); // would be ~20+ tokens if uncancelled
});

test('disposing the extension aborts any in-flight controller', async () => {
  const disposable = activate();
  const controller = new AbortController();
  registerActiveController(controller);

  const iter = streamReply('a longer prompt to ensure many tokens', controller.signal);
  const consume = (async () => {
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    for await (const _tok of iter) {
      // drain
    }
  })();

  await new Promise(r => setTimeout(r, 30));
  disposable.dispose();

  await expect(consume).resolves.toBeUndefined();
  expect(controller.signal.aborted).toBe(true);
});

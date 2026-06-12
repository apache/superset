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
import { chat, getActiveChat, getChatSnapshot } from './index';

const disposables: Array<{ dispose: () => void }> = [];

const trigger = () => createElement('button', null, 'Bubble');
const panel = () => createElement('div', null, 'Panel');

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  // Reset host-owned state shared across tests in this module.
  chat.close();
  chat.setMode('floating');
});

test('getChat returns undefined when no chat is registered', () => {
  expect(chat.getChat()).toBeUndefined();
  expect(getActiveChat()).toBeUndefined();
});

test('registerChat resolves the registered chat with its providers', () => {
  const descriptor = { id: 'acme.chat', name: 'Acme Chat' };
  disposables.push(chat.registerChat(descriptor, trigger, panel));

  expect(chat.getChat()).toEqual(descriptor);
  expect(getActiveChat()).toMatchObject({ chat: descriptor, trigger, panel });
});

test('getChat returns a copy that cannot mutate the registry', () => {
  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme Chat' }, trigger, panel),
  );

  const copy = chat.getChat();
  copy!.name = 'Hijacked';

  expect(chat.getChat()?.name).toBe('Acme Chat');
});

test('the last-registered chat wins when multiple are installed', () => {
  disposables.push(
    chat.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel),
    chat.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel),
  );

  expect(chat.getChat()?.id).toBe('second.chat');
});

test('disposing the active chat falls back to the previous registration', () => {
  disposables.push(
    chat.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel),
  );
  const second = chat.registerChat(
    { id: 'second.chat', name: 'Second' },
    trigger,
    panel,
  );

  expect(chat.getChat()?.id).toBe('second.chat');

  second.dispose();

  expect(chat.getChat()?.id).toBe('first.chat');
});

test('re-registering an id replaces the previous registration', () => {
  const stalePanel = () => createElement('div', null, 'Stale');
  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, stalePanel),
    chat.registerChat({ id: 'acme.chat', name: 'Acme v2' }, trigger, panel),
  );

  expect(chat.getChat()?.name).toBe('Acme v2');
  expect(getActiveChat()?.panel).toBe(panel);
});

test('each registration gets a distinct registrationId, including same-id replacements', () => {
  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel),
  );
  const first = getActiveChat()?.registrationId;

  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme v2' }, trigger, panel),
  );
  const second = getActiveChat()?.registrationId;

  expect(first).toBeDefined();
  expect(second).toBeDefined();
  expect(second).not.toBe(first);
});

test('disposing a registration twice unregisters only once', () => {
  const unregistered = jest.fn();
  disposables.push(chat.onDidUnregisterChat(unregistered));

  const registration = chat.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );
  registration.dispose();
  registration.dispose();

  expect(unregistered).toHaveBeenCalledTimes(1);
  expect(chat.getChat()).toBeUndefined();
});

test('onDidRegisterChat and onDidUnregisterChat fire with the descriptor', () => {
  const registered = jest.fn();
  const unregistered = jest.fn();
  disposables.push(
    chat.onDidRegisterChat(registered),
    chat.onDidUnregisterChat(unregistered),
  );

  const descriptor = { id: 'acme.chat', name: 'Acme' };
  const registration = chat.registerChat(descriptor, trigger, panel);

  expect(registered).toHaveBeenCalledWith(descriptor);
  expect(unregistered).not.toHaveBeenCalled();

  registration.dispose();

  expect(unregistered).toHaveBeenCalledWith(descriptor);
});

test('a disposed event subscription stops receiving notifications', () => {
  const registered = jest.fn();
  const subscription = chat.onDidRegisterChat(registered);
  subscription.dispose();

  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel),
  );

  expect(registered).not.toHaveBeenCalled();
});

test('open and close toggle the panel and fire once with the active descriptor', () => {
  const opened = jest.fn();
  const closed = jest.fn();
  disposables.push(chat.onDidOpen(opened), chat.onDidClose(closed));

  const descriptor = { id: 'acme.chat', name: 'Acme' };
  disposables.push(chat.registerChat(descriptor, trigger, panel));

  expect(chat.isOpen()).toBe(false);

  chat.open();
  // Opening an already-open panel is a no-op and must not re-fire.
  chat.open();

  expect(chat.isOpen()).toBe(true);
  expect(opened).toHaveBeenCalledTimes(1);
  expect(opened).toHaveBeenCalledWith(descriptor);

  chat.close();
  chat.close();

  expect(chat.isOpen()).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledWith(descriptor);
});

test('open is a no-op while no chat is registered', () => {
  const opened = jest.fn();
  disposables.push(chat.onDidOpen(opened));

  chat.open();

  expect(chat.isOpen()).toBe(false);
  expect(opened).not.toHaveBeenCalled();

  // A registration arriving later therefore starts closed.
  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel),
  );
  expect(chat.isOpen()).toBe(false);
});

test('a takeover by a different id closes the displaced chat panel', () => {
  const closed = jest.fn();
  disposables.push(chat.onDidClose(closed));

  const first = { id: 'first.chat', name: 'First' };
  disposables.push(chat.registerChat(first, trigger, panel));
  chat.open();

  disposables.push(
    chat.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel),
  );

  // The incoming chat must not mount into an open state it never requested.
  expect(chat.isOpen()).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledWith(first);
});

test('a same-id replacement keeps the open state', () => {
  const closed = jest.fn();
  disposables.push(chat.onDidClose(closed));

  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel),
  );
  chat.open();

  // Upgrade in place: same id, new providers.
  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme v2' }, trigger, panel),
  );

  expect(chat.isOpen()).toBe(true);
  expect(closed).not.toHaveBeenCalled();
});

test('disposing the active chat while open closes it; the fallback starts closed', () => {
  const closed = jest.fn();
  disposables.push(chat.onDidClose(closed));

  disposables.push(
    chat.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel),
  );
  const second = { id: 'second.chat', name: 'Second' };
  const registration = chat.registerChat(second, trigger, panel);
  chat.open();

  registration.dispose();

  expect(chat.getChat()?.id).toBe('first.chat');
  expect(chat.isOpen()).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledWith(second);
});

test('disposing an inactive registration leaves the open state untouched', () => {
  const closed = jest.fn();
  disposables.push(chat.onDidClose(closed));

  const inactive = chat.registerChat(
    { id: 'first.chat', name: 'First' },
    trigger,
    panel,
  );
  disposables.push(
    chat.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel),
  );
  chat.open();

  inactive.dispose();

  expect(chat.isOpen()).toBe(true);
  expect(closed).not.toHaveBeenCalled();
});

test('disposing the last chat while open resets the open state', () => {
  const registration = chat.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );
  chat.open();
  expect(chat.isOpen()).toBe(true);

  registration.dispose();

  expect(chat.isOpen()).toBe(false);

  // A registration arriving much later must not inherit a stale open state.
  disposables.push(
    chat.registerChat({ id: 'late.chat', name: 'Late' }, trigger, panel),
  );
  expect(chat.isOpen()).toBe(false);
});

test('mode defaults to floating and setMode fires only on change', () => {
  const modeChanged = jest.fn();
  disposables.push(chat.onDidChangeMode(modeChanged));

  expect(chat.getMode()).toBe('floating');

  // Setting the current mode is a no-op.
  chat.setMode('floating');
  expect(modeChanged).not.toHaveBeenCalled();

  chat.setMode('panel');
  expect(chat.getMode()).toBe('panel');
  expect(modeChanged).toHaveBeenCalledWith('panel');
});

test('the snapshot is immutable per version and consistent with the registry', () => {
  const before = getChatSnapshot();

  disposables.push(
    chat.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel),
  );
  chat.open();

  const after = getChatSnapshot();
  // Unchanged references for old snapshots; a new object per change.
  expect(after).not.toBe(before);
  expect(before.active).toBeUndefined();
  expect(after).toMatchObject({
    open: true,
    mode: 'floating',
    active: getActiveChat(),
  });
  expect(after.version).toBeGreaterThan(before.version);
  // Stable reference between changes.
  expect(getChatSnapshot()).toBe(after);
});

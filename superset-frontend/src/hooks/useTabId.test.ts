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

import { renderHook, act } from '@testing-library/react';

// --- Fake BroadcastChannel ---
//
// jsdom has no cross-tab BroadcastChannel delivery, so a test drives the hook's
// listener directly by dispatching on the channel the hook created. Installed on
// the global before the hook module loads (getChannel constructs lazily, once).
type ChannelMessage = { type: string; tabId: string };

class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];

  posted: ChannelMessage[] = [];

  constructor(public name: string) {
    super();
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: ChannelMessage) {
    this.posted.push(message);
  }

  close() {}
}

(global as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
  FakeBroadcastChannel;

// The global test shim mocks 'src/hooks/useTabId' (BroadcastChannel leaks in
// jest); use the real implementation here. Loaded once so the hook, its helpers,
// and RTL all share a single React instance (resetModules would fork React).
const { getTabId, useTabId, subscribeTabIdChange } =
  jest.requireActual('src/hooks/useTabId');

// The hook's channel is a per-module singleton (constructed on first mount), so a
// single FakeBroadcastChannel instance is reused across tests; reference it here.
function channel(): FakeBroadcastChannel {
  return FakeBroadcastChannel.instances[0];
}

function emit(message: ChannelMessage) {
  act(() => {
    channel().dispatchEvent(new MessageEvent('message', { data: message }));
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  channel()?.posted.splice(0);
});

test('getTabId returns a stable id within the tab', () => {
  const first = getTabId();
  expect(first).toBeTruthy();
  // Repeat calls in the same tab return the same id (persisted in sessionStorage).
  expect(getTabId()).toBe(first);
});

test('getTabId reuses an id already stored by the useTabId hook', () => {
  // The hook persists its id under sessionStorage['tab_id']; getTabId (used by
  // non-React callers such as the async task middleware) must present the same
  // id so a tab is identified consistently everywhere.
  window.sessionStorage.setItem('tab_id', '42');
  expect(getTabId()).toBe('42');
});

test('useTabId claims a fresh id and broadcasts a request for a stored one', () => {
  window.sessionStorage.setItem('tab_id', '5');

  const { result } = renderHook(() => useTabId());

  expect(result.current).toBe('5');
  // A tab that reloads (id already in sessionStorage) asks peers whether the id
  // is a duplicate, so a genuinely duplicated tab can be told to reassign.
  expect(channel().posted).toContainEqual({
    type: 'REQUESTING_TAB_ID',
    tabId: '5',
  });
});

test('useTabId denies a peer that claims this tab’s id', () => {
  window.sessionStorage.setItem('tab_id', '5');

  renderHook(() => useTabId());
  channel().posted.splice(0);

  // A duplicated tab announces the same id; this tab (the incumbent) denies it.
  emit({ type: 'REQUESTING_TAB_ID', tabId: '5' });

  expect(channel().posted).toContainEqual({
    type: 'TAB_ID_DENIED',
    tabId: '5',
  });
});

test('useTabId reassigns and notifies subscribers when its id is denied', () => {
  const onChange = jest.fn();
  const unsubscribe = subscribeTabIdChange(onChange);

  const { result } = renderHook(() => useTabId());
  // Empty storage -> claims the first id without asking.
  expect(result.current).toBe('1');

  // A denial for the id this tab currently holds forces a reassignment, even
  // though it can arrive before React commits the initial state — the handler
  // compares against a live local id, not the render-captured state.
  emit({ type: 'TAB_ID_DENIED', tabId: '1' });

  expect(result.current).toBe('2');
  // Consumers that pinned the old id (e.g. the realtime socket channel) re-sync.
  expect(onChange).toHaveBeenCalledTimes(1);
  unsubscribe();
});

test('useTabId ignores channel messages addressed to other tabs', () => {
  const { result } = renderHook(() => useTabId());
  expect(result.current).toBe('1');

  emit({ type: 'TAB_ID_DENIED', tabId: '999' });

  expect(result.current).toBe('1');
});

test('useTabId removes its channel listener on unmount', () => {
  const { result, unmount } = renderHook(() => useTabId());
  expect(result.current).toBe('1');
  unmount();

  // After unmount a denial must not reach the (torn-down) handler.
  emit({ type: 'TAB_ID_DENIED', tabId: '1' });
  expect(result.current).toBe('1');
});

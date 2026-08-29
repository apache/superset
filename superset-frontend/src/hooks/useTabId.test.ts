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

// The global test shim mocks 'src/hooks/useTabId' (BroadcastChannel leaks in
// jest); use the real implementation here to exercise getTabId itself.
const { getTabId } = jest.requireActual('src/hooks/useTabId');

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
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

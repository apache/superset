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

/**
 * Zustand auto-mock for Jest: resets every store to its initial state between
 * tests, including middleware stores (devtools, subscribeWithSelector, temporal/zundo).
 * @see https://docs.pmnd.rs/zustand/guides/testing
 */
// act from 'react', not @testing-library/react (which registers cleanup hooks at import).
import { act } from 'react';
import type { StateCreator } from 'zustand';
import { create as actualCreate } from 'zustand';

// Re-export the real createStore/useStore so middleware like zundo's temporal
// can resolve them when importing from the mocked 'zustand' module.
export { createStore } from 'zustand/vanilla';
export { useStore } from 'zustand';

// On globalThis (survives jest.resetModules()) so re-imports don't re-declare the
// reset hook mid-test, which Jest 30 forbids.
const globalScope = globalThis as typeof globalThis & {
  __zustandMockResetFns?: Set<() => void>;
  __zustandMockHookRegistered?: boolean;
};
if (!globalScope.__zustandMockResetFns) {
  globalScope.__zustandMockResetFns = new Set<() => void>();
}
const storeResetFns = globalScope.__zustandMockResetFns;

const createUncurried = <T>(stateCreator: StateCreator<T>) => {
  const store = actualCreate(stateCreator);

  let initialState: T;
  try {
    initialState = store.getInitialState();
  } catch {
    initialState = store.getState();
  }

  storeResetFns.add(() => {
    store.setState(initialState, true);
    // Also clear zundo temporal history when the store has it.
    const withTemporal = store as typeof store & {
      temporal?: { getState(): { clear(): void } };
    };
    if (withTemporal.temporal) {
      try {
        withTemporal.temporal.getState().clear();
      } catch {
        // temporal not available
      }
    }
  });
  return store;
};

export const create = (<T>(stateCreator: StateCreator<T>) => {
  if (typeof stateCreator === 'function') {
    return createUncurried(stateCreator);
  }
  return (innerCreator: StateCreator<T>) => createUncurried(innerCreator);
}) as typeof actualCreate;

// currentTestName is set only while a test is executing. Registering afterEach
// then is forbidden by Jest 30, and the failure is deferred (not throwable), so
// we must avoid the call entirely. This happens when the mock is first loaded
// lazily inside a test body (e.g. require('./index')); such tests manage their
// own modules and don't rely on the between-test store reset.
let isInsideRunningTest = false;
try {
  isInsideRunningTest = Boolean(expect.getState().currentTestName);
} catch {
  isInsideRunningTest = false;
}

if (!globalScope.__zustandMockHookRegistered && !isInsideRunningTest) {
  globalScope.__zustandMockHookRegistered = true;
  afterEach(() => {
    act(() => {
      storeResetFns.forEach(resetFn => {
        resetFn();
      });
    });
  });
}

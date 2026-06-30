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
import { act } from '@testing-library/react';
import type { StateCreator } from 'zustand';
import { create as actualCreate } from 'zustand';

// Re-export the real createStore/useStore so middleware like zundo's temporal
// can resolve them when importing from the mocked 'zustand' module.
export { createStore } from 'zustand/vanilla';
export { useStore } from 'zustand';

const storeResetFns = new Set<() => void>();

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

afterEach(() => {
  act(() => {
    storeResetFns.forEach(resetFn => {
      resetFn();
    });
  });
});

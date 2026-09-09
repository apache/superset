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
import type { common as core } from '@apache-superset/core';
import { listenerMiddleware, RootState, store } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';

export function createActionListener<V, A = unknown>(
  predicate: AnyListenerPredicate<RootState>,
  listener: (v: V) => void,
  valueParser: (action: A, state: RootState) => V | null | undefined,
  thisArgs?: unknown,
): core.Disposable {
  const boundListener = thisArgs ? listener.bind(thisArgs as object) : listener;

  const unsubscribe = listenerMiddleware.startListening({
    predicate,
    effect: action => {
      const state = store.getState();
      // The predicate already ensures the action matches type A at runtime.
      const value = valueParser(action as unknown as A, state);
      if (value != null) {
        boundListener(value);
      }
    },
  });

  return {
    dispose: () => {
      unsubscribe();
    },
  };
}

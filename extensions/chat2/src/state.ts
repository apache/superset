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
 * Module-scoped open/closed state plus a tiny emitter the UI subscribes to.
 *
 * Lives entirely inside the extension — never reaches into the host store.
 * Reset on dispose so re-activation starts cleanly.
 */

export type OpenStateListener = (open: boolean) => void;

let open = false;
const listeners = new Set<OpenStateListener>();

export const isOpen = (): boolean => open;

export const setOpen = (next: boolean): void => {
  if (next === open) return;
  open = next;
  listeners.forEach(fn => {
    try {
      fn(open);
    } catch {
      // A listener throwing must not block other listeners or flip our state back.
    }
  });
};

export const subscribe = (fn: OpenStateListener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Drains listeners and resets state. Called from the master Disposable. */
export const resetState = (): void => {
  open = false;
  listeners.clear();
};

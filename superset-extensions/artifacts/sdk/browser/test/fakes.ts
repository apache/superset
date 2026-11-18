/*
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
 * Stand-ins for the windows on either side of the bridge. They record what
 * is posted to them, and deliver events synchronously, so tests don't
 * depend on how a DOM implementation schedules `postMessage`.
 */

type Listener = (event: unknown) => void;

export interface Posted {
  message: unknown;
  targetOrigin: string;
}

export interface FakeWindow {
  /** The fake, typed as the window the code under test expects. */
  window: Window;
  /** What was posted to this window. */
  posted: Posted[];
  /** Dispatch an event of `type` to this window's listeners. */
  dispatch(type: string, event: unknown): void;
  /** Deliver a `message` event here, as if `source` had posted `data`. */
  deliver(source: Window, data: unknown): void;
  /** How many listeners of `type` this window has. */
  listeners(type: string): number;
}

export interface FakeWindowOptions {
  name?: string;
  origin?: string;
  /** The window's parent; a window without one is its own parent. */
  parent?: Window;
}

export function createFakeWindow({
  name = '',
  origin = 'https://example.com',
  parent,
}: FakeWindowOptions = {}): FakeWindow {
  const listeners = new Map<string, Set<Listener>>();
  const posted: Posted[] = [];
  const fake: Record<string, unknown> = {
    name,
    location: { origin },
    postMessage: (message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin });
    },
    addEventListener: (type: string, listener: Listener) => {
      const registered = listeners.get(type) ?? new Set<Listener>();
      registered.add(listener);
      listeners.set(type, registered);
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
  };
  fake.parent = parent ?? fake;
  const dispatch = (type: string, event: unknown) => {
    listeners.get(type)?.forEach(listener => listener(event));
  };
  return {
    window: fake as unknown as Window,
    posted,
    dispatch,
    deliver: (source, data) => dispatch('message', { source, data }),
    listeners: type => listeners.get(type)?.size ?? 0,
  };
}

/** A stand-in iframe element whose content window is `contentWindow`. */
export const fakeFrame = (contentWindow: Window | null): HTMLIFrameElement =>
  ({ contentWindow }) as unknown as HTMLIFrameElement;

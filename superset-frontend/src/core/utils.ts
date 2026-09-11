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

type Listener<T> = (e: T) => unknown;

/** A stateless event emitter exposing a VS Code-style `event` subscriber. */
export interface EventEmitter<T> {
  /** Notifies every current subscriber with `value`. */
  fire(value: T): void;
  /** Registers a listener; returns a Disposable that removes it. */
  subscribe: core.Event<T>;
}

/** An event emitter that also retains the last fired value. */
export interface ValueEventEmitter<T> extends EventEmitter<T> {
  /** Returns the value last passed to {@link fire} (or the initial value). */
  getCurrent(): T;
}

/**
 * Creates a stateless event emitter. Listeners registered via `event` receive
 * every subsequent `fire`; a returned Disposable removes the listener.
 */
export function createEventEmitter<T>(): EventEmitter<T> {
  const listeners = new Set<Listener<T>>();
  const subscribe: core.Event<T> = (listener, thisArgs) => {
    const bound = thisArgs ? listener.bind(thisArgs) : listener;
    listeners.add(bound);
    return { dispose: () => listeners.delete(bound) };
  };
  return {
    fire: value => listeners.forEach(fn => fn(value)),
    subscribe,
  };
}

/**
 * Creates a value event emitter seeded with `initial`. Behaves like
 * {@link createEventEmitter} but also tracks the last fired value, readable
 * via `getCurrent` — useful for state that is both observed and queried.
 */
export function createValueEventEmitter<T>(initial: T): ValueEventEmitter<T> {
  const { fire, subscribe } = createEventEmitter<T>();
  let current = initial;
  return {
    fire: value => {
      current = value;
      fire(value);
    },
    subscribe,
    getCurrent: () => current,
  };
}

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
import { AnyAction } from 'redux';
import { listenerMiddleware, RootState, store } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import { Disposable } from './models';

/**
 * A typed event subscription matching the public `Event<T>` contract.
 * Calling it with a listener (and optional `this` arg) subscribes and returns
 * a {@link Disposable} that unsubscribes.
 */
export type EventSubscriber<T> = (
  listener: (e: T) => void,
  thisArgs?: unknown,
) => Disposable;

/**
 * A minimal host-internal event emitter shared by the producer-backed
 * namespaces (dataset, navigation, settings, view registry). Each of those
 * needs the same "publish a value and fan it out to subscribers" primitive;
 * this collapses the duplicated Set + bind + Disposable boilerplate into one
 * place.
 *
 * `event` is exposed to extensions as the namespace's `onDidChange*`; `fire`
 * and `getCurrent` stay host-internal.
 */
export interface Emitter<T> {
  /** Subscribe to changes; conforms to the public `Event<T>` shape. */
  event: EventSubscriber<T>;
  /** Notify all current subscribers with `value`. */
  fire: (value: T) => void;
  /** The most recently fired value (or the initial value). */
  getCurrent: () => T;
}

/**
 * A current-value-less event emitter for pure notifications (e.g. "a chat
 * was registered", "the panel opened") where a "latest value" reading makes
 * no sense. {@link createEmitter} layers value tracking on top of this.
 */
export interface EventEmitter<T> {
  /** Subscribe to events; conforms to the public `Event<T>` shape. */
  event: EventSubscriber<T>;
  /** Notify all current subscribers with `value`. */
  fire: (value: T) => void;
}

export function createEventEmitter<T>(): EventEmitter<T> {
  const listeners = new Set<(e: T) => void>();

  return {
    event: (listener, thisArgs) => {
      const bound = thisArgs ? listener.bind(thisArgs) : listener;
      listeners.add(bound);
      return new Disposable(() => {
        listeners.delete(bound);
      });
    },
    fire: value => {
      listeners.forEach(fn => fn(value));
    },
  };
}

export function createEmitter<T>(initial: T): Emitter<T> {
  const { event, fire } = createEventEmitter<T>();
  let current = initial;

  return {
    event,
    fire: value => {
      current = value;
      fire(value);
    },
    getCurrent: () => current,
  };
}

export function createActionListener<V>(
  predicate: AnyListenerPredicate<RootState>,
  listener: (v: V) => void,
  valueParser: (action: AnyAction, state: RootState) => V | null | undefined,
  thisArgs?: any,
): core.Disposable {
  const boundListener = thisArgs ? listener.bind(thisArgs) : listener;

  const unsubscribe = listenerMiddleware.startListening({
    predicate,
    effect: (action: AnyAction) => {
      const state = store.getState();
      const value = valueParser(action, state);
      // Skip calling listener if valueParser returns null/undefined
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

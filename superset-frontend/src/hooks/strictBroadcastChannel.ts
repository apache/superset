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

// Credit to Eric Wong at https://stackoverflow.com/a/78491331
interface StrictBroadcastChannelEventMap<T> {
  message: MessageEvent<T>;
  messageerror: MessageEvent<T>;
}

export interface StrictBroadcastChannel<T> extends EventTarget {
  readonly name: string;
  onmessage: ((this: BroadcastChannel, ev: MessageEvent<T>) => any) | null;
  onmessageerror: ((this: BroadcastChannel, ev: MessageEvent<T>) => any) | null;
  close(): void;
  postMessage(message: T): void;
  addEventListener<K extends keyof StrictBroadcastChannelEventMap<T>>(
    type: K,
    listener: (
      this: BroadcastChannel,
      ev: StrictBroadcastChannelEventMap<T>[K],
    ) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof StrictBroadcastChannelEventMap<T>>(
    type: K,
    listener: (
      this: BroadcastChannel,
      ev: StrictBroadcastChannelEventMap<T>[K],
    ) => any,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface TabIdChannelMessage {
  type: 'REQUESTING_TAB_ID' | 'TAB_ID_DENIED';
  tabId: string;
}

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

import JSDOMEnvironment from 'jest-environment-jsdom';

// jest-environment-jsdom 30 bundles jsdom 26, which marks window.location as
// [LegacyUnforgeable] (configurable: false). jest 30's spyOn now strictly
// checks the configurable flag and throws when it's false, breaking every test
// that uses jest.spyOn(window, 'location', 'get').
//
// We intercept Object.defineProperties at module-load time (before any JSDOM
// instance is created). The interceptor makes window.location configurable
// every time jsdom creates a new Window, restoring the ability to spy on it.
// This file is only required by Jest in the test environment so the
// monkey-patch is safe.
const _originalDefineProperties = Object.defineProperties.bind(Object);
(Object as any).defineProperties = function (
  obj: object,
  props: PropertyDescriptorMap,
) {
  if (
    props !== null &&
    typeof props === 'object' &&
    Object.prototype.hasOwnProperty.call(props, 'location') &&
    (props as any).location?.configurable === false
  ) {
    // Allow jest.spyOn(window, 'location', 'get') to work in tests by making
    // the property configurable. This deviates from the browser spec's
    // [LegacyUnforgeable] requirement but is acceptable in a test environment.
    props = {
      ...props,
      location: { ...(props as any).location, configurable: true },
    };
  }
  return _originalDefineProperties(obj, props);
};

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.AbortSignal = AbortSignal;
    this.global.AbortController = AbortController;
    this.global.ReadableStream = ReadableStream;

    // Ant Design v6's scheduler instantiates `new MessageChannel()` directly, so
    // the previous `undefined` stub (a workaround for an rc-overflow@1.4.1
    // MessagePort leak, see https://github.com/apache/superset/pull/34871) now
    // throws "MessageChannel is not a constructor". jsdom's native MessageChannel
    // delivers asynchronously and does not flush inside testing-library's act(),
    // so we provide a lightweight polyfill that delivers messages as macrotasks
    // (matching React's own setTimeout scheduler fallback). setTimeout(0) does
    // not keep the event loop alive, so the original hang does not return.
    class PolyfillMessagePort {
      onmessage: ((event: { data: unknown }) => void) | null = null;

      private listeners: Array<(event: { data: unknown }) => void> = [];

      _peer: PolyfillMessagePort | null = null;

      postMessage(data: unknown) {
        const peer = this._peer;
        if (!peer) return;
        setTimeout(() => {
          peer.onmessage?.({ data });
          peer.listeners.forEach(fn => fn({ data }));
        }, 0);
      }

      addEventListener(type: string, fn: (event: { data: unknown }) => void) {
        if (type === 'message') this.listeners.push(fn);
      }

      removeEventListener(
        type: string,
        fn: (event: { data: unknown }) => void,
      ) {
        if (type === 'message')
          this.listeners = this.listeners.filter(l => l !== fn);
      }

      start() {}

      close() {}
    }
    class PolyfillMessageChannel {
      port1 = new PolyfillMessagePort();

      port2 = new PolyfillMessagePort();

      constructor() {
        this.port1._peer = this.port2;
        this.port2._peer = this.port1;
      }
    }
    this.global.MessageChannel = PolyfillMessageChannel as any;
    this.global.MessagePort = PolyfillMessagePort as any;
  }
}

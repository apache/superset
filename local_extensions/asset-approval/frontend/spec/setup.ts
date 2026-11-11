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

import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Superset marks test hooks with `data-test`, and the pages in this
// extension follow that rather than inventing a second convention.
configure({ testIdAttribute: 'data-test' });

// antd reads these; jsdom provides neither.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// The other half of that pair, and it was missing: antd's Table and
// Tooltip observe their container to decide what to show, so a component
// that renders either one threw `ResizeObserver is not defined` on mount
// and took its whole suite down. It is a no-op rather than a mock with
// behaviour -- nothing here asserts on resize, and a stub that reported
// sizes would invite tests that depend on a geometry jsdom does not have.
window.ResizeObserver =
  window.ResizeObserver ||
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };

// And the third: antd's dropdown schedules its open through a
// `MessageChannel`, which this jsdom does not provide, so opening a Select
// threw before any assertion ran. Node's own implementation rather than a
// setTimeout stand-in -- the scheduling is real, so a test that waits for
// the dropdown waits for the same turn the browser would.
if (typeof globalThis.MessageChannel === 'undefined') {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { MessageChannel } = require('worker_threads');
  globalThis.MessageChannel = MessageChannel;
}

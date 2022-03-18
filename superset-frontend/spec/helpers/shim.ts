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
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import 'jest-enzyme';
import jQuery from 'jquery';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
// https://jestjs.io/docs/jest-object#jestmockmodulename-factory-options
// in order to mock modules in test case, so avoid absolute import module
import { configure as configureTranslation } from '../../packages/superset-ui-core/src/translation';
import { Worker } from './Worker';
import { IntersectionObserver } from './IntersectionObserver';
import { ResizeObserver } from './ResizeObserver';
import setupSupersetClient from './setupSupersetClient';
import CacheStorage from './CacheStorage';

configure({ adapter: new Adapter() });

const exposedProperties = ['window', 'navigator', 'document'];

const { defaultView } = document;
if (defaultView != null) {
  Object.keys(defaultView).forEach(property => {
    if (typeof global[property] === 'undefined') {
      exposedProperties.push(property);
      global[property] = defaultView[property];
    }
  });
}

const g = global as any;
g.window = g.window || {};
g.window.location = { href: 'about:blank' };
g.window.performance = { now: () => new Date().getTime() };
g.window.Worker = Worker;
g.window.IntersectionObserver = IntersectionObserver;
g.window.ResizeObserver = ResizeObserver;
g.URL.createObjectURL = () => '';
g.caches = new CacheStorage();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

g.$ = jQuery(g.window);

configureTranslation();
setupSupersetClient();

// The useTabId hook depends on BroadcastChannel. Jest has a memory leak problem when
// dealing with native modules. See https://chanind.github.io/javascript/2019/10/12/jest-tests-memory-leak.html
// and https://github.com/facebook/jest/issues/6814 for more information.
jest.mock('src/hooks/useTabId', () => ({
  useTabId: () => 1,
}));

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
import { configure as configureTranslation } from '@superset-ui/translation';

import setupSupersetClient from './setupSupersetClient';

configure({ adapter: new Adapter() });

const exposedProperties = ['window', 'navigator', 'document'];

const defaultView = document.defaultView;
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

g.$ = jQuery(g.window);

configureTranslation();
setupSupersetClient();

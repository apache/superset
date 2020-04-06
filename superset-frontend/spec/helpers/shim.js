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
/* eslint no-native-reassign: 0 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import jsdom from 'jsdom';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import { configure as configureTranslation } from '@superset-ui/translation';

import setupSupersetClient from './setupSupersetClient';

configure({ adapter: new Adapter() });

const exposedProperties = ['window', 'navigator', 'document'];

global.jsdom = jsdom.jsdom;
global.document = global.jsdom('<!doctype html><html><body></body></html>');
global.window = document.defaultView;
global.HTMLElement = window.HTMLElement;

Object.keys(document.defaultView).forEach(property => {
  if (typeof global[property] === 'undefined') {
    exposedProperties.push(property);
    global[property] = document.defaultView[property];
  }
});

global.navigator = {
  userAgent: 'node.js',
  platform: 'linux',
  appName: 'Netscape',
};

// Fix `Option is not defined`
// https://stackoverflow.com/questions/39501589/jsdom-option-is-not-defined-when-running-my-mocha-test
global.Option = window.Option;

// Configuration copied from https://github.com/sinonjs/sinon/issues/657
// allowing for sinon.fakeServer to work

global.window = global.document.defaultView;
global.XMLHttpRequest = global.window.XMLHttpRequest;

global.sinon = require('sinon');

global.sinon.useFakeXMLHttpRequest();

global.window.XMLHttpRequest = global.XMLHttpRequest;
global.window.location = { href: 'about:blank' };
global.window.performance = { now: () => new Date().getTime() };
global.$ = require('jquery')(global.window);

configureTranslation();
setupSupersetClient();

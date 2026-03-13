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
import './shim';
// eslint-disable-next-line no-restricted-syntax -- whole React import is required for mocking React module in tests.
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import { configure as configureTestingLibrary } from '@testing-library/react';
// import { matchers } from '@emotion/jest';
import { vi } from 'vitest';

configureTestingLibrary({
  testIdAttribute: 'data-test',
});

document.body.innerHTML = '<div id="app" data-bootstrap=""></div>';
// expect.extend(matchers);

// Allow JSX tests to have React import readily available
global.React = React;

// @ts-ignore
global.setInterval = global.jsdom.window.setInterval;
// @ts-ignore
global.TextEncoder = global.jsdom.window.TextEncoder;
// @ts-ignore
global.TextDecoder = global.jsdom.window.TextDecoder;

// Mock ace-builds globally for tests
vi.mock('ace-builds/src-min-noconflict/mode-handlebars', () => ({}));
vi.mock('ace-builds/src-min-noconflict/mode-css', () => ({}));
vi.mock('ace-builds/src-noconflict/theme-github', () => ({}));
vi.mock('ace-builds/src-noconflict/theme-monokai', () => ({}));

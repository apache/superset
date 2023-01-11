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

import { isUrlExternal, parseUrl } from './urlUtils';

test('isUrlExternal', () => {
  expect(isUrlExternal('http://google.com')).toBeTruthy();
  expect(isUrlExternal('https://google.com')).toBeTruthy();
  expect(isUrlExternal('//google.com')).toBeTruthy();
  expect(isUrlExternal('google.com')).toBeTruthy();
  expect(isUrlExternal('www.google.com')).toBeTruthy();
  expect(isUrlExternal('mailto:mail@example.com')).toBeTruthy();

  // treat all urls starting with protocol or hostname as external
  // such urls are not handled well by react-router Link component
  expect(isUrlExternal('http://localhost:8888/port')).toBeTruthy();
  expect(isUrlExternal('https://localhost/secure')).toBeTruthy();
  expect(isUrlExternal('http://localhost/about')).toBeTruthy();
  expect(isUrlExternal('HTTP://localhost/about')).toBeTruthy();
  expect(isUrlExternal('//localhost/about')).toBeTruthy();
  expect(isUrlExternal('localhost/about')).toBeTruthy();

  expect(isUrlExternal('/about')).toBeFalsy();
  expect(isUrlExternal('#anchor')).toBeFalsy();
});

test('parseUrl', () => {
  expect(parseUrl('http://google.com')).toEqual('http://google.com');
  expect(parseUrl('//google.com')).toEqual('//google.com');
  expect(parseUrl('mailto:mail@example.com')).toEqual(
    'mailto:mail@example.com',
  );
  expect(parseUrl('google.com')).toEqual('//google.com');
  expect(parseUrl('www.google.com')).toEqual('//www.google.com');

  expect(parseUrl('/about')).toEqual('/about');
  expect(parseUrl('#anchor')).toEqual('#anchor');
});

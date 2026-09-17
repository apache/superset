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

import { isUrlExternal, parseUrl, toQueryString } from './urlUtils';

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

describe('toQueryString', () => {
  it('should return an empty string if the input is an empty object', () => {
    expect(toQueryString({})).toBe('');
  });

  it('should correctly convert a single key-value pair to a query string', () => {
    expect(toQueryString({ key: 'value' })).toBe('?key=value');
  });

  it('should correctly convert multiple key-value pairs to a query string', () => {
    expect(toQueryString({ key1: 'value1', key2: 'value2' })).toBe(
      '?key1=value1&key2=value2',
    );
  });

  it('should encode URI components', () => {
    expect(
      toQueryString({ 'a key': 'a value', email: 'test@example.com' }),
    ).toBe('?a%20key=a%20value&email=test%40example.com');
  });

  it('should omit keys with undefined values', () => {
    expect(toQueryString({ key1: 'value1', key2: undefined })).toBe(
      '?key1=value1',
    );
  });

  it('should omit keys with null values', () => {
    expect(toQueryString({ key1: 'value1', key2: null })).toBe('?key1=value1');
  });

  it('should handle numbers and boolean values as parameter values', () => {
    expect(toQueryString({ number: 123, truth: true, lie: false })).toBe(
      '?number=123&truth=true&lie=false',
    );
  });

  it('should handle special characters in keys and values', () => {
    expect(toQueryString({ 'user@domain': 'me&you' })).toBe(
      '?user%40domain=me%26you',
    );
  });
});

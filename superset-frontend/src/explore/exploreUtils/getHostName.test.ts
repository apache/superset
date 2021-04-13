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
import { getHostName } from '.';

jest.mock('src/utils/hostNamesConfig', () => ({
  availableDomains: [
    'domain-a',
    'domain-b',
    'domain-c',
    'domain-d',
    'domain-e',
    'domain-f',
    'domain-g',
  ],
}));

test('Should get next diferent domain on a loop, never the first on the list', () => {
  for (let loop = 3; loop > 0; loop -= 1) {
    expect(getHostName(true)).toBe('domain-b');
    expect(getHostName(true)).toBe('domain-c');
    expect(getHostName(true)).toBe('domain-d');
    expect(getHostName(true)).toBe('domain-e');
    expect(getHostName(true)).toBe('domain-f');
    expect(getHostName(true)).toBe('domain-g');
  }
});

test('Should always return the same domain, the first on the list', () => {
  expect(getHostName(false)).toBe('domain-a');
  expect(getHostName(false)).toBe('domain-a');
});

test('Should always return the same domain, the first on the list - no args', () => {
  expect(getHostName()).toBe('domain-a');
  expect(getHostName()).toBe('domain-a');
});

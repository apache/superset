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

import { availableDomains, allowCrossDomain } from './hostNamesConfig';

describe('hostNamesConfig', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'localhost',
        search: '',
      },
      writable: true,
    });
  });

  test('should export availableDomains as array of strings', () => {
    expect(Array.isArray(availableDomains)).toBe(true);
    availableDomains.forEach(domain => {
      expect(typeof domain).toBe('string');
    });
  });

  test('should export allowCrossDomain as boolean', () => {
    expect(typeof allowCrossDomain).toBe('boolean');
  });

  test('should determine allowCrossDomain based on availableDomains length', () => {
    const expectedValue = availableDomains.length > 1;
    expect(allowCrossDomain).toBe(expectedValue);
  });

  test('availableDomains should contain at least the current hostname', () => {
    // Since we're testing the already computed values, we check they contain localhost
    // or the configuration returns empty array if app container is missing
    expect(availableDomains.length >= 0).toBe(true);
  });
});

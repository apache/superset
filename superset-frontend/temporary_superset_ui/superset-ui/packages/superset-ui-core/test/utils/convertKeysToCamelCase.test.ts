/*
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

import { convertKeysToCamelCase } from '@superset-ui/core/src';

describe('convertKeysToCamelCase(object)', () => {
  it('returns undefined for undefined input', () => {
    expect(convertKeysToCamelCase(undefined)).toBeUndefined();
  });
  it('returns null for null input', () => {
    expect(convertKeysToCamelCase(null)).toBeNull();
  });
  it('returns a new object that has all keys in camelCase', () => {
    const input = {
      is_happy: true,
      'is-angry': false,
      isHungry: false,
    };
    expect(convertKeysToCamelCase(input)).toEqual({
      isHappy: true,
      isAngry: false,
      isHungry: false,
    });
  });
  it('throws error if input is not a plain object', () => {
    expect(() => {
      convertKeysToCamelCase({});
    }).not.toThrow();
    expect(() => {
      convertKeysToCamelCase('');
    }).toThrow();
    expect(() => {
      convertKeysToCamelCase(new Map());
    }).toThrow();
  });
});

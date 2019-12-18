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
import { getNestedValue, interpolate } from '../../../src/showSavedQuery/utils';

describe('getNestedValue', () => {
  it('is a function', () => {
    expect(typeof getNestedValue).toBe('function');
  });

  it('works with simple ids', () => {
    const obj = { a: '1' };
    const id = 'a';
    expect(getNestedValue(obj, id)).toEqual('1');
  });

  it('works with complex ids', () => {
    const obj = { a: { b: '1' } };
    const id = 'a.b';
    expect(getNestedValue(obj, id)).toEqual('1');
  });

  it('works with other separators', () => {
    const obj = { a: { b: { c: '1' } } };
    const id = 'a__b__c';
    const separator = '__';
    expect(getNestedValue(obj, id, separator)).toEqual('1');
  });
});

describe('interpolate', () => {
  it('is a function', () => {
    expect(typeof interpolate).toBe('function');
  });

  it('works with simple ids', () => {
    const obj = { a: '1' };
    // eslint-disable-next-line no-template-curly-in-string
    const str = 'value: ${a}';
    expect(interpolate(str, obj)).toEqual('value: 1');
  });

  it('works with complex ids', () => {
    const obj = { a: { b: '1' } };
    // eslint-disable-next-line no-template-curly-in-string
    const str = 'value: ${a.b}';
    expect(interpolate(str, obj)).toEqual('value: 1');
  });
});

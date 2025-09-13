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
import getKeyForFilterScopeTree from './getKeyForFilterScopeTree';

describe('getKeyForFilterScopeTree', () => {
  test('should return stringified activeFilterField array when activeFilterField is provided', () => {
    const props = {
      activeFilterField: 'filter1',
      checkedFilterFields: ['filter2', 'filter3'],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('["filter1"]');
  });

  test('should return stringified checkedFilterFields when activeFilterField is not provided', () => {
    const props = {
      checkedFilterFields: ['filter2', 'filter3'],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('["filter2","filter3"]');
  });

  test('should return stringified checkedFilterFields when activeFilterField is undefined', () => {
    const props = {
      activeFilterField: undefined,
      checkedFilterFields: ['filter1'],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('["filter1"]');
  });

  test('should return stringified empty array when both fields are empty', () => {
    const props = {
      checkedFilterFields: [],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('[]');
  });

  test('should handle single checked filter field', () => {
    const props = {
      checkedFilterFields: ['singleFilter'],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('["singleFilter"]');
  });

  test('should prioritize activeFilterField over checkedFilterFields', () => {
    const props = {
      activeFilterField: 'activeFilter',
      checkedFilterFields: ['checked1', 'checked2'],
    };

    const result = getKeyForFilterScopeTree(props);
    expect(result).toBe('["activeFilter"]');
  });
});

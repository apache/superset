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
import { DataMaskStateWithId } from '@superset-ui/core';
import { getRelevantDataMask } from './activeAllDashboardFilters';

const mockDataMask: DataMaskStateWithId = {
  filter1: {
    id: 'filter1',
    extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['USA'] }] },
    filterState: { value: ['USA'] },
    ownState: { currentValue: 'USA', isOpen: false },
  },
  filter2: {
    id: 'filter2',
    extraFormData: { filters: [{ col: 'category', op: 'IN', val: ['A'] }] },
    filterState: { value: ['A'] },
    ownState: { inputValue: 'category A', selectedKeys: ['A'] },
  },
  filter3: {
    id: 'filter3',
    extraFormData: undefined,
    filterState: { value: [] },
    ownState: {},
  },
  filter4: {
    id: 'filter4',
    filterState: { value: ['B'] },
    ownState: { expanded: true, searchTerm: 'B' },
  },
};

test('should return relevant data mask for extraFormData property', () => {
  const result = getRelevantDataMask(mockDataMask, 'extraFormData');

  expect(result).toEqual({
    filter1: { filters: [{ col: 'country', op: 'IN', val: ['USA'] }] },
    filter2: { filters: [{ col: 'category', op: 'IN', val: ['A'] }] },
  });
});

test('should return relevant data mask for filterState property', () => {
  const result = getRelevantDataMask(mockDataMask, 'filterState');

  expect(result).toEqual({
    filter1: { value: ['USA'] },
    filter2: { value: ['A'] },
    filter3: { value: [] },
    filter4: { value: ['B'] },
  });
});

test('should return relevant data mask for ownState property', () => {
  const result = getRelevantDataMask(mockDataMask, 'ownState');

  expect(result).toEqual({
    filter1: { currentValue: 'USA', isOpen: false },
    filter2: { inputValue: 'category A', selectedKeys: ['A'] },
    filter3: {},
    filter4: { expanded: true, searchTerm: 'B' },
  });
});

test('should return empty object when no items have the specified property', () => {
  const mockDataMaskWithoutProperty: DataMaskStateWithId = {
    filter1: {
      id: 'filter1',
      filterState: { value: ['USA'] },
      ownState: {},
    },
    filter2: {
      id: 'filter2',
      filterState: { value: ['A'] },
      ownState: {},
    },
  };

  const result = getRelevantDataMask(
    mockDataMaskWithoutProperty,
    'extraFormData',
  );

  expect(result).toEqual({});
});

test('should return empty object when dataMask is empty', () => {
  const result = getRelevantDataMask({}, 'extraFormData');

  expect(result).toEqual({});
});

test('should handle falsy values correctly', () => {
  const mockDataMaskWithFalsyValues: DataMaskStateWithId = {
    filter1: {
      id: 'filter1',
      extraFormData: undefined,
      filterState: { value: [] },
      ownState: {},
    },
    filter2: {
      id: 'filter2',
      extraFormData: {},
      filterState: { value: ['A'] },
      ownState: {},
    },
    filter3: {
      id: 'filter3',
      extraFormData: undefined,
      filterState: { value: ['B'] },
      ownState: {},
    },
  };

  const result = getRelevantDataMask(
    mockDataMaskWithFalsyValues,
    'extraFormData',
  );

  expect(result).toEqual({
    filter2: {},
  });
});

test('should preserve the structure of the property value', () => {
  const mockDataMaskWithComplexData: DataMaskStateWithId = {
    filter1: {
      id: 'filter1',
      extraFormData: {
        filters: [
          { col: 'country', op: 'IN', val: ['USA', 'Canada'] },
          { col: 'year', op: '>=', val: 2020 },
        ],
      },
      filterState: { value: [] },
      ownState: {},
    },
  };

  const result = getRelevantDataMask(
    mockDataMaskWithComplexData,
    'extraFormData',
  );

  expect(result).toEqual({
    filter1: {
      filters: [
        { col: 'country', op: 'IN', val: ['USA', 'Canada'] },
        { col: 'year', op: '>=', val: 2020 },
      ],
    },
  });
});

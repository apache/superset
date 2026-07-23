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
import transformProps from './transformProps';

describe('transformProps', () => {
  test('transforms chart props correctly', () => {
    const chartProps = {
      formData: {
        groupby: ['category'],
        controlType: 'dropdown',
        multiSelect: true,
        enableEmptyFilter: false,
        inverseSelection: false,
        defaultToFirstItem: false,
        sortAscending: true,
      },
      height: 100,
      hooks: {
        setDataMask: jest.fn(),
        setHoveredFilter: jest.fn(),
        unsetHoveredFilter: jest.fn(),
        setFocusedFilter: jest.fn(),
        unsetFocusedFilter: jest.fn(),
        setFilterActive: jest.fn(),
        clearAllTrigger: undefined,
        onClearAllComplete: undefined,
      },
      queriesData: [
        {
          colnames: ['category'],
          coltypes: [0],
          data: [
            { category: 'Electronics' },
            { category: 'Clothing' },
          ],
        },
      ],
      width: 200,
      displaySettings: {
        filterBarOrientation: 'vertical',
        isOverflowingFilterBar: false,
      },
      behaviors: ['NATIVE_FILTER'],
      appSection: 'FILTER_BAR',
      filterState: { value: [] },
      isRefreshing: false,
      inputRef: { current: null },
    };

    const result = transformProps(chartProps);

    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.formData.controlType).toBe('dropdown');
    expect(result.formData.multiSelect).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.coltypeMap).toEqual({ category: 0 });
    expect(result.filterBarOrientation).toBe('vertical');
    expect(result.isOverflowingFilterBar).toBe(false);
  });

  test('handles missing queriesData', () => {
    const chartProps = {
      formData: {
        groupby: ['category'],
        controlType: 'checkbox',
      },
      height: 100,
      hooks: {
        setDataMask: jest.fn(),
        setHoveredFilter: jest.fn(),
        unsetHoveredFilter: jest.fn(),
        setFocusedFilter: jest.fn(),
        unsetFocusedFilter: jest.fn(),
        setFilterActive: jest.fn(),
      },
      queriesData: [],
      width: 200,
      displaySettings: {},
      behaviors: [],
      appSection: 'FILTER_BAR',
      filterState: { value: [] },
      isRefreshing: false,
      inputRef: { current: null },
    };

    const result = transformProps(chartProps);

    expect(result.data).toHaveLength(0);
    expect(result.coltypeMap).toEqual({});
  });
});

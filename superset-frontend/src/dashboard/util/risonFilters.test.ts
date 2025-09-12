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
import { PartialFilters, DataMaskStateWithId } from '@superset-ui/core';
import {
  injectRisonFiltersIntelligently,
  RisonFilter,
  parseRisonFilters,
} from './risonFilters';

describe('risonFilters intelligent injection', () => {
  const mockNativeFilters: PartialFilters = {
    filter_1: {
      id: 'filter_1',
      targets: [
        {
          column: { name: 'country' },
          datasetId: 1,
        },
      ],
      filterType: 'filter_select',
    },
    filter_2: {
      id: 'filter_2',
      targets: [
        {
          column: { name: 'year' },
          datasetId: 1,
        },
      ],
      filterType: 'filter_range',
    },
  };

  const mockDataMask: DataMaskStateWithId = {
    filter_1: {
      id: 'filter_1',
      filterState: { value: undefined },
      ownState: {},
    },
  };

  it('should match Rison filter to native filter by column name', () => {
    const risonFilters: RisonFilter[] = [
      { subject: 'country', operator: '==', comparator: 'USA' },
    ];

    const result = injectRisonFiltersIntelligently(
      risonFilters,
      mockNativeFilters,
      mockDataMask,
    );

    expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);
    expect(result.unmatchedFilters).toHaveLength(0);
  });

  it('should handle unmatched filters with fallback', () => {
    const risonFilters: RisonFilter[] = [
      { subject: 'region', operator: '==', comparator: 'North America' }, // No matching native filter
    ];

    const result = injectRisonFiltersIntelligently(
      risonFilters,
      mockNativeFilters,
      mockDataMask,
    );

    expect(result.unmatchedFilters).toHaveLength(1);
    expect(result.unmatchedFilters[0].subject).toBe('region');
  });

  it('should convert values correctly for different filter types', () => {
    const risonFilters: RisonFilter[] = [
      { subject: 'country', operator: '==', comparator: 'USA' },
      { subject: 'year', operator: 'BETWEEN', comparator: [2020, 2024] },
    ];

    const result = injectRisonFiltersIntelligently(
      risonFilters,
      mockNativeFilters,
      mockDataMask,
    );

    // Select filter should be array
    expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);

    // Range filter should be min/max object
    expect(result.updatedDataMask.filter_2.filterState?.value).toEqual({
      min: 2020,
      max: 2024,
    });

    expect(result.unmatchedFilters).toHaveLength(0);
  });

  it('should handle mixed matched and unmatched filters', () => {
    const risonFilters: RisonFilter[] = [
      { subject: 'country', operator: '==', comparator: 'USA' }, // Should match
      { subject: 'category', operator: '==', comparator: 'Sales' }, // No match
    ];

    const result = injectRisonFiltersIntelligently(
      risonFilters,
      mockNativeFilters,
      mockDataMask,
    );

    expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);
    expect(result.unmatchedFilters).toHaveLength(1);
    expect(result.unmatchedFilters[0].subject).toBe('category');
  });

  it('should parse Rison filters correctly', () => {
    const risonString = '(country:USA,year:2024)';
    const result = parseRisonFilters(risonString);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      subject: 'country',
      operator: '==',
      comparator: 'USA',
    });
    expect(result[1]).toEqual({
      subject: 'year',
      operator: '==',
      comparator: 2024,
    });
  });
});

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

import serializeFilterScopes from './serializeFilterScopes';

const mockDashboardFilters = {
  '1': {
    chartId: 'chart_1',
    scopes: {
      column1: {
        scope: ['ROOT_ID'],
        immune: [],
      },
      column2: {
        scope: ['ROOT_ID', 'TAB_1'],
        immune: ['chart_2'],
      },
    },
  },
  '2': {
    chartId: 'chart_2',
    scopes: {
      region: {
        scope: ['ROOT_ID'],
        immune: [],
      },
    },
  },
};

describe('serializeFilterScopes', () => {
  test('should serialize dashboard filter scopes correctly', () => {
    const result = serializeFilterScopes(mockDashboardFilters);

    expect(result).toEqual({
      chart_1: {
        column1: {
          scope: ['ROOT_ID'],
          immune: [],
        },
        column2: {
          scope: ['ROOT_ID', 'TAB_1'],
          immune: ['chart_2'],
        },
      },
      chart_2: {
        region: {
          scope: ['ROOT_ID'],
          immune: [],
        },
      },
    });
  });

  test('should handle empty dashboardFilters', () => {
    const result = serializeFilterScopes({});
    expect(result).toEqual({});
  });

  test('should handle filters with no scopes', () => {
    const filtersWithEmptyScopes = {
      '1': {
        chartId: 'chart_1',
        scopes: {},
      },
    };

    const result = serializeFilterScopes(filtersWithEmptyScopes);
    expect(result).toEqual({
      chart_1: {},
    });
  });

  test('should handle numeric chart IDs', () => {
    const filtersWithNumericIds = {
      '1': {
        chartId: 123,
        scopes: {
          column1: {
            scope: ['ROOT_ID'],
            immune: [],
          },
        },
      },
    };

    const result = serializeFilterScopes(filtersWithNumericIds);
    expect(result).toEqual({
      123: {
        column1: {
          scope: ['ROOT_ID'],
          immune: [],
        },
      },
    });
  });
});

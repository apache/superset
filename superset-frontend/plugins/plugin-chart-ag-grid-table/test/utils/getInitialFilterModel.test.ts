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
import getInitialFilterModel from '../../src/utils/getInitialFilterModel';
import type { AgGridChartState } from '@superset-ui/core';

describe('getInitialFilterModel', () => {
  describe('Priority: chartState > serverPaginationData', () => {
    test('should prioritize chartState.filterModel over serverPaginationData', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: {
          name: {
            filterType: 'text',
            type: 'equals',
            filter: 'from-chart-state',
          },
        },
      };

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'from-server' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(chartState.filterModel);
    });

    test('should use serverPaginationData when chartState.filterModel is unavailable', () => {
      const chartState: Partial<AgGridChartState> = {};

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'from-server' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });

    test('should use serverPaginationData when chartState is undefined', () => {
      const serverPaginationData = {
        agGridFilterModel: {
          status: { filterType: 'text', type: 'equals', filter: 'active' },
        },
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });
  });

  describe('Empty object handling', () => {
    test('should return undefined when chartState.filterModel is empty object', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: {},
      };

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'test' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      // Empty filterModel should be ignored, fall back to server
      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });

    test('should return undefined when serverPaginationData.agGridFilterModel is empty object', () => {
      const chartState: Partial<AgGridChartState> = {};

      const serverPaginationData = {
        agGridFilterModel: {},
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toBeUndefined();
    });

    test('should handle both being empty objects', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: {},
      };

      const serverPaginationData = {
        agGridFilterModel: {},
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Undefined/null handling', () => {
    test('should return undefined when all inputs are undefined', () => {
      const result = getInitialFilterModel(undefined, undefined, true);

      expect(result).toBeUndefined();
    });

    test('should return undefined when chartState and serverPaginationData are undefined', () => {
      const result = getInitialFilterModel(undefined, undefined, false);

      expect(result).toBeUndefined();
    });

    test('should return undefined when serverPagination is disabled', () => {
      const chartState: Partial<AgGridChartState> = {};

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'test' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        false,
      );

      expect(result).toBeUndefined();
    });

    test('should use chartState even when serverPagination is disabled', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: {
          name: {
            filterType: 'text',
            type: 'equals',
            filter: 'from-chart-state',
          },
        },
      };

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'from-server' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        false,
      );

      // chartState takes priority regardless of serverPagination flag
      expect(result).toEqual(chartState.filterModel);
    });
  });

  describe('Complex filter models', () => {
    test('should handle complex chartState filter model', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'John' },
          age: {
            filterType: 'number',
            operator: 'AND',
            condition1: {
              filterType: 'number',
              type: 'greaterThan',
              filter: 18,
            },
            condition2: { filterType: 'number', type: 'lessThan', filter: 65 },
          },
          status: { filterType: 'set', values: ['active', 'pending'] },
        },
      };

      const result = getInitialFilterModel(chartState, undefined, true);

      expect(result).toEqual(chartState.filterModel);
    });

    test('should handle complex serverPaginationData filter model', () => {
      const serverPaginationData = {
        agGridFilterModel: {
          category: { filterType: 'text', type: 'contains', filter: 'tech' },
          revenue: { filterType: 'number', type: 'greaterThan', filter: 1000 },
        },
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle permalink scenario with chartState', () => {
      // User shares a permalink with saved filter state
      const chartState: Partial<AgGridChartState> = {
        filterModel: {
          state: { filterType: 'set', values: ['CA', 'NY', 'TX'] },
          revenue: { filterType: 'number', type: 'greaterThan', filter: 50000 },
        },
        columnState: [],
      };

      const result = getInitialFilterModel(chartState, undefined, true);

      expect(result).toEqual(chartState.filterModel);
      expect(result?.state).toBeDefined();
      expect(result?.revenue).toBeDefined();
    });

    test('should handle fresh page load with server state', () => {
      // Fresh page load - no chartState, but has serverPaginationData from ownState
      const serverPaginationData = {
        agGridFilterModel: {
          created_date: {
            filterType: 'date',
            type: 'greaterThan',
            filter: '2024-01-01',
          },
        },
        currentPage: 0,
        pageSize: 50,
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });

    test('should handle chart without any filters applied', () => {
      // No filters applied anywhere
      const chartState: Partial<AgGridChartState> = {
        columnState: [],
      };

      const serverPaginationData = {
        currentPage: 0,
        pageSize: 20,
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toBeUndefined();
    });

    test('should handle transition from no filters to filters via permalink', () => {
      // User applies filters, creates permalink, then loads it
      const chartState: Partial<AgGridChartState> = {
        filterModel: {
          name: { filterType: 'text', type: 'startsWith', filter: 'Admin' },
        },
      };

      const serverPaginationData = {
        agGridFilterModel: undefined, // No server state yet
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(chartState.filterModel);
    });
  });

  describe('Edge cases', () => {
    test('should handle null values in serverPaginationData', () => {
      const serverPaginationData = {
        agGridFilterModel: null as any,
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData,
        true,
      );

      expect(result).toBeUndefined();
    });

    test('should handle serverPaginationData without agGridFilterModel key', () => {
      const serverPaginationData = {
        currentPage: 0,
        pageSize: 20,
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData as any,
        true,
      );

      expect(result).toBeUndefined();
    });

    test('should handle chartState with null filterModel', () => {
      const chartState: Partial<AgGridChartState> = {
        filterModel: null as any,
      };

      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'test' },
        },
      };

      const result = getInitialFilterModel(
        chartState,
        serverPaginationData,
        true,
      );

      expect(result).toEqual(serverPaginationData.agGridFilterModel);
    });

    test('should handle serverPagination undefined (defaults to false)', () => {
      const serverPaginationData = {
        agGridFilterModel: {
          name: { filterType: 'text', type: 'equals', filter: 'test' },
        },
      };

      const result = getInitialFilterModel(
        undefined,
        serverPaginationData,
        undefined,
      );

      expect(result).toBeUndefined();
    });

    test('should preserve filter model structure without modification', () => {
      const originalFilterModel = {
        complexFilter: {
          filterType: 'number',
          operator: 'OR' as const,
          condition1: { filterType: 'number', type: 'equals', filter: 100 },
          condition2: { filterType: 'number', type: 'equals', filter: 200 },
        },
      };

      const chartState: Partial<AgGridChartState> = {
        filterModel: originalFilterModel,
      };

      const result = getInitialFilterModel(chartState, undefined, true);

      // Should return exact same reference, not a copy
      expect(result).toBe(originalFilterModel);
    });
  });
});

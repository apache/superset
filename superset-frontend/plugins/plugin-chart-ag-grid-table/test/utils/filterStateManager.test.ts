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
import { getCompleteFilterState } from '../../src/utils/filterStateManager';
import type { RefObject } from 'react';
import type { AgGridReact } from '@superset-ui/core/components/ThemedAgGridReact';
import { FILTER_INPUT_POSITIONS } from '../../src/consts';

describe('filterStateManager', () => {
  describe('getCompleteFilterState', () => {
    test('should return empty state when gridRef.current is null', async () => {
      const gridRef = { current: null } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result).toEqual({
        originalFilterModel: {},
        simpleFilters: [],
        complexWhere: undefined,
        havingClause: undefined,
        lastFilteredColumn: undefined,
        inputPosition: FILTER_INPUT_POSITIONS.UNKNOWN,
      });
    });

    test('should return empty state when gridRef.current.api is undefined', async () => {
      const gridRef = {
        current: { api: undefined } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result).toEqual({
        originalFilterModel: {},
        simpleFilters: [],
        complexWhere: undefined,
        havingClause: undefined,
        lastFilteredColumn: undefined,
        inputPosition: FILTER_INPUT_POSITIONS.UNKNOWN,
      });
    });

    test('should convert simple filters correctly', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'John' },
        age: { filterType: 'number', type: 'greaterThan', filter: 25 },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.originalFilterModel).toEqual(filterModel);
      expect(result.simpleFilters).toHaveLength(2);
      expect(result.simpleFilters[0]).toEqual({
        col: 'name',
        op: '=',
        val: 'John',
      });
      expect(result.simpleFilters[1]).toEqual({
        col: 'age',
        op: '>',
        val: 25,
      });
    });

    test('should separate dimension and metric filters', async () => {
      const filterModel = {
        state: { filterType: 'text', type: 'equals', filter: 'CA' },
        'SUM(revenue)': {
          filterType: 'number',
          type: 'greaterThan',
          filter: 1000,
        },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, ['SUM(revenue)']);

      // Dimension filter goes to simpleFilters
      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0].col).toBe('state');

      // Metric filter goes to havingClause
      expect(result.havingClause).toBe('SUM(revenue) > 1000');
    });

    test('should detect first input position when active element is in first condition body', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockInput = document.createElement('input');
      const mockConditionBody1 = document.createElement('div');
      mockConditionBody1.appendChild(mockInput);

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [mockConditionBody1],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('name');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.FIRST);
    });

    test('should detect second input position when active element is in second condition body', async () => {
      const filterModel = {
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: { filterType: 'number', type: 'greaterThan', filter: 18 },
          condition2: { filterType: 'number', type: 'lessThan', filter: 65 },
        },
      };

      const mockInput = document.createElement('input');
      const mockConditionBody1 = document.createElement('div');
      const mockConditionBody2 = document.createElement('div');
      mockConditionBody2.appendChild(mockInput);

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [mockConditionBody1, mockConditionBody2],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('age');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.SECOND);
    });

    test('should return unknown position when active element is not in any condition body', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockConditionBody = document.createElement('div');
      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [mockConditionBody],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement as something outside the filter
      const outsideElement = document.createElement('div');
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: outsideElement,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.UNKNOWN);
      expect(result.lastFilteredColumn).toBeUndefined();
    });

    test('should handle multiple filtered columns and detect the correct one', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'John' },
        age: { filterType: 'number', type: 'greaterThan', filter: 25 },
        status: { filterType: 'text', type: 'equals', filter: 'active' },
      };

      const mockInput = document.createElement('input');
      const mockConditionBodyAge = document.createElement('div');
      mockConditionBodyAge.appendChild(mockInput);

      const mockFilterInstanceName = {
        eGui: document.createElement('div'),
        eConditionBodies: [document.createElement('div')],
      };

      const mockFilterInstanceAge = {
        eGui: document.createElement('div'),
        eConditionBodies: [mockConditionBodyAge],
      };

      const mockFilterInstanceStatus = {
        eGui: document.createElement('div'),
        eConditionBodies: [document.createElement('div')],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn((colId: string) => {
          if (colId === 'name') return Promise.resolve(mockFilterInstanceName);
          if (colId === 'age') return Promise.resolve(mockFilterInstanceAge);
          if (colId === 'status')
            return Promise.resolve(mockFilterInstanceStatus);
          return Promise.resolve(null);
        }),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement in age filter
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('age');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.FIRST);
    });

    test('should handle filter instance without eConditionBodies', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        // No eConditionBodies property
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.UNKNOWN);
      expect(result.lastFilteredColumn).toBeUndefined();
    });

    test('should handle empty filter model', async () => {
      const filterModel = {};

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.originalFilterModel).toEqual({});
      expect(result.simpleFilters).toEqual([]);
      expect(result.complexWhere).toBeUndefined();
      expect(result.havingClause).toBeUndefined();
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.UNKNOWN);
    });

    test('should handle compound filters correctly', async () => {
      const filterModel = {
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: {
            filterType: 'number',
            type: 'greaterThanOrEqual',
            filter: 18,
          },
          condition2: { filterType: 'number', type: 'lessThan', filter: 65 },
        },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.complexWhere).toBe('(age >= 18 AND age < 65)');
    });

    test('should handle set filters correctly', async () => {
      const filterModel = {
        status: {
          filterType: 'set',
          values: ['active', 'pending', 'approved'],
        },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0]).toEqual({
        col: 'status',
        op: 'IN',
        val: ['active', 'pending', 'approved'],
      });
    });

    test('should break detection loop after finding active element', async () => {
      const filterModel = {
        col1: { filterType: 'text', type: 'equals', filter: 'a' },
        col2: { filterType: 'text', type: 'equals', filter: 'b' },
        col3: { filterType: 'text', type: 'equals', filter: 'c' },
      };

      const mockInput = document.createElement('input');
      const mockConditionBody = document.createElement('div');
      mockConditionBody.appendChild(mockInput);

      let callCount = 0;
      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn((colId: string) => {
          callCount += 1;
          // Return match on col2
          if (colId === 'col2') {
            return Promise.resolve({
              eGui: document.createElement('div'),
              eConditionBodies: [mockConditionBody],
            });
          }
          return Promise.resolve({
            eGui: document.createElement('div'),
            eConditionBodies: [document.createElement('div')],
          });
        }),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('col2');
      // Should not call getColumnFilterInstance for col3 after finding match
      expect(callCount).toBeLessThanOrEqual(2);
    });

    test('should handle null filter instance gracefully', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.UNKNOWN);
      expect(result.originalFilterModel).toEqual(filterModel);
    });

    test('should maintain filter model reference integrity', async () => {
      const originalFilterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockApi = {
        getFilterModel: jest.fn(() => originalFilterModel),
        getColumnFilterInstance: jest.fn(() => Promise.resolve(null)),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      const result = await getCompleteFilterState(gridRef, []);

      // Should return the same reference
      expect(result.originalFilterModel).toBe(originalFilterModel);
    });

    test('should detect active element in eJoinAnds array', async () => {
      const filterModel = {
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: { filterType: 'number', type: 'greaterThan', filter: 18 },
          condition2: { filterType: 'number', type: 'lessThan', filter: 65 },
        },
      };

      const mockInput = document.createElement('input');
      const mockJoinAndGui = document.createElement('div');
      mockJoinAndGui.appendChild(mockInput);

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [
          document.createElement('div'),
          document.createElement('div'),
        ],
        eJoinAnds: [{ eGui: mockJoinAndGui }],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement in join AND operator
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('age');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.FIRST);
    });

    test('should detect active element in eJoinOrs array', async () => {
      const filterModel = {
        status: {
          filterType: 'text',
          operator: 'OR',
          condition1: { filterType: 'text', type: 'equals', filter: 'active' },
          condition2: { filterType: 'text', type: 'equals', filter: 'pending' },
        },
      };

      const mockInput = document.createElement('input');
      const mockJoinOrGui = document.createElement('div');
      mockJoinOrGui.appendChild(mockInput);

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [
          document.createElement('div'),
          document.createElement('div'),
        ],
        eJoinOrs: [{ eGui: mockJoinOrGui }],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      // Mock activeElement in join OR operator
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('status');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.FIRST);
    });

    test('should check condition bodies before join operators', async () => {
      const filterModel = {
        name: { filterType: 'text', type: 'equals', filter: 'test' },
      };

      const mockInput = document.createElement('input');
      const mockConditionBody2 = document.createElement('div');
      mockConditionBody2.appendChild(mockInput);

      const mockJoinAndGui = document.createElement('div');
      // Input is NOT in join operator, only in condition body

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [document.createElement('div'), mockConditionBody2],
        eJoinAnds: [{ eGui: mockJoinAndGui }],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('name');
      // Should detect SECOND input position, not from join operator
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.SECOND);
    });

    test('should handle multiple eJoinAnds elements', async () => {
      const filterModel = {
        score: { filterType: 'number', type: 'greaterThan', filter: 90 },
      };

      const mockInput = document.createElement('input');
      const mockJoinAndGui2 = document.createElement('div');
      mockJoinAndGui2.appendChild(mockInput);

      const mockFilterInstance = {
        eGui: document.createElement('div'),
        eConditionBodies: [document.createElement('div')],
        eJoinAnds: [
          { eGui: document.createElement('div') },
          { eGui: mockJoinAndGui2 },
          { eGui: document.createElement('div') },
        ],
      };

      const mockApi = {
        getFilterModel: jest.fn(() => filterModel),
        getColumnFilterInstance: jest.fn(() =>
          Promise.resolve(mockFilterInstance),
        ),
      };

      const gridRef = {
        current: { api: mockApi } as any,
      } as RefObject<AgGridReact>;

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: mockInput,
      });

      const result = await getCompleteFilterState(gridRef, []);

      expect(result.lastFilteredColumn).toBe('score');
      expect(result.inputPosition).toBe(FILTER_INPUT_POSITIONS.FIRST);
    });
  });
});

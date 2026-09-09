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
import {
  convertFilterModel,
  convertAgGridStateToOwnState,
} from '../src/stateConversion';

const baseAgGridState = {
  columnState: [],
  sortModel: [{ colId: 'name', sort: 'asc' as const, sortIndex: 0 }],
  filterModel: {},
};

describe('convertFilterModel', () => {
  test('emits a clause for a valid numeric comparison filter', () => {
    const result = convertFilterModel({
      revenue: { filterType: 'number', type: 'greaterThan', filter: 100 },
    } as any);

    expect(result?.sqlClauses?.revenue).toBe('revenue > 100');
  });

  test('drops a number filter whose value is not numeric', () => {
    const result = convertFilterModel({
      revenue: { filterType: 'number', type: 'equals', filter: '1 OR 1=1' },
    } as any);

    expect(result).toBeUndefined();
  });

  test('joins conditions with a valid boolean operator', () => {
    const result = convertFilterModel({
      revenue: {
        filterType: 'number',
        operator: 'AND',
        condition1: { filterType: 'number', type: 'greaterThan', filter: 1 },
        condition2: { filterType: 'number', type: 'lessThan', filter: 9 },
      },
    } as any);

    expect(result?.sqlClauses?.revenue).toBe('(revenue > 1 AND revenue < 9)');
  });

  test('drops a compound filter whose join operator is not AND/OR', () => {
    const result = convertFilterModel({
      revenue: {
        filterType: 'number',
        operator: 'AND 1=1) OR (1=1',
        condition1: { filterType: 'number', type: 'greaterThan', filter: 1 },
        condition2: { filterType: 'number', type: 'lessThan', filter: 9 },
      },
    } as any);

    expect(result).toBeUndefined();
  });

  test('stores clauses on a null-prototype map (prototype-safe column ids)', () => {
    const result = convertFilterModel({
      constructor: { filterType: 'number', type: 'equals', filter: 5 },
    } as any);

    // The map has no prototype, so a column id like "constructor" is just data.
    expect(Object.getPrototypeOf(result?.sqlClauses)).toBeNull();
    expect(result?.sqlClauses?.constructor).toBe('constructor = 5');
  });
});

describe('convertAgGridStateToOwnState', () => {
  test('suppresses client-mode state for the live query (serverPagination: false)', () => {
    const result = convertAgGridStateToOwnState({
      ...baseAgGridState,
      serverPagination: false,
    });

    expect(result).toEqual({});
  });

  test('converts client-mode state anyway when forExport is set, so a download reproduces the displayed sort/filter', () => {
    const result = convertAgGridStateToOwnState(
      { ...baseAgGridState, serverPagination: false },
      { forExport: true },
    );

    expect(result.sortBy).toEqual([{ id: 'name', key: 'name', desc: false }]);
  });

  test('converts state when serverPagination is undefined, preserving legacy persisted table_state/permalinks saved before this field existed', () => {
    const result = convertAgGridStateToOwnState(baseAgGridState);

    expect(result.sortBy).toEqual([{ id: 'name', key: 'name', desc: false }]);
  });

  test('converts state for the live query when serverPagination is true', () => {
    const result = convertAgGridStateToOwnState({
      ...baseAgGridState,
      serverPagination: true,
    });

    expect(result.sortBy).toEqual([{ id: 'name', key: 'name', desc: false }]);
  });
});

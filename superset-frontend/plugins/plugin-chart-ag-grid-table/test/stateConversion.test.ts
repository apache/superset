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
import type { AgGridChartState } from '@superset-ui/core';
import { convertAgGridStateToOwnState } from '../src/stateConversion';

const baseAgGridState = {
  columnState: [],
  sortModel: [{ colId: 'name', sort: 'asc' as const, sortIndex: 0 }],
  filterModel: {},
};

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

  test('forwards a non-empty filter model as agGridFilterModel so the download path can build structured filters', () => {
    const filterModel = {
      'Destination Address Street': {
        filterType: 'text',
        type: 'contains',
        filter: 'Main',
      },
    };

    const result = convertAgGridStateToOwnState({
      ...baseAgGridState,
      filterModel,
    } as unknown as AgGridChartState);

    expect(result.agGridFilterModel).toEqual(filterModel);
  });
});

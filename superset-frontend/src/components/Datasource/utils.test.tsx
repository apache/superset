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

import { tn } from '@superset-ui/core';
import { updateColumns } from './utils';

describe('updateColumns', () => {
  let addSuccessToast: jest.Mock;

  beforeEach(() => {
    addSuccessToast = jest.fn();
  });

  it('adds new columns when prevCols is empty', () => {
    interface Column {
      column_name: string;
      type: string;
      is_dttm: boolean;
    }

    const prevCols: Column[] = [];
    const newCols = [
      { column_name: 'col1', type: 'string', is_dttm: false },
      { column_name: 'col2', type: 'number', is_dttm: true },
    ];
    const result = updateColumns(prevCols, newCols, addSuccessToast);
    expect(result.added.sort()).toEqual(['col1', 'col2'].sort());
    expect(result.modified).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.finalColumns).toHaveLength(2);
    // Only the added toast should be fired
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addSuccessToast).toHaveBeenCalledWith(
      tn(
        'Added 1 new column to the virtual dataset',
        'Added %s new columns to the virtual dataset',
        2,
        2,
      ),
    );
  });

  it('modifies columns when type or is_dttm changes', () => {
    const prevCols = [
      { column_name: 'col1', type: 'string', is_dttm: false },
      { column_name: 'col2', type: 'number', is_dttm: false },
    ];
    const newCols = [
      // col1 unchanged
      { column_name: 'col1', type: 'string', is_dttm: false },
      // col2 modified (type changed)
      { column_name: 'col2', type: 'float', is_dttm: false },
    ];
    const result = updateColumns(prevCols, newCols, addSuccessToast);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual(['col2']);
    // No columns removed
    expect(result.removed).toEqual([]);
    // Final columns: first is unchanged, second is updated
    expect(result.finalColumns).toHaveLength(2);
    const updatedCol2 = (
      result.finalColumns as {
        column_name: string;
        type: string;
        is_dttm: boolean;
      }[]
    ).find(c => c.column_name === 'col2');
    expect(updatedCol2?.type).toBe('float');
    // Modified toast should be fired
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addSuccessToast).toHaveBeenCalledWith(
      tn(
        'Modified 1 column in the virtual dataset',
        'Modified %s columns in the virtual dataset',
        1,
        1,
      ),
    );
  });

  it('removes columns not present in newCols', () => {
    const prevCols = [
      { column_name: 'col1', type: 'string', is_dttm: false },
      { column_name: 'col2', type: 'number', is_dttm: true },
    ];
    const newCols = [
      // Only col2 is present
      { column_name: 'col2', type: 'number', is_dttm: true },
    ];
    const result = updateColumns(prevCols, newCols, addSuccessToast);
    // col1 should be marked as removed
    expect(result.removed).toEqual(['col1']);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.finalColumns).toHaveLength(1);
    // Removed toast should be fired
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addSuccessToast).toHaveBeenCalledWith(
      tn(
        'Removed 1 column from the virtual dataset',
        'Removed %s columns from the virtual dataset',
        1,
        1,
      ),
    );
  });

  it('handles combined additions, modifications, and removals', () => {
    const prevCols = [
      { column_name: 'col1', type: 'string', is_dttm: false },
      { column_name: 'col2', type: 'number', is_dttm: false },
      { column_name: 'col3', type: 'number', is_dttm: false },
    ];
    const newCols = [
      // col1 modified
      { column_name: 'col1', type: 'string', is_dttm: true },
      // col2 unchanged
      { column_name: 'col2', type: 'number', is_dttm: false },
      // col4 is a new column
      { column_name: 'col4', type: 'boolean', is_dttm: false },
    ];
    const result = updateColumns(prevCols, newCols, addSuccessToast);
    expect(result.added).toEqual(['col4']);
    expect(result.modified).toEqual(['col1']);
    // col3 is removed since it is missing in newCols and has no expression
    expect(result.removed).toEqual(['col3']);
    expect(result.finalColumns).toHaveLength(3);
    // Three types of changes should fire three separate toasts
    expect(addSuccessToast).toHaveBeenCalledTimes(3);
    expect(addSuccessToast.mock.calls).toEqual([
      [
        tn(
          'Modified 1 column in the virtual dataset',
          'Modified %s columns in the virtual dataset',
          1,
          1,
        ),
      ],
      [
        tn(
          'Removed 1 column from the virtual dataset',
          'Removed %s columns from the virtual dataset',
          1,
          1,
        ),
      ],
      [
        tn(
          'Added 1 new column to the virtual dataset',
          'Added %s new columns to the virtual dataset',
          1,
          1,
        ),
      ],
    ]);
  });
  it('should not remove columns with expressions', () => {
    const prevCols = [
      { column_name: 'col1', type: 'string', is_dttm: false },
      { column_name: 'col2', type: 'number', is_dttm: false },
      {
        column_name: 'col3',
        type: 'number',
        is_dttm: false,
        expression: 'expr',
      },
    ];
    const newCols = [
      // col1 modified
      { column_name: 'col1', type: 'string', is_dttm: true },
      // col2 unchanged
      { column_name: 'col2', type: 'number', is_dttm: false },
    ];
    const result = updateColumns(prevCols, newCols, addSuccessToast);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual(['col1']);
    // col3 is not removed since it has an expression
    expect(result.removed).toEqual([]);
    expect(result.finalColumns).toHaveLength(3);
    // Two types of changes should fire two separate toasts
    expect(addSuccessToast).toHaveBeenCalledTimes(1);
    expect(addSuccessToast.mock.calls).toEqual([
      [
        tn(
          'Modified 1 column in the virtual dataset',
          'Modified %s columns in the virtual dataset',
          1,
          1,
        ),
      ],
    ]);
  });
});

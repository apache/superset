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
import { sortNumberWithMixedTypes } from './sortUtils';

describe('sortNumberWithMixedTypes Regression Tests', () => {
  const columnId = '2020-01-01.metric'; // Complex ID with dots

  const createMockRow = (value: any, useOriginal = false, colType?: string) => {
    const props = {
      valueField: 'metric',
      column: {
        key: columnId,
        colType,
      },
      reversedEntries: [{ metric: value }],
    };

    if (useOriginal) {
      return {
        original: {
          [columnId]: { props },
        },
        values: {}, // Accessing this via dot notation would fail in react-table
      };
    }

    return {
      values: {
        [columnId]: { props },
      },
    };
  };

  test('should resolve cell from row.original when row.values lookup fails (dot notation)', () => {
    const rowA = createMockRow(10, true, 'time');
    const rowB = createMockRow(20, true, 'time');

    const result = sortNumberWithMixedTypes(rowA, rowB, columnId);
    expect(result).toBeLessThan(0);
  });

  test('should fallback to localeCompare for purely string values', () => {
    const rowA = createMockRow('Apple', true);
    const rowB = createMockRow('Banana', true);

    const result = sortNumberWithMixedTypes(rowA, rowB, columnId);
    expect(result).toBeLessThan(0); // 'Apple' < 'Banana'
  });

  test('should correctly sort strings with mixed numbers', () => {
    const rowA = createMockRow('10', true);
    const rowB = createMockRow('2', true);

    const result = sortNumberWithMixedTypes(rowA, rowB, columnId);
    expect(result).toBeGreaterThan(0); // 10 > 2 numerically even without colType: 'time'
  });

  test('should handle null and undefined values consistently', () => {
    const rowNull = createMockRow(null, true);
    const rowUndefined = createMockRow(undefined, true);
    const rowValue = createMockRow(10, true);

    expect(sortNumberWithMixedTypes(rowNull, rowValue, columnId)).toBeLessThan(
      0,
    );
    expect(
      sortNumberWithMixedTypes(rowValue, rowNull, columnId),
    ).toBeGreaterThan(0);
    expect(sortNumberWithMixedTypes(rowNull, rowUndefined, columnId)).toBe(0);
  });

  test('should handle zero correctly', () => {
    const rowZero = createMockRow(0, true, 'time');
    const rowPos = createMockRow(1, true, 'time');
    const rowNeg = createMockRow(-1, true, 'time');

    expect(sortNumberWithMixedTypes(rowZero, rowPos, columnId)).toBeLessThan(0);
    expect(sortNumberWithMixedTypes(rowZero, rowNeg, columnId)).toBeGreaterThan(
      0,
    );
  });
});

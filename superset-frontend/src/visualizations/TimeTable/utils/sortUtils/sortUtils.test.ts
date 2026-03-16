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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('sortNumberWithMixedTypes', () => {
  const createMockRow = (value: any) => ({
    values: {
      testColumn: {
        props: {
          valueField: 'metric',
          column: {
            key: 'testColumn',
            colType: 'time',
            bounds: undefined,
          },
          reversedEntries: [{ metric: value }],
        },
      },
    },
  });

  test('should sort numbers in ascending order', () => {
    const rowA = createMockRow(10);
    const rowB = createMockRow(20);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(result).toBeLessThan(0); // rowA should come before rowB
  });

  test('should sort numbers in descending order', () => {
    const rowA = createMockRow(10);
    const rowB = createMockRow(20);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(result).toBeLessThan(0);
  });

  test('should handle equal values', () => {
    const rowA = createMockRow(15);
    const rowB = createMockRow(15);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(result).toBe(0);
  });

  test('should handle null values', () => {
    const rowA = createMockRow(null);
    const rowB = createMockRow(10);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');
    expect(typeof result).toBe('number');
  });

  test('should handle string numbers', () => {
    const rowA = createMockRow('10');
    const rowB = createMockRow('20');

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(typeof result).toBe('number');
    expect(result).toBe(0);
  });

  test('should handle mixed types', () => {
    const rowA = createMockRow(10);
    const rowB = createMockRow('20');

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(typeof result).toBe('number');
  });

  test('should handle negative numbers', () => {
    const rowA = createMockRow(-10);
    const rowB = createMockRow(5);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(result).toBeLessThan(0);
  });

  test('should handle zero values', () => {
    const rowA = createMockRow(0);
    const rowB = createMockRow(10);

    const result = sortNumberWithMixedTypes(rowA, rowB, 'testColumn');

    expect(result).toBeLessThan(0);
  });

  test('should sort ValueCell-like props numerically', () => {
    const createValueCellRow = (metricValue: number | null) => ({
      values: {
        testColumn: {
          props: {
            valueField: 'metric',
            column: {
              key: 'testColumn',
              colType: 'time',
              bounds: undefined,
            },
            reversedEntries: [{ metric: metricValue }],
          },
        },
      },
    });

    const smaller = createValueCellRow(1);
    const larger = createValueCellRow(5);

    const result = sortNumberWithMixedTypes(smaller, larger, 'testColumn');

    expect(result).toBeLessThan(0);
  });
});

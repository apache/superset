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
  calculateTimeValue,
  calculateContribution,
  calculateAverage,
  calculateCellValue,
} from './valueCalculations';
import type { ColumnConfig, Entry } from '../../types';

describe('valueCalculations', () => {
  const mockEntries: Entry[] = [
    { time: '2023-01-03', sales: 300, price: 30 },
    { time: '2023-01-02', sales: 200, price: 20 },
    { time: '2023-01-01', sales: 100, price: 10 },
  ];

  describe('calculateTimeValue', () => {
    test('should calculate diff comparison correctly', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        comparisonType: 'diff',
        timeLag: 1,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBe(100);
      expect(result.errorMsg).toBeUndefined();
    });

    test('should calculate perc comparison correctly', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        comparisonType: 'perc',
        timeLag: 1,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBe(1.5); // 300 / 200
    });

    test('should calculate perc_change comparison correctly', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        comparisonType: 'perc_change',
        timeLag: 1,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBe(0.5); // (300 / 200) - 1
    });

    test('should handle negative time lag', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        comparisonType: 'diff',
        timeLag: -1,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBe(200); // 300 - 100 (from end of array)
    });

    test('should return error for excessive time lag', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        timeLag: 10,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBeNull();
      expect(result.errorMsg).toContain('too large for the length of data');
    });

    test('should return null for invalid values', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        timeLag: 1,
      };

      const result = calculateTimeValue(null, 'sales', mockEntries, column);

      expect(result.value).toBeNull();
      expect(result.errorMsg).toBeUndefined();
    });

    test('should return lagged value when no comparison type', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        timeLag: 1,
      };

      const result = calculateTimeValue(300, 'sales', mockEntries, column);

      expect(result.value).toBe(200); // lagged value without comparison
    });
  });

  describe('calculateContribution', () => {
    test('should calculate contribution correctly', () => {
      const result = calculateContribution(300, mockEntries);

      expect(result.value).toBeCloseTo(0.909, 3);
      expect(result.errorMsg).toBeUndefined();
    });

    test('should return null for null recent value', () => {
      const result = calculateContribution(null, mockEntries);
      expect(result.value).toBeNull();
    });

    test('should return null for empty entries', () => {
      const result = calculateContribution(300, []);
      expect(result.value).toBeNull();
    });

    test('should return null when total is zero', () => {
      const zeroEntries: Entry[] = [{ time: '2023-01-01', sales: 0 }];

      const result = calculateContribution(100, zeroEntries);

      expect(result.value).toBeNull();
    });
  });

  describe('calculateAverage', () => {
    test('should calculate average correctly', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'avg',
        timeLag: 2,
      };

      const result = calculateAverage('sales', mockEntries, column);

      expect(result.value).toBe(250);
      expect(result.errorMsg).toBeUndefined();
    });

    test('should handle null/undefined values', () => {
      const entriesWithNulls: Entry[] = [
        { time: '2023-01-03', sales: 300 },
        { time: '2023-01-02', sales: null },
        { time: '2023-01-01', sales: 100 },
      ];

      const column: ColumnConfig = {
        key: 'test',
        colType: 'avg',
        timeLag: 3,
      };

      const result = calculateAverage('sales', entriesWithNulls, column);

      expect(result.value).toBe(200);
    });

    test('should return null for empty entries', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'avg',
      };

      const result = calculateAverage('sales', [], column);

      expect(result.value).toBeNull();
    });

    test('should return null when all values are null', () => {
      const entriesWithAllNulls: Entry[] = [
        { time: '2023-01-03', sales: null },
        { time: '2023-01-02', sales: undefined },
      ];

      const column: ColumnConfig = {
        key: 'test',
        colType: 'avg',
        timeLag: 2,
      };

      const result = calculateAverage('sales', entriesWithAllNulls, column);

      expect(result.value).toBeNull();
    });
  });

  describe('calculateCellValue', () => {
    test('should route to time calculation', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
        comparisonType: 'diff',
        timeLag: 1,
      };

      const result = calculateCellValue('sales', column, mockEntries);

      expect(result.value).toBe(100); // 300 - 200
    });

    test('should route to contribution calculation', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'contrib',
      };

      const result = calculateCellValue('sales', column, mockEntries);

      expect(result.value).toBeCloseTo(0.909, 3);
    });

    test('should route to average calculation', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'avg',
        timeLag: 2,
      };

      const result = calculateCellValue('sales', column, mockEntries);

      expect(result.value).toBe(250);
    });

    test('should return recent value for default case', () => {
      const column: ColumnConfig = {
        key: 'test',
      };

      const result = calculateCellValue('sales', column, mockEntries);

      expect(result.value).toBe(300); // Recent value
    });

    test('should return null for empty entries', () => {
      const column: ColumnConfig = {
        key: 'test',
        colType: 'time',
      };

      const result = calculateCellValue('sales', column, []);

      expect(result.value).toBeNull();
    });
  });
});

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
import { processTimeTableData } from './rowProcessing';

const mockData = {
  '2023-01-01': { sales: 100 },
  '2023-01-02': { sales: 200 },
  '2023-01-03': { sales: 300 },
};

describe('processTimeTableData', () => {
  test('should convert data to sorted entries', () => {
    const result = processTimeTableData(mockData);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toEqual({ time: '2023-01-01', sales: 100 });
    expect(result.entries[1]).toEqual({ time: '2023-01-02', sales: 200 });
    expect(result.entries[2]).toEqual({ time: '2023-01-03', sales: 300 });
  });

  test('should create reversed entries', () => {
    const result = processTimeTableData(mockData);

    expect(result.reversedEntries).toHaveLength(3);
    expect(result.reversedEntries[0]).toEqual({
      time: '2023-01-03',
      sales: 300,
    });
    expect(result.reversedEntries[1]).toEqual({
      time: '2023-01-02',
      sales: 200,
    });
    expect(result.reversedEntries[2]).toEqual({
      time: '2023-01-01',
      sales: 100,
    });
  });

  test('should sort data entries by time regardless of input order', () => {
    const unsortedData = {
      '2023-01-03': { sales: 300 },
      '2023-01-01': { sales: 100 },
      '2023-01-02': { sales: 200 },
    };

    const result = processTimeTableData(unsortedData);

    expect(result.entries[0].time).toBe('2023-01-01');
    expect(result.entries[1].time).toBe('2023-01-02');
    expect(result.entries[2].time).toBe('2023-01-03');
  });

  test('should handle empty data', () => {
    const result = processTimeTableData({});

    expect(result.entries).toHaveLength(0);
    expect(result.reversedEntries).toHaveLength(0);
  });

  test('should preserve all data fields', () => {
    const complexData = {
      '2023-01-01': { sales: 100, profit: 50, customers: 25 },
      '2023-01-02': { sales: 200, profit: 75, customers: 30 },
    };

    const result = processTimeTableData(complexData);

    expect(result.entries[0]).toEqual({
      time: '2023-01-01',
      sales: 100,
      profit: 50,
      customers: 25,
    });
    expect(result.entries[1]).toEqual({
      time: '2023-01-02',
      sales: 200,
      profit: 75,
      customers: 30,
    });
  });

  test('should handle single entry', () => {
    const singleData = {
      '2023-01-01': { sales: 100 },
    };

    const result = processTimeTableData(singleData);

    expect(result.entries).toHaveLength(1);
    expect(result.reversedEntries).toHaveLength(1);
    expect(result.entries[0]).toEqual(result.reversedEntries[0]);
  });
});

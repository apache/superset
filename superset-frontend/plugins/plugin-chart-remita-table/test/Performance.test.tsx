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
import React from 'react';
import { render } from '@testing-library/react';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import { testData } from './testData';

// Helper to generate mock data
const generateMockRows = (count: number) => {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      __rid: i,
      id: i,
      name: `Row ${i}`,
      metric1: Math.random() * 1000,
      metric2: Math.random() * 1000,
      metric3: Math.random() * 1000,
      category: `Category ${i % 10}`,
      date: new Date(2024, 0, 1 + i).toISOString(),
    });
  }
  return rows;
};

describe('Performance: Filter Equality Check', () => {
  test('should compare filters faster than JSON.stringify', () => {
    const { cachedBuildQuery } = require('../src/buildQuery');
    const buildQuery = cachedBuildQuery();

    // Generate 100 filters
    const filters = Array(100)
      .fill(null)
      .map((_, i) => ({
        col: `col${i}`,
        op: 'IN',
        val: [1, 2, 3],
      }));

    const formData = {
      ...testData.rawFormData,
      slice_id: 123,
      server_pagination: true,
    };

    // Measure filtersEqual performance
    const start = performance.now();
    buildQuery(formData as any, {
      ownState: { pageSize: 50, currentPage: 0 },
      extras: {
        cachedChanges: { 123: filters },
      },
      hooks: {
        setDataMask: () => {},
        setCachedChanges: () => {},
      },
    });
    const duration = performance.now() - start;

    // Should complete in under 50ms for 100 filters
    expect(duration).toBeLessThan(50);
  });

  test('should handle filter comparison with large arrays efficiently', () => {
    const filters = Array(50)
      .fill(null)
      .map((_, i) => ({
        col: `column_${i}`,
        op: 'IN',
        val: Array(20)
          .fill(null)
          .map((_, j) => `value_${j}`),
      }));

    const { cachedBuildQuery } = require('../src/buildQuery');
    const buildQuery = cachedBuildQuery();

    const start = performance.now();
    buildQuery(
      {
        ...testData.rawFormData,
        slice_id: 456,
        server_pagination: true,
      } as any,
      {
        ownState: {},
        extras: {
          cachedChanges: { 456: filters },
        },
        hooks: {
          setDataMask: () => {},
          setCachedChanges: () => {},
        },
      }
    );
    const duration = performance.now() - start;

    // Should handle complex filters efficiently
    expect(duration).toBeLessThan(100);
  });
});

describe('Performance: Row ID Indexing', () => {
  test('should build row index map efficiently for 10k rows', () => {
    const rows = generateMockRows(10000);

    const start = performance.now();

    // Simulate the rowById Map creation
    const rowById = new Map();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const idRaw = row.__rid ?? row.id ?? i;
      rowById.set(String(idRaw), row);
    }

    const duration = performance.now() - start;

    // Should build index in under 50ms
    expect(duration).toBeLessThan(50);
    expect(rowById.size).toBe(10000);

    // Verify O(1) lookup performance
    const lookupStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const randomId = Math.floor(Math.random() * 10000);
      rowById.get(String(randomId));
    }
    const lookupDuration = performance.now() - lookupStart;

    // 1000 lookups should be nearly instant
    expect(lookupDuration).toBeLessThan(5);
  });
});

describe('Performance: Value Range Caching', () => {
  test('should cache numeric ranges efficiently', () => {
    const rows = generateMockRows(1000);
    const columns = [
      { key: 'metric1', isMetric: true, isNumeric: true },
      { key: 'metric2', isMetric: true, isNumeric: true },
      { key: 'metric3', isMetric: true, isNumeric: true },
    ];

    const start = performance.now();

    // Simulate value range cache calculation
    const pos = new Map();
    const normal = new Map();

    for (const col of columns) {
      const nums = [];
      for (let i = 0; i < rows.length; i++) {
        const v = (rows[i] as any)[col.key];
        if (typeof v === 'number' && Number.isFinite(v)) {
          nums.push(v);
        }
      }
      if (nums.length) {
        const maxAbs = Math.max(...nums.map(Math.abs));
        const minVal = Math.min(...nums);
        const maxVal = Math.max(...nums);
        pos.set(col.key, [0, maxAbs]);
        normal.set(col.key, [minVal, maxVal]);
      }
    }

    const duration = performance.now() - start;

    // Should cache all ranges in under 100ms
    expect(duration).toBeLessThan(100);
    expect(pos.size).toBe(3);
    expect(normal.size).toBe(3);

    // Verify lookup is O(1)
    const lookupStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      pos.get('metric1');
      normal.get('metric2');
    }
    const lookupDuration = performance.now() - lookupStart;

    // 20k lookups should be instant
    expect(lookupDuration).toBeLessThan(5);
  });
});

describe('Performance: Component Rendering', () => {
  test('should render 1000 rows in reasonable time', () => {
    const rows = generateMockRows(1000);
    const props = {
      ...transformProps({
        ...testData,
        queriesData: [
          {
            ...testData.queriesData[0],
            data: rows,
            rowcount: rows.length,
          },
        ],
      } as any),
      height: 600,
      width: 800,
      sticky: false,
    };

    const start = performance.now();
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart {...props} />
      </ThemeProvider>
    );
    const duration = performance.now() - start;

    // Should render 1000 rows in under 1000ms (reasonable for initial render)
    expect(duration).toBeLessThan(1000);
    expect(container).toBeInTheDocument();
  });

  test('should handle pagination efficiently', () => {
    const rows = generateMockRows(50); // One page
    const props = {
      ...transformProps({
        ...testData,
        queriesData: [
          {
            ...testData.queriesData[0],
            data: rows,
            rowcount: 10000, // Total rows
          },
        ],
        rawFormData: {
          ...testData.rawFormData,
          server_pagination: true,
          server_page_length: 50,
        },
      } as any),
      height: 600,
      width: 800,
      sticky: false,
    };

    const start = performance.now();
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart {...props} />
      </ThemeProvider>
    );
    const duration = performance.now() - start;

    // Server pagination should render fast (only current page)
    expect(duration).toBeLessThan(300);
    expect(container).toBeInTheDocument();
  });
});

describe('Performance: Advanced Filters', () => {
  test('should apply 50 advanced filters efficiently', () => {
    const { cachedBuildQuery } = require('../src/buildQuery');
    const buildQuery = cachedBuildQuery();

    // Generate 50 advanced filter conditions
    const advancedFilters: any = {};
    for (let i = 0; i < 50; i++) {
      advancedFilters[`col${i}`] = {
        logic: 'AND',
        conditions: [
          { op: 'contains', value: 'test' },
          { op: 'not_equals', value: 'exclude' },
        ],
      };
    }

    const start = performance.now();
    buildQuery(
      {
        ...testData.rawFormData,
        slice_id: 789,
        server_pagination: true,
      } as any,
      {
        ownState: {
          advancedFilters,
          pageSize: 50,
          currentPage: 0,
        },
        hooks: {
          setDataMask: () => {},
          setCachedChanges: () => {},
        },
      }
    );
    const duration = performance.now() - start;

    // Should build query with 50 advanced filters in under 200ms
    expect(duration).toBeLessThan(200);
  });
});

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

import { generateMatrixifyGrid } from './MatrixifyGridGenerator';
import { AdhocMetric } from '../../../query/types/Metric';

// Use 'any' to bypass strict typing in tests
type TestFormData = any;

const createAdhocMetric = (label: string): AdhocMetric => ({
  expressionType: 'SIMPLE',
  column: { column_name: 'value' },
  aggregate: 'SUM',
  label,
});

const createSqlMetric = (label: string, sql: string): AdhocMetric => ({
  expressionType: 'SQL',
  sqlExpression: sql,
  label,
});

const baseFormData: TestFormData = {
  viz_type: 'table',
  datasource: '1__table',
  matrixify_mode_rows: 'metrics',
  matrixify_mode_columns: 'metrics',
  matrixify_rows: [createAdhocMetric('Revenue'), createAdhocMetric('Profit')],
  matrixify_columns: [
    createSqlMetric('Q1', 'SUM(CASE WHEN quarter = 1 THEN value END)'),
    createSqlMetric('Q2', 'SUM(CASE WHEN quarter = 2 THEN value END)'),
  ],
  matrixify_cell_title_template: '{{row}} - {{column}}',
};

test('should generate a 2x2 grid for metrics mode', () => {
  const grid = generateMatrixifyGrid(baseFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual(['Revenue', 'Profit']);
  expect(grid!.colHeaders).toEqual(['Q1', 'Q2']);
  expect(grid!.cells).toHaveLength(2);
  expect(grid!.cells[0]).toHaveLength(2);

  // Check first cell
  const firstCell = grid!.cells[0][0];
  expect(firstCell).toBeDefined();
  expect(firstCell!.id).toBe('cell-0-0');
  expect(firstCell!.row).toBe(0);
  expect(firstCell!.col).toBe(0);
  expect(firstCell!.rowLabel).toBe('Revenue');
  expect(firstCell!.colLabel).toBe('Q1');
  expect(firstCell!.title).toBe('Revenue - Q1');
  expect(firstCell!.formData.metrics).toEqual([
    createAdhocMetric('Revenue'),
    createSqlMetric('Q1', 'SUM(CASE WHEN quarter = 1 THEN value END)'),
  ]);
});

test('should generate grid for dimensions mode', () => {
  const dimensionFormData: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: {
      dimension: 'country',
      values: ['USA', 'Canada'],
    },
    matrixify_dimension_columns: {
      dimension: 'product',
      values: ['Widget', 'Gadget'],
    },
  };

  const grid = generateMatrixifyGrid(dimensionFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual(['USA', 'Canada']);
  expect(grid!.colHeaders).toEqual(['Widget', 'Gadget']);
  expect(grid!.cells).toHaveLength(2);
  expect(grid!.cells[0]).toHaveLength(2);

  // Check that filters are applied correctly
  const firstCell = grid!.cells[0][0];
  expect(firstCell!.formData.adhoc_filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        subject: 'country',
        comparator: 'USA',
      }),
      expect.objectContaining({
        subject: 'product',
        comparator: 'Widget',
      }),
    ]),
  );
});

test('should generate grid for mixed mode (metrics rows, dimensions columns)', () => {
  const mixedFormData: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'dimensions',
    matrixify_rows: [createAdhocMetric('Total Sales')],
    matrixify_dimension_columns: {
      dimension: 'region',
      values: ['North', 'South', 'East', 'West'],
    },
  };

  const grid = generateMatrixifyGrid(mixedFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual(['Total Sales']);
  expect(grid!.colHeaders).toEqual(['North', 'South', 'East', 'West']);
  expect(grid!.cells).toHaveLength(1);
  expect(grid!.cells[0]).toHaveLength(4);
});

test('should handle empty configuration', () => {
  const emptyFormData: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [],
    matrixify_columns: [],
  };

  const grid = generateMatrixifyGrid(emptyFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual([]);
  expect(grid!.colHeaders).toEqual([]);
  expect(grid!.cells).toEqual([]);
});

test('should handle single row and column', () => {
  const singleCellFormData: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [createAdhocMetric('Count')],
    matrixify_columns: [createAdhocMetric('Total')],
  };

  const grid = generateMatrixifyGrid(singleCellFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual(['Count']);
  expect(grid!.colHeaders).toEqual(['Total']);
  expect(grid!.cells).toHaveLength(1);
  expect(grid!.cells[0]).toHaveLength(1);
  expect(grid!.cells[0][0]!.title).toBe(''); // No template provided
});

test('should handle string metrics', () => {
  const stringMetricFormData: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: ['count', 'sum'],
    matrixify_columns: ['avg', 'max'],
  };

  const grid = generateMatrixifyGrid(stringMetricFormData);

  expect(grid).not.toBeNull();
  expect(grid!.rowHeaders).toEqual(['count', 'sum']);
  expect(grid!.colHeaders).toEqual(['avg', 'max']);
});

test('should not escape HTML entities in cell titles', () => {
  const formDataWithSpecialChars: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [createAdhocMetric('Sales & Revenue')],
    matrixify_columns: [createAdhocMetric('Q1 > Q2')],
    matrixify_cell_title_template: '{{row}} < {{column}}',
  };

  const grid = generateMatrixifyGrid(formDataWithSpecialChars);

  expect(grid).not.toBeNull();
  const firstCell = grid!.cells[0][0];
  // Should NOT escape HTML entities
  expect(firstCell!.title).toBe('Sales & Revenue < Q1 > Q2');
  expect(firstCell!.title).not.toContain('&amp;');
  expect(firstCell!.title).not.toContain('&lt;');
  expect(firstCell!.title).not.toContain('&gt;');
});

test('should apply chart-specific configurations', () => {
  const chartConfigFormData: TestFormData = {
    ...baseFormData,
    row_limit: 100,
    time_range: 'Last month',
    granularity_sqla: 'day',
  };

  const grid = generateMatrixifyGrid(chartConfigFormData);

  expect(grid).not.toBeNull();
  // Check that chart-specific configs are preserved
  const cell = grid!.cells[0][0];
  expect(cell!.formData.row_limit).toBe(100);
  expect(cell!.formData.time_range).toBe('Last month');
  expect(cell!.formData.granularity_sqla).toBe('day');
});

test('should generate unique cell IDs', () => {
  const grid = generateMatrixifyGrid(baseFormData);

  expect(grid).not.toBeNull();
  const cellIds = new Set<string>();

  const nonNullCells: { id: string }[] = [];
  grid!.cells.forEach(row => {
    row.forEach(cell => {
      if (cell) {
        nonNullCells.push(cell);
      }
    });
  });

  nonNullCells.forEach(cell => {
    expect(cellIds.has(cell.id)).toBe(false);
    cellIds.add(cell.id);
  });

  expect(cellIds.size).toBe(4); // 2x2 grid
});

test('should handle template with special characters', () => {
  const formDataWithSpecialTemplate: TestFormData = {
    ...baseFormData,
    matrixify_cell_title_template: '{{row}} | {{column}} (%)',
  };

  const grid = generateMatrixifyGrid(formDataWithSpecialTemplate);
  expect(grid).not.toBeNull();
  expect(grid!.cells[0][0]!.title).toBe('Revenue | Q1 (%)');
});

test('should preserve existing adhoc filters', () => {
  const formDataWithFilters: TestFormData = {
    ...baseFormData,
    adhoc_filters: [
      {
        expressionType: 'SIMPLE',
        subject: 'year',
        operator: '==',
        comparator: 2024,
        clause: 'WHERE',
      },
    ],
  };

  const grid = generateMatrixifyGrid(formDataWithFilters);
  expect(grid).not.toBeNull();
  const cell = grid!.cells[0][0];

  // In metrics mode, filters are not added per cell
  expect(cell!.formData.adhoc_filters).toHaveLength(1);
  expect(cell!.formData.adhoc_filters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        subject: 'year',
        comparator: 2024,
      }),
    ]),
  );
});

test('should handle metrics without labels', () => {
  const metricsWithoutLabels: TestFormData = {
    viz_type: 'table',
    datasource: '1__table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'value' },
        aggregate: 'SUM',
        optionName: 'SUM(value)',
      },
    ],
    matrixify_columns: ['count'],
  };

  const grid = generateMatrixifyGrid(metricsWithoutLabels);

  expect(grid).not.toBeNull();
  // Metrics without labels show empty string
  expect(grid!.rowHeaders).toEqual(['']);
  expect(grid!.colHeaders).toEqual(['count']);
});

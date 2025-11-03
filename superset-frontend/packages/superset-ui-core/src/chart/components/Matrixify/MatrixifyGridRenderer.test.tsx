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

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@superset-ui/core';
import MatrixifyGridRenderer from './MatrixifyGridRenderer';
import { generateMatrixifyGrid } from './MatrixifyGridGenerator';
import { supersetTheme } from '../../../theme';

// Mock the MatrixifyGridGenerator
jest.mock('./MatrixifyGridGenerator', () => ({
  generateMatrixifyGrid: jest.fn(),
}));

// Mock MatrixifyGridCell component
jest.mock('./MatrixifyGridCell', () =>
  // eslint-disable-next-line react/display-name, @typescript-eslint/no-unused-vars
  ({ cell, rowHeight, datasource, hooks }: any) => (
    <div data-testid={`grid-cell-${cell.id}`}>Cell: {cell.id}</div>
  ),
);

const mockGenerateMatrixifyGrid = generateMatrixifyGrid as jest.MockedFunction<
  typeof generateMatrixifyGrid
>;

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
});

test('should create single group when fitting columns dynamically', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1', 'Row 2'],
    colHeaders: ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5'],
    cells: [
      [
        { id: 'cell-0-0' },
        { id: 'cell-0-1' },
        { id: 'cell-0-2' },
        { id: 'cell-0-3' },
        { id: 'cell-0-4' },
      ],
      [
        { id: 'cell-1-0' },
        { id: 'cell-1-1' },
        { id: 'cell-1-2' },
        { id: 'cell-1-3' },
        { id: 'cell-1-4' },
      ],
    ],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: true,
    matrixify_charts_per_row: 3,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // When fitting dynamically, should have only one column group with all 5 columns
  // Check for the presence of the grid structure
  const gridContainers = container.querySelectorAll('div[class*="css-"]');
  expect(gridContainers.length).toBeGreaterThan(0);

  // Verify all 5 column headers are present in single group
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders).toHaveLength(5);
  expect(columnHeaders[0]).toHaveTextContent('Col 1');
  expect(columnHeaders[4]).toHaveTextContent('Col 5');
});

test('should create multiple groups when not fitting columns dynamically', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1', 'Row 2'],
    colHeaders: ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5'],
    cells: [
      [
        { id: 'cell-0-0' },
        { id: 'cell-0-1' },
        { id: 'cell-0-2' },
        { id: 'cell-0-3' },
        { id: 'cell-0-4' },
      ],
      [
        { id: 'cell-1-0' },
        { id: 'cell-1-1' },
        { id: 'cell-1-2' },
        { id: 'cell-1-3' },
        { id: 'cell-1-4' },
      ],
    ],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: false,
    matrixify_charts_per_row: 3,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // With 5 columns and charts_per_row=3, should have 2 groups (3+2)
  // With 2 rows and wrapping, we should see headers repeated
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders.length).toBeGreaterThanOrEqual(5); // At least the base headers
});

test('should handle exact division of columns', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1'],
    colHeaders: ['Col 1', 'Col 2', 'Col 3', 'Col 4'],
    cells: [
      [
        { id: 'cell-0-0' },
        { id: 'cell-0-1' },
        { id: 'cell-0-2' },
        { id: 'cell-0-3' },
      ],
    ],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: false,
    matrixify_charts_per_row: 2,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // With 4 columns and charts_per_row=2, should have exactly 2 groups (2+2)
  // Check that we have column headers - should be 4 total (2 per group)
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders).toHaveLength(4);
});

test('should handle case where charts_per_row exceeds total columns', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1'],
    colHeaders: ['Col 1', 'Col 2'],
    cells: [[{ id: 'cell-0-0' }, { id: 'cell-0-1' }]],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: false,
    matrixify_charts_per_row: 5,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // Should create only one group with all columns
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders).toHaveLength(2);
});

test('should show headers for each group when wrapping occurs', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1', 'Row 2'],
    colHeaders: ['Col 1', 'Col 2', 'Col 3'],
    cells: [
      [{ id: 'cell-0-0' }, { id: 'cell-0-1' }, { id: 'cell-0-2' }],
      [{ id: 'cell-1-0' }, { id: 'cell-1-1' }, { id: 'cell-1-2' }],
    ],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: false,
    matrixify_charts_per_row: 2,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // With wrapping (multiple column groups), headers should appear for each group
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders.length).toBeGreaterThan(3); // More than just one set of headers

  // Row headers should appear only once per row (for first column group)
  const rowHeaders = container.querySelectorAll('.matrixify-row-header');
  expect(rowHeaders).toHaveLength(2); // One for each row
});

test('should show headers only on first row when not wrapping', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1', 'Row 2'],
    colHeaders: ['Col 1', 'Col 2'],
    cells: [
      [{ id: 'cell-0-0' }, { id: 'cell-0-1' }],
      [{ id: 'cell-1-0' }, { id: 'cell-1-1' }],
    ],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: true, // No wrapping
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // Without wrapping, headers should appear only once (first row)
  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders).toHaveLength(2); // Just Col 1 and Col 2

  const rowHeaders = container.querySelectorAll('.matrixify-row-header');
  expect(rowHeaders).toHaveLength(2); // One for each row
});

test('should hide headers when disabled', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1'],
    colHeaders: ['Col 1', 'Col 2'],
    cells: [[{ id: 'cell-0-0' }, { id: 'cell-0-1' }]],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_show_row_labels: false,
    matrixify_show_column_headers: false,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  const columnHeaders = container.querySelectorAll('.matrixify-col-header');
  expect(columnHeaders).toHaveLength(0);

  const rowHeaders = container.querySelectorAll('.matrixify-row-header');
  expect(rowHeaders).toHaveLength(0);
});

test('should place cells correctly in wrapped layout', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1'],
    colHeaders: ['Col 1', 'Col 2', 'Col 3'],
    cells: [[{ id: 'cell-0-0' }, { id: 'cell-0-1' }, { id: 'cell-0-2' }]],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    matrixify_fit_columns_dynamically: false,
    matrixify_charts_per_row: 2,
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // All cells should be rendered
  const cells = container.querySelectorAll('[data-testid^="grid-cell-"]');
  expect(cells).toHaveLength(3);
  expect(
    container.querySelector('[data-testid="grid-cell-cell-0-0"]'),
  ).toBeInTheDocument();
  expect(
    container.querySelector('[data-testid="grid-cell-cell-0-1"]'),
  ).toBeInTheDocument();
  expect(
    container.querySelector('[data-testid="grid-cell-cell-0-2"]'),
  ).toBeInTheDocument();
});

test('should handle null grid gracefully', () => {
  mockGenerateMatrixifyGrid.mockReturnValue(null);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('should handle empty grid gracefully', () => {
  const mockGrid: any = {
    rowHeaders: [],
    colHeaders: [],
    cells: [],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // Should render container but no cells
  expect(container).not.toBeEmptyDOMElement();
  const gridCells = container.querySelectorAll('[data-testid^="grid-cell-"]');
  expect(gridCells).toHaveLength(0);
});

test('should use default values for missing configuration', () => {
  const mockGrid: any = {
    rowHeaders: ['Row 1'],
    colHeaders: ['Col 1', 'Col 2'],
    cells: [[{ id: 'cell-0-0' }, { id: 'cell-0-1' }]],
  };

  mockGenerateMatrixifyGrid.mockReturnValue(mockGrid);

  const formData = {
    viz_type: 'test_chart',
    matrixify_enable_vertical_layout: true,
    matrixify_enable_horizontal_layout: true,
    // Missing optional configurations
  };

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer formData={formData} />,
  );

  // Should still render with defaults
  expect(container).not.toBeEmptyDOMElement();
  const gridCells = container.querySelectorAll('[data-testid^="grid-cell-"]');
  expect(gridCells).toHaveLength(2);
});

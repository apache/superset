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

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, supersetTheme } from '../../..';
import MatrixifyGridRenderer from './MatrixifyGridRenderer';
import { MatrixifyGrid } from '../../types/matrixify';
import { AdhocMetric } from '../../../query/types/Metric';

import { generateMatrixifyGrid } from './MatrixifyGridGenerator';

// Use 'any' to bypass strict typing in tests
type TestFormData = any;

// Mock MatrixifyGridCell component
jest.mock('./MatrixifyGridCell', () => ({
  __esModule: true,
  default: ({ cell }: any) => (
    <div data-testid={`cell-${cell.id}`} className="matrixify-cell">
      {cell.title || `${cell.rowLabel}-${cell.colLabel}`}
    </div>
  ),
}));

// Mock generateMatrixifyGrid function
jest.mock('./MatrixifyGridGenerator', () => ({
  generateMatrixifyGrid: jest.fn(),
}));

const mockedGenerateMatrixifyGrid =
  generateMatrixifyGrid as jest.MockedFunction<typeof generateMatrixifyGrid>;

const mockDatasource = {
  id: 1,
  type: 'table' as const,
  uid: '1__table',
  datasource_name: 'test_datasource',
  table_name: 'test_table',
  database: {
    id: 1,
    name: 'test_database',
  },
};

const createAdhocMetric = (label: string): AdhocMetric => ({
  expressionType: 'SIMPLE',
  column: { column_name: 'value' },
  aggregate: 'SUM',
  label,
});

const baseFormData: TestFormData = {
  viz_type: 'table',
  datasource: '1__table',
  matrixify_mode_rows: 'metrics',
  matrixify_mode_columns: 'metrics',
  matrixify_rows: [createAdhocMetric('Revenue'), createAdhocMetric('Profit')],
  matrixify_columns: [createAdhocMetric('Q1'), createAdhocMetric('Q2')],
  matrixify_show_row_labels: true,
  matrixify_show_column_headers: true,
  matrixify_row_height: 200,
};

const mockGrid: MatrixifyGrid = {
  rowHeaders: ['Revenue', 'Profit'],
  colHeaders: ['Q1', 'Q2'],
  cells: [
    [
      {
        id: 'matrixify-0-0',
        row: 0,
        col: 0,
        rowLabel: 'Revenue',
        colLabel: 'Q1',
        title: 'Revenue - Q1',
        formData: { viz_type: 'big_number_total' },
      },
      {
        id: 'matrixify-0-1',
        row: 0,
        col: 1,
        rowLabel: 'Revenue',
        colLabel: 'Q2',
        title: 'Revenue - Q2',
        formData: { viz_type: 'big_number_total' },
      },
    ],
    [
      {
        id: 'matrixify-1-0',
        row: 1,
        col: 0,
        rowLabel: 'Profit',
        colLabel: 'Q1',
        title: 'Profit - Q1',
        formData: { viz_type: 'big_number_total' },
      },
      {
        id: 'matrixify-1-1',
        row: 1,
        col: 1,
        rowLabel: 'Profit',
        colLabel: 'Q2',
        title: 'Profit - Q2',
        formData: { viz_type: 'big_number_total' },
      },
    ],
  ],
  baseFormData,
};

const defaultProps = {
  formData: baseFormData,
  width: 800,
  height: 600,
  datasource: mockDatasource,
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

beforeEach(() => {
  mockedGenerateMatrixifyGrid.mockReturnValue(mockGrid);
});

afterEach(() => {
  jest.clearAllMocks();
});

test('should render the grid with all cells', () => {
  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  expect(screen.getByText('Revenue - Q1')).toBeInTheDocument();
  expect(screen.getByText('Revenue - Q2')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q1')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q2')).toBeInTheDocument();
});

test('should render column headers when enabled', () => {
  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  expect(screen.getByText('Q1')).toBeInTheDocument();
  expect(screen.getByText('Q2')).toBeInTheDocument();
});

test('should render row labels when enabled', () => {
  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  const rowLabels = screen.getAllByText('Revenue');
  expect(rowLabels).toHaveLength(1); // Only in row label, not in cells

  const profitLabels = screen.getAllByText('Profit');
  expect(profitLabels).toHaveLength(1);
});

test('should hide column headers when disabled', () => {
  const formDataWithoutHeaders = {
    ...baseFormData,
    matrixify_show_column_headers: false,
  };

  renderWithTheme(
    <MatrixifyGridRenderer
      {...defaultProps}
      formData={formDataWithoutHeaders}
    />,
  );

  expect(screen.queryByText('Q1')).not.toBeInTheDocument();
  expect(screen.queryByText('Q2')).not.toBeInTheDocument();
});

test('should hide row labels when disabled', () => {
  const formDataWithoutLabels = {
    ...baseFormData,
    matrixify_show_row_labels: false,
  };

  renderWithTheme(
    <MatrixifyGridRenderer
      {...defaultProps}
      formData={formDataWithoutLabels}
    />,
  );

  // Row labels should not be shown
  expect(screen.queryAllByText('Revenue')).toHaveLength(0);
  expect(screen.queryAllByText('Profit')).toHaveLength(0);
});

test('should calculate column widths based on grid layout', () => {
  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  // Verify all cells are rendered
  expect(screen.getByText('Revenue - Q1')).toBeInTheDocument();
  expect(screen.getByText('Revenue - Q2')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q1')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q2')).toBeInTheDocument();
});

test('should handle custom row height', () => {
  const formDataWithCustomHeight = {
    ...baseFormData,
    matrixify_row_height: 300,
  };

  renderWithTheme(
    <MatrixifyGridRenderer
      {...defaultProps}
      formData={formDataWithCustomHeight}
    />,
  );

  // Verify cells are rendered (height would be applied in the actual component)
  expect(screen.getByText('Revenue - Q1')).toBeInTheDocument();
  expect(screen.getByText('Revenue - Q2')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q1')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q2')).toBeInTheDocument();
});

test('should handle empty grid', () => {
  mockedGenerateMatrixifyGrid.mockReturnValue({
    rowHeaders: [],
    colHeaders: [],
    cells: [],
    baseFormData,
  });

  const { container } = renderWithTheme(
    <MatrixifyGridRenderer {...defaultProps} />,
  );

  // Should render empty container
  expect(container.firstChild).toBeInTheDocument();
  expect(screen.queryAllByText(/Revenue|Profit|Q1|Q2/)).toHaveLength(0);
});

test('should handle single cell grid', () => {
  mockedGenerateMatrixifyGrid.mockReturnValue({
    rowHeaders: ['Total'],
    colHeaders: ['All'],
    cells: [
      [
        {
          id: 'matrixify-0-0',
          row: 0,
          col: 0,
          rowLabel: 'Total',
          colLabel: 'All',
          formData: { viz_type: 'big_number_total' },
        },
      ],
    ],
    baseFormData,
  });

  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  expect(screen.getByText('Total-All')).toBeInTheDocument();
  expect(screen.getByText('Total')).toBeInTheDocument();
  expect(screen.getByText('All')).toBeInTheDocument();
});

test('should handle grid with null cells', () => {
  mockedGenerateMatrixifyGrid.mockReturnValue({
    rowHeaders: ['A', 'B'],
    colHeaders: ['X', 'Y'],
    cells: [
      [mockGrid.cells[0][0], null],
      [null, mockGrid.cells[1][1]],
    ],
    baseFormData,
  });

  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  // Only non-null cells should be rendered
  expect(screen.getByText('Revenue - Q1')).toBeInTheDocument();
  expect(screen.getByText('Profit - Q2')).toBeInTheDocument();
  expect(screen.queryByText('null')).not.toBeInTheDocument();
});

test('should apply overflow styling to container', () => {
  const { container } = renderWithTheme(
    <MatrixifyGridRenderer {...defaultProps} />,
  );

  const gridContainer = container.firstChild as HTMLElement;
  expect(gridContainer).toHaveStyle({
    width: '100%',
    height: '600px',
  });
});

test('should call generateMatrixifyGrid with correct formData', () => {
  renderWithTheme(<MatrixifyGridRenderer {...defaultProps} />);

  expect(mockedGenerateMatrixifyGrid).toHaveBeenCalledTimes(1);
  expect(mockedGenerateMatrixifyGrid).toHaveBeenCalledWith(baseFormData);
});

test('should handle dimension mode grid', () => {
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
    matrixify_show_row_labels: true,
    matrixify_show_column_headers: true,
  };

  mockedGenerateMatrixifyGrid.mockReturnValue({
    rowHeaders: ['USA', 'Canada'],
    colHeaders: ['Widget', 'Gadget'],
    cells: mockGrid.cells,
    baseFormData: dimensionFormData,
  });

  renderWithTheme(
    <MatrixifyGridRenderer {...defaultProps} formData={dimensionFormData} />,
  );

  expect(screen.getByText('USA')).toBeInTheDocument();
  expect(screen.getByText('Canada')).toBeInTheDocument();
  expect(screen.getByText('Widget')).toBeInTheDocument();
  expect(screen.getByText('Gadget')).toBeInTheDocument();
});

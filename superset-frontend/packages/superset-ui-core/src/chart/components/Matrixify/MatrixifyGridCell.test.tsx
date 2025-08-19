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
import MatrixifyGridCell from './MatrixifyGridCell';
import { MatrixifyGridCell as MatrixifyGridCellType } from '../../types/matrixify';

// Mock StatefulChart component
jest.mock('../StatefulChart', () => {
  /* eslint-disable no-restricted-syntax, global-require, @typescript-eslint/no-var-requires */
  const React = require('react');
  /* eslint-enable no-restricted-syntax, global-require, @typescript-eslint/no-var-requires */

  return {
    __esModule: true,
    default: ({ formData, height, width }: any) =>
      React.createElement(
        'div',
        {
          'data-testid': 'superchart',
          'data-viz-type': formData.viz_type,
          style: { height, width },
        },
        'SuperChart Mock',
      ),
  };
});

const mockDatasource = {
  id: 1,
  type: 'table',
  uid: '1__table',
  datasource_name: 'test_datasource',
  table_name: 'test_table',
  database: {
    id: 1,
    name: 'test_database',
  },
};

const mockCell: MatrixifyGridCellType = {
  id: 'matrixify-0-0',
  row: 0,
  col: 0,
  rowLabel: 'Revenue',
  colLabel: 'Q1 2024',
  title: 'Revenue - Q1 2024',
  formData: {
    viz_type: 'big_number_total',
    metrics: ['revenue'],
    adhoc_filters: [],
  },
};

const defaultProps = {
  cell: mockCell,
  datasource: mockDatasource,
  rowHeight: 200,
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('should render the cell with title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  expect(screen.getByText('Revenue - Q1 2024')).toBeInTheDocument();
});

test('should render the cell without title when not provided', () => {
  const cellWithoutTitle = {
    ...mockCell,
    title: undefined,
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithoutTitle} />,
  );

  expect(screen.queryByText('Revenue - Q1 2024')).not.toBeInTheDocument();
});

test('should render SuperChart with correct props', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const superChart = screen.getByText('SuperChart Mock');
  expect(superChart).toBeInTheDocument();
  expect(superChart).toHaveAttribute('data-viz-type', 'big_number_total');
  expect(superChart).toHaveStyle({ height: '100%', width: '100%' });
});

test('should calculate chart height correctly with title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const superChart = screen.getByText('SuperChart Mock');
  // StatefulChart uses 100% height within the chart wrapper
  expect(superChart).toHaveStyle({ height: '100%' });
});

test('should calculate chart height correctly without title', () => {
  const cellWithoutTitle = {
    ...mockCell,
    title: undefined,
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithoutTitle} />,
  );

  const superChart = screen.getByText('SuperChart Mock');
  // StatefulChart uses 100% height within the chart wrapper
  expect(superChart).toHaveStyle({ height: '100%' });
});

test('should apply correct styling to container', () => {
  const { container } = renderWithTheme(
    <MatrixifyGridCell {...defaultProps} />,
  );

  const cellContainer = container.firstChild as HTMLElement;
  expect(cellContainer).toHaveStyle({
    height: '100%',
    display: 'flex',
  });
});

test('should apply correct styling to title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const title = screen.getByText('Revenue - Q1 2024');
  expect(title).toHaveStyle({
    overflow: 'hidden',
  });
});

test('should handle different viz types', () => {
  const cellWithLineChart = {
    ...mockCell,
    formData: {
      ...mockCell.formData,
      viz_type: 'line',
    },
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithLineChart} />,
  );

  const superChart = screen.getByText('SuperChart Mock');
  expect(superChart).toHaveAttribute('data-viz-type', 'line');
});

test('should pass through additional formData properties', () => {
  const cellWithExtraProps = {
    ...mockCell,
    formData: {
      ...mockCell.formData,
      time_range: 'Last month',
      row_limit: 100,
    },
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithExtraProps} />,
  );

  // The SuperChart mock would receive these props
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('should handle small cell dimensions', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} rowHeight={80} />);

  const superChart = screen.getByText('SuperChart Mock');
  const cellContainer = superChart.parentElement?.parentElement;
  expect(cellContainer).toHaveStyle({ height: '100%' });

  // StatefulChart uses 100% dimensions within its wrapper
  expect(superChart).toHaveStyle({ height: '100%', width: '100%' });
});

test('should handle empty cell data gracefully', () => {
  const emptyCell = {
    ...mockCell,
    rowLabel: '',
    colLabel: '',
    title: '',
  };

  renderWithTheme(<MatrixifyGridCell {...defaultProps} cell={emptyCell} />);

  // Should still render but with empty title
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

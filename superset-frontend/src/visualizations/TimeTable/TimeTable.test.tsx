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
import { render, screen } from '@superset-ui/core/spec';
import TimeTable from './TimeTable';

const mockData = {
  '2003-01-01 00:00:00': {
    'SUM(sales)': 3516979.54,
  },
  '2004-01-01 00:00:00': {
    'SUM(sales)': 4724162.6,
  },
  '2005-01-01 00:00:00': {
    'SUM(sales)': 1791486.71,
  },
};

const mockRows = [
  {
    aggregate: 'SUM',
    column: {
      column_name: 'sales',
      id: 745,
      type: 'DOUBLE PRECISION',
    },
    label: 'SUM(sales)',
    optionName: 'metric_test',
  },
];

const mockColumnConfigs = [
  {
    bounds: [null, null],
    colType: 'spark',
    comparisonType: '',
    d3format: '',
    dateFormat: '',
    height: '',
    key: 'test-sparkline-key',
    label: 'Time series columns',
    showYAxis: false,
    timeLag: 0,
    timeRatio: '',
    tooltip: '',
    width: '',
    yAxisBounds: [null, null],
  },
];

const defaultProps = {
  className: '',
  height: 400,
  data: mockData,
  columnConfigs: mockColumnConfigs,
  rows: mockRows,
  rowType: 'metric' as const,
  url: '',
};

test('should render TimeTable component', () => {
  const { container } = render(<TimeTable {...defaultProps} />);
  expect(container).toBeInTheDocument();
});

test('should render table headers', () => {
  render(<TimeTable {...defaultProps} />);
  expect(screen.getByText('Metric')).toBeInTheDocument();
  expect(screen.getByText('Time series columns')).toBeInTheDocument();
});

test('should render table with data rows', () => {
  render(<TimeTable {...defaultProps} />);

  const tableRows = screen.getAllByTestId('table-row');

  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  expect(tableRows.length).toBeGreaterThan(0);
});

test('should render sparkline data in table cells', () => {
  render(<TimeTable {...defaultProps} />);

  const tableCells = screen.getAllByTestId('table-row-cell');

  expect(tableCells.length).toBeGreaterThan(0);
});

test('should handle columns with proper id and accessor properties', () => {
  render(<TimeTable {...defaultProps} />);

  const table = screen.getByRole('table');

  expect(table).toBeInTheDocument();
  expect(screen.getAllByTestId('table-row')).toHaveLength(1);
  expect(screen.getAllByTestId('table-row-cell')).toHaveLength(2);
});

test('should render with empty data gracefully', () => {
  const emptyProps = {
    ...defaultProps,
    data: {},
    rows: [],
  };

  const { container } = render(<TimeTable {...emptyProps} />);

  expect(container).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
});

test('should render with multiple metrics', () => {
  const multipleMetricsProps = {
    ...defaultProps,
    rows: [
      ...mockRows,
      {
        aggregate: 'AVG',
        column: {
          column_name: 'price',
          id: 746,
          type: 'DOUBLE PRECISION',
        },
        label: 'AVG(price)',
        optionName: 'metric_test_2',
      },
    ],
  };

  render(<TimeTable {...multipleMetricsProps} />);

  expect(screen.getAllByTestId('table-row')).toHaveLength(2);
});

test('should handle column type sparkline correctly', () => {
  render(<TimeTable {...defaultProps} />);

  const columnHeaders = screen.getAllByRole('columnheader');

  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(columnHeaders).toHaveLength(2);
  expect(screen.getByText('Time series columns')).toBeInTheDocument();
});

test('should not render empty table due to missing column id property', () => {
  render(<TimeTable {...defaultProps} />);

  const table = screen.getByRole('table');
  const dataRows = screen.getAllByTestId('table-row');
  const dataCells = screen.getAllByTestId('table-row-cell');

  expect(table).toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  expect(dataRows).toHaveLength(1);
  expect(dataCells).toHaveLength(2);
});

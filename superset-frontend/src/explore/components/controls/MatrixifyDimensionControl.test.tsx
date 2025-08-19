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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SupersetClient } from '@superset-ui/core';
import MatrixifyDimensionControl, {
  MatrixifyDimensionControlValue,
} from './MatrixifyDimensionControl';

import { fetchTopNValues } from './MatrixifyControl/utils/fetchTopNValues';

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
  t: (str: string, ...args: any[]) => {
    if (args.length > 0 && str.includes('%s')) {
      return str.replace('%s', args[0]);
    }
    return str;
  },
  getColumnLabel: (col: string) => col,
}));

// Mock fetchTopNValues utility
jest.mock('./MatrixifyControl/utils/fetchTopNValues', () => ({
  fetchTopNValues: jest.fn(),
  extractDimensionValues: jest.fn(values => values.map((v: any) => v.value)),
}));

// Mock ControlHeader
jest.mock('src/explore/components/ControlHeader', () => ({
  __esModule: true,
  default: ({ label, description }: any) => (
    <div data-testid="control-header">
      {label && <span data-testid="label">{label}</span>}
      {description && <span data-testid="description">{description}</span>}
    </div>
  ),
}));

const mockDatasource = {
  id: 1,
  type: 'table',
  columns: [
    { column_name: 'country', verbose_name: 'Country' },
    { column_name: 'region', verbose_name: 'Region' },
    { column_name: 'product', verbose_name: 'Product' },
  ],
  filter_select: true,
};

const defaultProps = {
  datasource: mockDatasource,
  onChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('should render dimension selector with default label', () => {
  render(<MatrixifyDimensionControl {...defaultProps} />);

  expect(screen.getByText('Dimension')).toBeInTheDocument();
  expect(screen.getAllByText('Select a dimension')).toHaveLength(2); // Header description + placeholder
  expect(
    screen.getByRole('combobox', { name: 'Select dimension' }),
  ).toBeInTheDocument();
});

test('should render with custom label and description', () => {
  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      label="Custom Label"
      description="Custom Description"
    />,
  );

  expect(screen.getByText('Custom Label')).toBeInTheDocument();
  expect(screen.getByText('Custom Description')).toBeInTheDocument();
});

test('should display dimension options from datasource columns', async () => {
  render(<MatrixifyDimensionControl {...defaultProps} />);

  const select = screen.getByRole('combobox', { name: 'Select dimension' });
  await userEvent.click(select);

  await waitFor(() => {
    expect(screen.getByText('country')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
    expect(screen.getByText('product')).toBeInTheDocument();
  });
});

test('should call onChange when dimension is selected', async () => {
  const onChange = jest.fn();
  render(<MatrixifyDimensionControl {...defaultProps} onChange={onChange} />);

  const select = screen.getByRole('combobox', { name: 'Select dimension' });
  await userEvent.click(select);
  await userEvent.click(screen.getByText('country'));

  expect(onChange).toHaveBeenCalledWith({
    dimension: 'country',
    values: [],
  });
});

test('should display selected dimension value', () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: ['USA', 'Canada'],
  };

  render(<MatrixifyDimensionControl {...defaultProps} value={value} />);

  // Check that the component renders with the selected dimension
  expect(
    screen.getByRole('combobox', { name: 'Select dimension' }),
  ).toBeInTheDocument();
  // In members mode, the value selector should also appear
  expect(
    screen.getByRole('combobox', { name: 'Select dimension values' }),
  ).toBeInTheDocument();
});

test('should show value selector in members mode when dimension is selected', () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: { result: ['USA', 'Canada'] },
  });

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="members"
    />,
  );

  expect(
    screen.getByRole('combobox', { name: 'Select dimension values' }),
  ).toBeInTheDocument();
});

test('should load dimension values from API in members mode', async () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: { result: ['USA', 'Canada', 'Mexico'] },
  });

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="members"
    />,
  );

  await waitFor(() => {
    expect(SupersetClient.get).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      endpoint: '/api/v1/datasource/table/1/column/country/values/',
    });
  });
});

test('should handle API errors gracefully in members mode', async () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  (SupersetClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="members"
    />,
  );

  await waitFor(() => {
    expect(SupersetClient.get).toHaveBeenCalled();
  });
});

test('should not show value selector in topn mode', () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="topn"
    />,
  );

  expect(
    screen.queryByRole('combobox', { name: 'Select dimension values' }),
  ).not.toBeInTheDocument();
});

test('should fetch TopN values when all params are provided', async () => {
  const mockFetchTopNValues = fetchTopNValues as jest.MockedFunction<
    typeof fetchTopNValues
  >;
  const onChange = jest.fn();
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  mockFetchTopNValues.mockResolvedValue([
    { value: 'USA', metricValue: 1000 },
    { value: 'Canada', metricValue: 800 },
  ]);

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      onChange={onChange}
      selectionMode="topn"
      topNMetric="revenue"
      topNValue={2}
      topNOrder="DESC"
    />,
  );

  await waitFor(() => {
    expect(mockFetchTopNValues).toHaveBeenCalledWith({
      datasource: '1__table',
      column: 'country',
      metric: 'revenue',
      limit: 2,
      sortAscending: false,
      filters: [],
      timeRange: undefined,
    });
  });
});

test('should show loading state while fetching TopN values', () => {
  const mockFetchTopNValues = fetchTopNValues as jest.MockedFunction<
    typeof fetchTopNValues
  >;
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  mockFetchTopNValues.mockImplementation(() => new Promise(() => {})); // Never resolves

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="topn"
      topNMetric="revenue"
      topNValue={5}
    />,
  );

  expect(screen.getByText('Loading top values...')).toBeInTheDocument();
});

test('should display error when TopN fetch fails', async () => {
  const mockFetchTopNValues = fetchTopNValues as jest.MockedFunction<
    typeof fetchTopNValues
  >;
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  mockFetchTopNValues.mockRejectedValue(new Error('Fetch failed'));

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="topn"
      topNMetric="revenue"
      topNValue={5}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('Error: Fetch failed')).toBeInTheDocument();
  });
});

test('should convert string topNValue to number', async () => {
  const mockFetchTopNValues = fetchTopNValues as jest.MockedFunction<
    typeof fetchTopNValues
  >;
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  mockFetchTopNValues.mockResolvedValue([]);

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      selectionMode="topn"
      topNMetric="revenue"
      topNValue={'10' as any} // String instead of number
      topNOrder="ASC"
    />,
  );

  await waitFor(() => {
    expect(fetchTopNValues).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10, // Should be converted to number
        sortAscending: true,
      }),
    );
  });
});

test('should not load values for datasource without filter_select', () => {
  const datasourceNoFilter = {
    ...mockDatasource,
    filter_select: false,
  };

  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: [],
  };

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      datasource={datasourceNoFilter}
      value={value}
      selectionMode="members"
    />,
  );

  expect(SupersetClient.get).not.toHaveBeenCalled();
});

test('should handle empty dimension value', () => {
  const value: MatrixifyDimensionControlValue = {
    dimension: '',
    values: [],
  };

  render(<MatrixifyDimensionControl {...defaultProps} value={value} />);

  expect(
    screen.queryByRole('combobox', { name: 'Select dimension values' }),
  ).not.toBeInTheDocument();
});

test('should handle undefined value prop', () => {
  render(<MatrixifyDimensionControl {...defaultProps} value={undefined} />);

  expect(
    screen.getByRole('combobox', { name: 'Select dimension' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('combobox', { name: 'Select dimension values' }),
  ).not.toBeInTheDocument();
});

test('should handle datasources without columns', () => {
  const datasourceWithoutColumns = {
    ...mockDatasource,
    columns: [],
  };

  render(
    <MatrixifyDimensionControl
      {...defaultProps}
      datasource={datasourceWithoutColumns}
    />,
  );

  expect(
    screen.getByRole('combobox', { name: 'Select dimension' }),
  ).toBeInTheDocument();
});

test('should clear values when switching from topn to members mode', async () => {
  const onChange = jest.fn();
  const value: MatrixifyDimensionControlValue = {
    dimension: 'country',
    values: ['USA', 'Canada'],
  };

  const { rerender } = render(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      onChange={onChange}
      selectionMode="topn"
    />,
  );

  rerender(
    <MatrixifyDimensionControl
      {...defaultProps}
      value={value}
      onChange={onChange}
      selectionMode="members"
    />,
  );

  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith({
      dimension: 'country',
      values: [],
      topNValues: [],
    });
  });
});

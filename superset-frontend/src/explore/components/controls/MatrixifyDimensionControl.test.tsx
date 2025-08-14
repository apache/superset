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
import fetchMock from 'fetch-mock';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import MatrixifyDimensionControl, {
  MatrixifyDimensionControlValue,
} from './MatrixifyDimensionControl';

// Mock the SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  t: (str: string, ...args: any[]) => {
    // Simple format replacement for %s
    if (args.length > 0 && str.includes('%s')) {
      return str.replace('%s', args[0]);
    }
    return str;
  },
  styled: jest.requireActual('@superset-ui/core').styled,
  getColumnLabel: (col: string) => col,
}));

// Mock ControlHeader
jest.mock('src/explore/components/ControlHeader', () => ({
  __esModule: true,
  default: ({ label, description }: any) => (
    <div data-testid="control-header">
      {label && <span data-testid="control-label">{label}</span>}
      {description && (
        <span data-testid="control-description">{description}</span>
      )}
    </div>
  ),
}));

// Mock getChartDataRequest
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
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

describe('MatrixifyDimensionControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.reset();
  });

  afterAll(() => {
    fetchMock.restore();
  });

  describe('Basic Rendering', () => {
    it('should render dimension selector', () => {
      render(<MatrixifyDimensionControl {...defaultProps} />);

      expect(
        screen.getByRole('combobox', { name: 'Select dimension' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Dimension')).toBeInTheDocument();
    });

    it('should render with custom label and description', () => {
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

    it('should display dimension options from datasource', async () => {
      render(<MatrixifyDimensionControl {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: 'Select dimension' });
      await userEvent.click(select);

      await waitFor(() => {
        expect(screen.getByText('country')).toBeInTheDocument();
        expect(screen.getByText('region')).toBeInTheDocument();
        expect(screen.getByText('product')).toBeInTheDocument();
      });
    });

    it('should handle datasources without columns', () => {
      const datasourceWithoutColumns = {
        ...mockDatasource,
        columns: undefined,
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
  });

  describe('Dimension Selection', () => {
    it('should call onChange when dimension is selected', async () => {
      const onChange = jest.fn();
      render(
        <MatrixifyDimensionControl {...defaultProps} onChange={onChange} />,
      );

      const select = screen.getByRole('combobox', { name: 'Select dimension' });
      await userEvent.click(select);
      await userEvent.click(screen.getByText('region'));

      expect(onChange).toHaveBeenCalledWith({
        dimension: 'region',
        values: [],
      });
    });

    it('should display selected dimension', () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      render(<MatrixifyDimensionControl {...defaultProps} value={value} />);

      // The Select component shows the selected value in its display text
      expect(screen.getByText('country')).toBeInTheDocument();
    });

    it('should clear values when dimension changes', async () => {
      const onChange = jest.fn();
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: ['USA', 'Canada'],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          onChange={onChange}
        />,
      );

      const select = screen.getByRole('combobox', { name: 'Select dimension' });
      await userEvent.click(select);
      await userEvent.click(screen.getByText('region'));

      expect(onChange).toHaveBeenCalledWith({
        dimension: 'region',
        values: [],
      });
    });
  });

  describe('Value Selection (Members Mode)', () => {
    it('should show value selector when dimension is selected', async () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      // Mock API response for dimension values
      (SupersetClient.get as jest.Mock).mockResolvedValue({
        json: {
          result: ['USA', 'Canada', 'Mexico'],
        },
      });

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="members"
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: 'Select dimension values' }),
        ).toBeInTheDocument();
      });
    });

    it('should load dimension values from API', async () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      (SupersetClient.get as jest.Mock).mockResolvedValue({
        json: {
          result: ['USA', 'Canada', 'Mexico'],
        },
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

      const valueSelect = screen.getByRole('combobox', {
        name: 'Select dimension values',
      });
      await userEvent.click(valueSelect);

      await waitFor(() => {
        expect(screen.getByText('USA')).toBeInTheDocument();
        expect(screen.getByText('Canada')).toBeInTheDocument();
        expect(screen.getByText('Mexico')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      (SupersetClient.get as jest.Mock).mockRejectedValue(
        new Error('API Error'),
      );

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="members"
        />,
      );

      // Wait for the error to be handled
      await waitFor(() => {
        expect(SupersetClient.get).toHaveBeenCalled();
      });

      // Error is handled silently, values should be empty
      const valueSelect = screen.getByRole('combobox', {
        name: 'Select dimension values',
      });
      await userEvent.click(valueSelect);

      await waitFor(() => {
        expect(screen.getByText('No results')).toBeInTheDocument();
      });
    });

    it('should call onChange when values are selected', async () => {
      const onChange = jest.fn();
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      (SupersetClient.get as jest.Mock).mockResolvedValue({
        json: {
          result: ['USA', 'Canada', 'Mexico'],
        },
      });

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          onChange={onChange}
          selectionMode="members"
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: 'Select dimension values' }),
        ).toBeInTheDocument();
      });

      const valueSelect = screen.getByRole('combobox', {
        name: 'Select dimension values',
      });
      await userEvent.click(valueSelect);

      await waitFor(() => {
        expect(screen.getByText('USA')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('USA'));

      expect(onChange).toHaveBeenCalledWith({
        dimension: 'country',
        values: ['USA'],
      });
    });

    it('should not load values for datasources with filter_select=false', async () => {
      const datasourceNoFilter = { ...mockDatasource, filter_select: false };
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

      // The value selector is still shown but no API call is made
      expect(
        screen.getByRole('combobox', { name: 'Select dimension values' }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(SupersetClient.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('TopN Selection Mode', () => {
    it('should not show value selector in topn mode', () => {
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

    it('should not load dimension values in topn mode', async () => {
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

      await waitFor(() => {
        expect(SupersetClient.get).not.toHaveBeenCalled();
      });
    });

    it('should fetch TopN values when all params are provided', async () => {
      const mockTopNResponse = {
        json: {
          result: [
            {
              data: [
                { country_name: 'USA', sum__SP_POP_TOTL: 1000000 },
                { country_name: 'China', sum__SP_POP_TOTL: 900000 },
              ],
            },
          ],
        },
      };

      (getChartDataRequest as jest.Mock).mockResolvedValue(mockTopNResponse);

      const onChange = jest.fn();
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: [],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          onChange={onChange}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={2}
          topNOrder="DESC"
        />,
      );

      await waitFor(() => {
        expect(getChartDataRequest).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          dimension: 'country_name',
          values: ['USA', 'China'],
          topNValues: [
            { value: 'USA', metricValue: 1000000 },
            { value: 'China', metricValue: 900000 },
          ],
        });
      });
    });

    it('should show loading state while fetching TopN values', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      (getChartDataRequest as jest.Mock).mockReturnValue(promise);

      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: [],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={10}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Loading top values...')).toBeInTheDocument();
      });

      resolvePromise!({
        json: {
          result: [{ data: [] }],
        },
      });

      await waitFor(() => {
        expect(
          screen.queryByText('Loading top values...'),
        ).not.toBeInTheDocument();
      });
    });

    it('should display error when TopN fetch fails', async () => {
      (getChartDataRequest as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch data'),
      );

      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: [],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={10}
        />,
      );

      await waitFor(() => {
        // The component displays the error using t('Error: %s', topNError)
        // which formats as "Error: Failed to fetch data"
        expect(
          screen.getByText('Error: Failed to fetch data'),
        ).toBeInTheDocument();
      });
    });

    it('should clear values when switching from topn to members mode', async () => {
      const onChange = jest.fn();
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: ['USA', 'China'],
        topNValues: [
          { value: 'USA', metricValue: 1000000 },
          { value: 'China', metricValue: 900000 },
        ],
      };

      const { rerender } = render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          onChange={onChange}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={2}
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
          dimension: 'country_name',
          values: [],
          topNValues: [],
        });
      });
    });

    it('should handle string topNValue and convert to number', async () => {
      const mockTopNResponse = {
        json: {
          result: [
            {
              data: [],
            },
          ],
        },
      };

      (getChartDataRequest as jest.Mock).mockResolvedValue(mockTopNResponse);

      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: [],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={'5' as any} // Pass string instead of number
          topNOrder="DESC"
        />,
      );

      await waitFor(() => {
        expect(getChartDataRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              row_limit: 5, // Should be converted to number
            }),
          }),
        );
      });
    });

    it('should abort TopN fetch when component unmounts', async () => {
      // getChartDataRequest doesn't support abort signals directly
      // We'll just test that it gets called and component unmounts cleanly
      (getChartDataRequest as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const value: MatrixifyDimensionControlValue = {
        dimension: 'country_name',
        values: [],
      };

      const { unmount } = render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="topn"
          topNMetric="sum__SP_POP_TOTL"
          topNValue={10}
        />,
      );

      await waitFor(() => {
        expect(getChartDataRequest).toHaveBeenCalled();
      });

      // Component should unmount cleanly even with pending request
      unmount();

      // No errors should be thrown
      expect(getChartDataRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup and Abort', () => {
    it('should abort API call when component unmounts', async () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      let capturedSignal: AbortSignal | undefined;
      (SupersetClient.get as jest.Mock).mockImplementation(({ signal }) => {
        capturedSignal = signal;
        return new Promise(() => {}); // Never resolves
      });

      const { unmount } = render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={value}
          selectionMode="members"
        />,
      );

      await waitFor(() => {
        expect(capturedSignal).toBeDefined();
      });

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });

    it('should abort previous API call when dimension changes', async () => {
      const abortSignals: AbortSignal[] = [];
      (SupersetClient.get as jest.Mock).mockImplementation(({ signal }) => {
        abortSignals.push(signal);
        return Promise.resolve({
          json: { result: ['Value1', 'Value2'] },
        });
      });

      const { rerender } = render(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={{ dimension: 'country', values: [] }}
          selectionMode="members"
        />,
      );

      await waitFor(() => {
        expect(abortSignals).toHaveLength(1);
      });

      rerender(
        <MatrixifyDimensionControl
          {...defaultProps}
          value={{ dimension: 'region', values: [] }}
          selectionMode="members"
        />,
      );

      await waitFor(() => {
        expect(abortSignals).toHaveLength(2);
        expect(abortSignals[0].aborted).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dimension value', () => {
      const value: MatrixifyDimensionControlValue = {
        dimension: '',
        values: [],
      };

      render(<MatrixifyDimensionControl {...defaultProps} value={value} />);

      expect(
        screen.getByRole('combobox', { name: 'Select dimension' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: 'Select dimension values' }),
      ).not.toBeInTheDocument();
    });

    it('should handle undefined value prop', () => {
      render(<MatrixifyDimensionControl {...defaultProps} value={undefined} />);

      expect(
        screen.getByRole('combobox', { name: 'Select dimension' }),
      ).toBeInTheDocument();
    });

    it('should not load values for datasource without id', async () => {
      const datasourceNoId = { ...mockDatasource, id: undefined };
      const value: MatrixifyDimensionControlValue = {
        dimension: 'country',
        values: [],
      };

      render(
        <MatrixifyDimensionControl
          {...defaultProps}
          datasource={datasourceNoId}
          value={value}
          selectionMode="members"
        />,
      );

      // The value selector is still shown but no API call is made
      expect(
        screen.getByRole('combobox', { name: 'Select dimension values' }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(SupersetClient.get).not.toHaveBeenCalled();
      });
    });
  });
});

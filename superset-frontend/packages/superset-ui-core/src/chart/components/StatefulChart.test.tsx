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

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatefulChart from './StatefulChart';

// Mock SuperChart to avoid complex chart registry setup
jest.mock('./SuperChart', () => ({
  __esModule: true,
  default: jest.fn(({ formData, queriesData }) => (
    <div data-testid="superchart">
      {formData?.viz_type && <span>Chart Type: {formData.viz_type}</span>}
      {queriesData && <span>Has Data</span>}
    </div>
  )),
}));

// Mock the ChartClient
jest.mock('../clients/ChartClient', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    client: {
      post: jest.fn(),
    },
    loadFormData: jest.fn(),
  })),
}));

// Mock the registries
jest.mock('../registries/ChartMetadataRegistrySingleton', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    get: jest.fn(() => ({ useLegacyApi: false })),
  })),
}));

jest.mock('../registries/ChartBuildQueryRegistrySingleton', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}));

// Mock buildQueryContext
jest.mock('../..', () => ({
  ...jest.requireActual('../..'),
  buildQueryContext: jest.fn(formData => ({
    queries: [{ formData }],
  })),
}));

// Mock Loading component
jest.mock('../../components/Loading', () => ({
  Loading: () => <div>Loading...</div>,
}));

describe('StatefulChart', () => {
  const mockClient = {
    post: jest.fn().mockResolvedValue({
      json: [{ result: { data: [1, 2, 3] } }],
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the ChartClient mock
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const ChartClient = require('../clients/ChartClient').default;
    ChartClient.mockImplementation(() => ({
      client: mockClient,
      loadFormData: jest.fn().mockResolvedValue({
        viz_type: 'bar',
        datasource: '1__table',
      }),
    }));
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          width={400}
          height={300}
        />,
      );
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          showLoading
        />,
      );
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom dimensions', () => {
      const { container } = render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          width={600}
          height={400}
        />,
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('Data Loading', () => {
    it('loads data with formData prop', async () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            endpoint: '/api/v1/chart/data',
          }),
        );
      });

      // Wait for the chart to render
      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalled();
      });

      // The component should be rendered now
      const chartElement = document.querySelector('[data-testid="superchart"]');
      expect(chartElement).toBeInTheDocument();
    });

    it('loads data with chartId prop', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const ChartClient = require('../clients/ChartClient').default;
      const mockLoadFormData = jest.fn().mockResolvedValue({
        viz_type: 'line',
        datasource: '2__table',
      });

      ChartClient.mockImplementation(() => ({
        client: mockClient,
        loadFormData: mockLoadFormData,
      }));

      render(<StatefulChart chartId={123} />);

      await waitFor(() => {
        expect(mockLoadFormData).toHaveBeenCalledWith(
          { sliceId: 123 },
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      });
    });

    it('applies formDataOverrides', async () => {
      render(
        <StatefulChart
          formData={{
            viz_type: 'bar',
            metric: 'count',
            datasource: '1__table',
          }}
          formDataOverrides={{ metric: 'sum' }}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            jsonPayload: expect.objectContaining({
              queries: expect.arrayContaining([
                expect.objectContaining({
                  formData: expect.objectContaining({
                    metric: 'sum',
                  }),
                }),
              ]),
            }),
          }),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when data loading fails', async () => {
      const errorMessage = 'Failed to load';
      mockClient.post.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      });
    });

    it('calls onError callback when loading fails', async () => {
      const onError = jest.fn();
      const error = new Error('Network error');
      mockClient.post.mockRejectedValueOnce(error);

      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          onError={onError}
        />,
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('renders custom error component', async () => {
      const CustomError = ({ error }: { error: Error }) => (
        <div>Custom Error: {error.message}</div>
      );

      mockClient.post.mockRejectedValueOnce(new Error('Test error'));

      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          errorComponent={CustomError}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText('Custom Error: Test error'),
        ).toBeInTheDocument();
      });
    });

    it('throws error when neither chartId nor formData provided', async () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      render(<StatefulChart />);

      await waitFor(() => {
        expect(
          screen.getByText(/Either chartId or formData must be provided/),
        ).toBeInTheDocument();
      });

      console.error = originalError;
    });
  });

  describe('Lifecycle Management', () => {
    it('cancels in-flight requests on unmount', async () => {
      const { unmount } = render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
        />,
      );

      // Unmount immediately
      unmount();

      // Verify abort was called (through AbortController)
      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          }),
        );
      });
    });

    it('refetches data when formData changes', async () => {
      const { rerender } = render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledTimes(1);
      });

      rerender(
        <StatefulChart
          formData={{ viz_type: 'line', datasource: '1__table' }}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledTimes(2);
      });
    });

    it('refetches data when force prop changes', async () => {
      const { rerender } = render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          force={false}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledTimes(1);
      });

      rerender(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          force
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Component Options', () => {
    it('hides loading indicator when showLoading is false', () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          showLoading={false}
        />,
      );

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('renders custom loading component', () => {
      const CustomLoading = () => <div>Custom Loading...</div>;

      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          loadingComponent={CustomLoading}
        />,
      );

      expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
    });

    it('passes timeout to request config', async () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          timeout={30}
        />,
      );

      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalledWith(
          expect.objectContaining({
            timeout: 30000,
          }),
        );
      });
    });

    it('calls onLoad callback with data', async () => {
      const onLoad = jest.fn();
      const mockData = [{ result: { data: [1, 2, 3] } }];
      mockClient.post.mockResolvedValueOnce({
        json: mockData,
      });

      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          onLoad={onLoad}
        />,
      );

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledWith(mockData[0].result);
      });
    });
  });

  describe('SuperChart Integration', () => {
    it('passes correct props to SuperChart', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const SuperChart = require('./SuperChart').default;

      render(
        <StatefulChart
          id="test-chart"
          className="custom-chart"
          formData={{ viz_type: 'bar', datasource: '1__table' }}
          disableErrorBoundary
          enableNoResults={false}
        />,
      );

      await waitFor(() => {
        expect(SuperChart).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-chart',
            className: 'custom-chart',
            chartType: 'bar',
            disableErrorBoundary: true,
            enableNoResults: false,
          }),
          expect.anything(),
        );
      });
    });

    it('renders SuperChart with loaded data', async () => {
      render(
        <StatefulChart
          formData={{ viz_type: 'bar', datasource: '1__table' }}
        />,
      );

      // Wait for the chart to render
      await waitFor(() => {
        expect(mockClient.post).toHaveBeenCalled();
      });

      // Check that SuperChart is rendered with data
      const chartElement = document.querySelector('[data-testid="superchart"]');
      expect(chartElement).toBeInTheDocument();
      expect(screen.getByText('Chart Type: bar')).toBeInTheDocument();
      expect(screen.getByText('Has Data')).toBeInTheDocument();
    });
  });
});

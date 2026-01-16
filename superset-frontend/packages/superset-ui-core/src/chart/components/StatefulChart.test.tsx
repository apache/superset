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

import { render, waitFor, configure } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatefulChart from './StatefulChart';
import getChartControlPanelRegistry from '../registries/ChartControlPanelRegistrySingleton';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../registries/ChartBuildQueryRegistrySingleton';

// Configure testing library to use data-test attribute
configure({ testIdAttribute: 'data-test' });

// Mock the registries
jest.mock('../registries/ChartControlPanelRegistrySingleton');
jest.mock('../registries/ChartMetadataRegistrySingleton');
jest.mock('../registries/ChartBuildQueryRegistrySingleton');
jest.mock('../clients/ChartClient');

// Mock SuperChart component
jest.mock('./SuperChart', () => ({
  __esModule: true,
  // eslint-disable-next-line react/display-name
  default: ({ formData }: any) => (
    <div data-test="super-chart">SuperChart: {JSON.stringify(formData)}</div>
  ),
}));

// Mock Loading component
jest.mock('../../components/Loading', () => ({
  // eslint-disable-next-line react/display-name
  Loading: () => <div data-test="loading">Loading...</div>,
}));

const mockChartClient = {
  client: {
    post: jest.fn().mockResolvedValue({
      json: [{ data: 'test data' }],
    }),
  },
  loadFormData: jest.fn(),
};

const mockFormData = {
  viz_type: 'test_chart',
  datasource: '1__table',
  color_scheme: 'default',
};

beforeEach(() => {
  jest.clearAllMocks();

  // Setup default registry mocks
  (getChartMetadataRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue({
      useLegacyApi: false,
    }),
  });

  (getChartBuildQueryRegistry as any).mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
  });

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(null),
  });

  // Mock ChartClient constructor
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const ChartClient = require('../clients/ChartClient').default; // eslint-disable-line
  ChartClient.mockImplementation(() => mockChartClient);
});

test('should refetch data when non-renderTrigger control changes', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          [
            {
              name: 'color_scheme',
              config: {
                renderTrigger: true,
              },
            },
          ],
          [
            {
              name: 'datasource',
              config: {
                renderTrigger: false,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change a non-renderTrigger control (datasource)
  const updatedFormData = {
    ...mockFormData,
    datasource: '2__table',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch data
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should NOT refetch data when only renderTrigger controls change', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          [
            {
              name: 'color_scheme',
              config: {
                renderTrigger: true,
              },
            },
          ],
          [
            {
              name: 'show_legend',
              config: {
                renderTrigger: true,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender, getByTestId } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Verify initial render
  expect(getByTestId('super-chart')).toBeInTheDocument();

  // Change only renderTrigger controls
  const updatedFormData = {
    ...mockFormData,
    color_scheme: 'new_scheme',
    show_legend: true,
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should NOT refetch data (still only 1 call)
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
    // But should re-render with new formData
    expect(getByTestId('super-chart')).toHaveTextContent(
      JSON.stringify(updatedFormData),
    );
  });
});

test('should refetch when control panel config is not available', async () => {
  // No control panel config available
  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(null),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change any control
  const updatedFormData = {
    ...mockFormData,
    color_scheme: 'new_scheme',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch data (conservative approach when no config)
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should refetch when viz_type changes', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          [
            {
              name: 'color_scheme',
              config: {
                renderTrigger: true,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change viz_type
  const updatedFormData = {
    ...mockFormData,
    viz_type: 'different_chart',
  };

  rerender(
    <StatefulChart formData={updatedFormData} chartType="different_chart" />,
  );

  await waitFor(() => {
    // Should always refetch when viz_type changes
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should handle mixed renderTrigger and non-renderTrigger changes', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          [
            {
              name: 'color_scheme',
              config: {
                renderTrigger: true,
              },
            },
          ],
          [
            {
              name: 'metrics',
              config: {
                renderTrigger: false,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change both renderTrigger and non-renderTrigger controls
  const updatedFormData = {
    ...mockFormData,
    color_scheme: 'new_scheme', // renderTrigger
    metrics: ['new_metric'], // non-renderTrigger
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch because a non-renderTrigger control changed
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should handle controls with complex structure', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          [
            {
              config: {
                name: 'nested_control',
                renderTrigger: true,
              },
            },
          ],
          [
            {
              name: 'direct_control',
              config: {
                renderTrigger: true,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender, getByTestId } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change controls that have different config structures
  const updatedFormData = {
    ...mockFormData,
    nested_control: 'value1',
    direct_control: 'value2',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should NOT refetch (both are renderTrigger)
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // But should re-render
  expect(getByTestId('super-chart')).toHaveTextContent(
    JSON.stringify(updatedFormData),
  );
});

test('should not refetch when formData has not changed', async () => {
  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Re-render with same formData
  rerender(<StatefulChart formData={mockFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should not refetch
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });
});

test('should handle errors gracefully when accessing registry', async () => {
  // Mock registry to throw an error
  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockImplementation(() => {
      throw new Error('Registry error');
    }),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change a control
  const updatedFormData = {
    ...mockFormData,
    color_scheme: 'new_scheme',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch data (conservative approach on error)
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should handle force prop correctly', async () => {
  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Re-render with force=true
  rerender(
    <StatefulChart formData={mockFormData} chartType="test_chart" force />,
  );

  await waitFor(() => {
    // Should refetch when force changes
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should handle chartId changes', async () => {
  mockChartClient.loadFormData.mockResolvedValue(mockFormData);

  const { rerender } = render(
    <StatefulChart chartId={1} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.loadFormData).toHaveBeenCalledTimes(1);
  });

  // Change chartId
  rerender(<StatefulChart chartId={2} chartType="test_chart" />);

  await waitFor(() => {
    // Should load new formData
    expect(mockChartClient.loadFormData).toHaveBeenCalledTimes(2);
  });
});

test('should NOT refetch data when string-based renderTrigger control (zoomable) changes', async () => {
  // Control panel with zoomable as a string reference (like ['zoomable'] in control panels)
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          ['zoomable'], // String reference to shared control
          [
            {
              name: 'metrics',
              config: {
                renderTrigger: false,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const formDataWithZoom = {
    ...mockFormData,
    zoomable: false,
  };

  const { rerender, getByTestId } = render(
    <StatefulChart formData={formDataWithZoom} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Toggle zoomable (string-based shared control with renderTrigger: true)
  const updatedFormData = {
    ...formDataWithZoom,
    zoomable: true,
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should NOT refetch data - zoomable is a renderTrigger control
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
    // But should re-render with new formData
    expect(getByTestId('super-chart')).toHaveTextContent(
      JSON.stringify(updatedFormData),
    );
  });
});

test('should NOT refetch data when other string-based renderTrigger controls change', async () => {
  // Test other controls in RENDER_TRIGGER_SHARED_CONTROLS set
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          ['color_scheme'], // String reference
          ['y_axis_format'], // String reference
          ['currency_format'], // String reference
          ['time_shift_color'], // String reference
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender, getByTestId } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change multiple string-based renderTrigger controls
  const updatedFormData = {
    ...mockFormData,
    color_scheme: 'new_scheme',
    y_axis_format: '.2f',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should NOT refetch data
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
    // But should re-render
    expect(getByTestId('super-chart')).toHaveTextContent(
      JSON.stringify(updatedFormData),
    );
  });
});

test('should refetch when string control is NOT in RENDER_TRIGGER_SHARED_CONTROLS', async () => {
  // Control panel with a string control that is NOT in the renderTrigger set
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          ['some_unknown_control'], // Not in RENDER_TRIGGER_SHARED_CONTROLS
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const { rerender } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change the unknown control
  const updatedFormData = {
    ...mockFormData,
    some_unknown_control: 'new_value',
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch because the control is not recognized as renderTrigger
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
});

test('should handle mixed string and object controls correctly', async () => {
  // Control panel with both string references and object definitions
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          ['zoomable'], // String reference (in RENDER_TRIGGER_SHARED_CONTROLS)
          [
            {
              name: 'minorTicks',
              config: {
                renderTrigger: true,
              },
            },
          ], // Object definition
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const formDataWithControls = {
    ...mockFormData,
    zoomable: false,
    minorTicks: false,
  };

  const { rerender, getByTestId } = render(
    <StatefulChart formData={formDataWithControls} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change both string-based and object-based renderTrigger controls
  const updatedFormData = {
    ...formDataWithControls,
    zoomable: true,
    minorTicks: true,
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should NOT refetch - both are renderTrigger controls
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
    // But should re-render
    expect(getByTestId('super-chart')).toHaveTextContent(
      JSON.stringify(updatedFormData),
    );
  });
});

test('should refetch when mixing renderTrigger string control with non-renderTrigger change', async () => {
  const controlPanelConfig = {
    controlPanelSections: [
      {
        controlSetRows: [
          ['zoomable'], // String reference (renderTrigger)
          [
            {
              name: 'metrics',
              config: {
                renderTrigger: false,
              },
            },
          ],
        ],
      },
    ],
  };

  (getChartControlPanelRegistry as any).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  });

  const formDataWithZoom = {
    ...mockFormData,
    zoomable: false,
    metrics: ['metric1'],
  };

  const { rerender } = render(
    <StatefulChart formData={formDataWithZoom} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change both zoomable (renderTrigger) and metrics (non-renderTrigger)
  const updatedFormData = {
    ...formDataWithZoom,
    zoomable: true,
    metrics: ['metric2'],
  };

  rerender(<StatefulChart formData={updatedFormData} chartType="test_chart" />);

  await waitFor(() => {
    // Should refetch because metrics changed (non-renderTrigger)
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });
  
test('should display error message when HTTP request fails with Response object', async () => {
  const errorBody = JSON.stringify({ message: 'Error: division by zero' });
  const mockResponse = new Response(errorBody, {
    status: 400,
    statusText: 'Bad Request',
    headers: { 'Content-Type': 'application/json' },
  });
  mockChartClient.client.post.mockRejectedValue(mockResponse);

  const onError = jest.fn();
  const { findByText } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      onError={onError}
    />,
  );

  const errorElement = await findByText(/Error: division by zero/i);
  expect(errorElement).toBeInTheDocument();

  await waitFor(() => {
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('Error: division by zero');
  });
});

test('should display error message when HTTP request fails with errors array', async () => {
  const errorBody = JSON.stringify({
    errors: [
      {
        message: 'Query failed: column "invalid_col" does not exist',
        error_type: 'COLUMN_DOES_NOT_EXIST_ERROR',
      },
    ],
  });
  const mockResponse = new Response(errorBody, {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: { 'Content-Type': 'application/json' },
  });
  mockChartClient.client.post.mockRejectedValue(mockResponse);

  const { findByText } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  const errorElement = await findByText(
    /Query failed: column "invalid_col" does not exist/i,
  );
  expect(errorElement).toBeInTheDocument();
});

test('should display generic error message for network failures', async () => {
  const networkError = new TypeError('Failed to fetch');
  mockChartClient.client.post.mockRejectedValue(networkError);

  const { findByText } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  const errorElement = await findByText(/Network error/i);
  expect(errorElement).toBeInTheDocument();
});

test('should pass error to custom errorComponent when provided', async () => {
  const errorBody = JSON.stringify({ message: 'Custom error message' });
  const mockResponse = new Response(errorBody, {
    status: 400,
    statusText: 'Bad Request',
    headers: { 'Content-Type': 'application/json' },
  });
  mockChartClient.client.post.mockRejectedValue(mockResponse);

  const CustomErrorComponent = ({ error }: { error: Error }) => (
    <div data-test="custom-error">Custom: {error.message}</div>
  );

  const { findByTestId } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      errorComponent={CustomErrorComponent}
    />,
  );

  const customError = await findByTestId('custom-error');
  expect(customError).toBeInTheDocument();
  expect(customError).toHaveTextContent('Custom: Custom error message');
});

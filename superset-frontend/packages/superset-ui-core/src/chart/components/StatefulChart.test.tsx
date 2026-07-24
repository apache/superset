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

import { render, waitFor, configure, act } from '@testing-library/react';
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
  jest.mocked(getChartMetadataRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue({}),
  } as unknown as ReturnType<typeof getChartMetadataRegistry>);

  jest.mocked(getChartBuildQueryRegistry).mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
  } as unknown as ReturnType<typeof getChartBuildQueryRegistry>);

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(null),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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
  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(null),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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
  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockImplementation(() => {
      throw new Error('Registry error');
    }),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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

  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue(controlPanelConfig),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);

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
});

test('resolves async (202) responses via the injected handleAsyncChartData hook', async () => {
  const asyncJob = {
    channel_id: 'c1',
    job_id: 'j1',
    status: 'running',
    result_url: '/api/v1/chart/data/abc',
  };
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: asyncJob,
  });
  const handleAsyncChartData = jest
    .fn()
    .mockResolvedValue([{ data: 'async result' }]);

  const { getByTestId } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
    />,
  );

  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });
  // Delegates the raw response + job metadata (and the abort signal)
  expect(handleAsyncChartData).toHaveBeenCalledWith(
    { status: 202 },
    asyncJob,
    expect.any(AbortSignal),
  );
  // Chart renders once the async data resolves
  await waitFor(() => {
    expect(getByTestId('super-chart')).toBeInTheDocument();
  });
});

test('errors on async (202) response when no async handler is provided', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j1', channel_id: 'c1', status: 'running' },
  });
  const onError = jest.fn();

  const { findByText } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      onError={onError}
    />,
  );

  // Fails loudly instead of rendering the job metadata as empty data
  expect(await findByText(/async handler/i)).toBeInTheDocument();
  await waitFor(() => {
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

test('renders synchronous (200) responses that include a response object', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 200 } as Response,
    json: [{ result: [{ data: 'sync result' }] }],
  });

  const { getByTestId } = render(
    <StatefulChart formData={mockFormData} chartType="test_chart" />,
  );

  await waitFor(() => {
    expect(getByTestId('super-chart')).toBeInTheDocument();
  });
  // Synchronous path: no async handler needed, single request
  expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
});

test('does not apply a superseded async response over a newer one', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  let resolveFirst: (data: unknown) => void = () => {};
  let resolveSecond: (data: unknown) => void = () => {};
  const handleAsyncChartData = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSecond = resolve;
        }),
    );
  const onLoad = jest.fn();

  const { rerender } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
      onLoad={onLoad}
    />,
  );

  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });

  // A newer request supersedes the first (viz_type change forces a refetch)
  const newFormData = { ...mockFormData, viz_type: 'different_chart' };
  rerender(
    <StatefulChart
      formData={newFormData}
      chartType="different_chart"
      hooks={{ handleAsyncChartData }}
      onLoad={onLoad}
    />,
  );

  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(2);
  });

  // Resolve the newer request first, then the stale one
  await act(async () => {
    resolveSecond([{ data: 'B' }]);
  });
  await act(async () => {
    resolveFirst([{ data: 'A' }]);
  });

  await waitFor(() => {
    expect(onLoad).toHaveBeenCalledWith([{ data: 'B' }]);
  });
  // The stale (superseded) response must not overwrite the newer one
  expect(onLoad).not.toHaveBeenCalledWith([{ data: 'A' }]);
  expect(onLoad).toHaveBeenCalledTimes(1);
});

test('preserves the detailed message from an async (array) rejection', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  const handleAsyncChartData = jest
    .fn()
    .mockRejectedValue([{ error: 'Async query failed: table not found' }]);
  const onError = jest.fn();

  const { findByText } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
      onError={onError}
    />,
  );

  // The detailed message survives instead of collapsing to the generic one
  expect(await findByText(/table not found/i)).toBeInTheDocument();
  await waitFor(() => {
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain('table not found');
  });
});

test('refetches with the latest formData rather than the initial props', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 200 } as Response,
    json: [{ result: [{ data: 'x' }] }],
  });

  const { rerender } = render(
    <StatefulChart
      formData={{ ...mockFormData, metrics: ['metric_v1'] }}
      chartType="test_chart"
    />,
  );
  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
  });

  // Change a data-affecting control -> triggers a refetch
  rerender(
    <StatefulChart
      formData={{ ...mockFormData, metrics: ['metric_v2'] }}
      chartType="test_chart"
    />,
  );
  await waitFor(() => {
    expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
  });

  // The second request must carry the updated formData, not the initial props
  const secondRequestConfig = mockChartClient.client.post.mock.calls[1][0];
  expect(JSON.stringify(secondRequestConfig)).toContain('metric_v2');
  expect(JSON.stringify(secondRequestConfig)).not.toContain('metric_v1');
});

test('does not revert a render-only change when a slow async request resolves', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  // color_scheme is a renderTrigger control -> its change does not refetch
  jest.mocked(getChartControlPanelRegistry).mockReturnValue({
    get: jest.fn().mockReturnValue({
      controlPanelSections: [
        {
          controlSetRows: [
            [{ name: 'color_scheme', config: { renderTrigger: true } }],
          ],
        },
      ],
    }),
  } as unknown as ReturnType<typeof getChartControlPanelRegistry>);
  let resolveAsync: (data: unknown) => void = () => {};
  const handleAsyncChartData = jest.fn(
    () =>
      new Promise(resolve => {
        resolveAsync = resolve;
      }),
  );

  const { rerender, getByTestId } = render(
    <StatefulChart
      formData={{ ...mockFormData, color_scheme: 'scheme_one' }}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
    />,
  );
  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });

  // Render-only change while the async request is still pending (no refetch)
  rerender(
    <StatefulChart
      formData={{ ...mockFormData, color_scheme: 'scheme_two' }}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
    />,
  );
  expect(handleAsyncChartData).toHaveBeenCalledTimes(1);

  // The stale request resolves; it must not revert color_scheme back
  await act(async () => {
    resolveAsync([{ data: 'd' }]);
  });

  await waitFor(() => {
    expect(getByTestId('super-chart')).toHaveTextContent('scheme_two');
  });
  expect(getByTestId('super-chart')).not.toHaveTextContent('scheme_one');
});

test('passes an abort signal to the async handler and aborts it on unmount', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  // Typed with a rest param so mock.calls is indexable (the 4th arg is the signal)
  const handleAsyncChartData = jest.fn(
    (..._args: unknown[]) => new Promise<never>(() => {}), // never resolves
  );

  const { unmount } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
    />,
  );

  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });
  const signal = handleAsyncChartData.mock.calls[0][2] as AbortSignal;
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal.aborted).toBe(false);

  // Unmounting aborts the signal so a signal-aware handler can stop polling
  unmount();
  expect(signal.aborted).toBe(true);
});

test('suppresses stale error state from a superseded request', async () => {
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  let rejectFirst: (err: unknown) => void = () => {};
  const handleAsyncChartData = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    )
    .mockImplementationOnce(() => new Promise(() => {})); // newer request stays pending
  const onError = jest.fn();

  const { rerender } = render(
    <StatefulChart
      formData={mockFormData}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
      onError={onError}
    />,
  );
  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });

  // Supersede the first request (aborts its controller)
  rerender(
    <StatefulChart
      formData={{ ...mockFormData, viz_type: 'different_chart' }}
      chartType="different_chart"
      hooks={{ handleAsyncChartData }}
      onError={onError}
    />,
  );
  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(2);
  });

  // The stale request now fails; its error must not surface
  await act(async () => {
    rejectFirst(new Error('stale failure'));
  });
  expect(onError).not.toHaveBeenCalled();
});

test('does not publish stale data when switching from chartId to formData mode', async () => {
  mockChartClient.loadFormData.mockResolvedValue({ ...mockFormData });
  mockChartClient.client.post.mockResolvedValue({
    response: { status: 202 } as Response,
    json: { job_id: 'j', channel_id: 'c' },
  });
  let resolveFirst: (data: unknown) => void = () => {};
  const handleAsyncChartData = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
    )
    .mockImplementationOnce(() => new Promise(() => {}));
  const onLoad = jest.fn();

  // Start in chartId mode
  const { rerender } = render(
    <StatefulChart
      chartId={1}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
      onLoad={onLoad}
    />,
  );
  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(1);
  });

  // Switch to direct-formData mode
  rerender(
    <StatefulChart
      formData={{ ...mockFormData, metrics: ['m'] }}
      chartType="test_chart"
      hooks={{ handleAsyncChartData }}
      onLoad={onLoad}
    />,
  );
  await waitFor(() => {
    expect(handleAsyncChartData).toHaveBeenCalledTimes(2);
  });

  // The stale chartId-mode request resolves; its data must not be published
  await act(async () => {
    resolveFirst([{ data: 'stale' }]);
  });
  expect(onLoad).not.toHaveBeenCalledWith([{ data: 'stale' }]);
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

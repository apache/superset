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
import StatefulChart from '../../../src/chart/components/StatefulChart';
import getChartControlPanelRegistry from '../../../src/chart/registries/ChartControlPanelRegistrySingleton';
import getChartMetadataRegistry from '../../../src/chart/registries/ChartMetadataRegistrySingleton';
import getChartBuildQueryRegistry from '../../../src/chart/registries/ChartBuildQueryRegistrySingleton';

// Configure testing library to use data-test attribute
configure({ testIdAttribute: 'data-test' });

// Mock the registries
jest.mock('../../../src/chart/registries/ChartControlPanelRegistrySingleton');
jest.mock('../../../src/chart/registries/ChartMetadataRegistrySingleton');
jest.mock('../../../src/chart/registries/ChartBuildQueryRegistrySingleton');
jest.mock('../../../src/chart/clients/ChartClient');

// Mock SuperChart component
jest.mock('../../../src/chart/components/SuperChart', () => ({
  __esModule: true,
  // eslint-disable-next-line react/display-name
  default: ({ formData }: any) => {
    // eslint-disable-next-line no-restricted-syntax, global-require, @typescript-eslint/no-var-requires
    const React = require('react');
    return (
      <div data-test="super-chart">SuperChart: {JSON.stringify(formData)}</div>
    );
  },
}));

// Mock Loading component
jest.mock('../../../src/components/Loading', () => ({
  // eslint-disable-next-line react/display-name
  Loading: () => {
    // eslint-disable-next-line no-restricted-syntax, global-require, @typescript-eslint/no-var-requires
    const React = require('react');
    return <div data-test="loading">Loading...</div>;
  },
}));

describe('StatefulChart', () => {
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
    const ChartClient =
      require('../../../src/chart/clients/ChartClient').default;
    ChartClient.mockImplementation(() => mockChartClient);
  });

  describe('shouldRefetchData logic', () => {
    it('should refetch data when non-renderTrigger control changes', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should refetch data
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT refetch data when only renderTrigger controls change', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should NOT refetch data (still only 1 call)
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
        // But should re-render with new formData
        expect(getByTestId('super-chart')).toHaveTextContent(
          JSON.stringify(updatedFormData),
        );
      });
    });

    it('should refetch when control panel config is not available', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should refetch data (conservative approach when no config)
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch when viz_type changes', async () => {
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
        <StatefulChart
          formData={updatedFormData}
          chartType="different_chart"
        />,
      );

      await waitFor(() => {
        // Should always refetch when viz_type changes
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle mixed renderTrigger and non-renderTrigger changes', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should refetch because a non-renderTrigger control changed
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle controls with complex structure', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should NOT refetch (both are renderTrigger)
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
      });

      // But should re-render
      expect(getByTestId('super-chart')).toHaveTextContent(
        JSON.stringify(updatedFormData),
      );
    });

    it('should not refetch when formData has not changed', async () => {
      const { rerender } = render(
        <StatefulChart formData={mockFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
      });

      // Re-render with same formData
      rerender(
        <StatefulChart formData={mockFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should not refetch
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle errors gracefully when accessing registry', async () => {
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

      rerender(
        <StatefulChart formData={updatedFormData} chartType="test_chart" />,
      );

      await waitFor(() => {
        // Should refetch data (conservative approach on error)
        expect(mockChartClient.client.post).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('other StatefulChart functionality', () => {
    it('should handle force prop correctly', async () => {
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

    it('should handle chartId changes', async () => {
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
  });
});

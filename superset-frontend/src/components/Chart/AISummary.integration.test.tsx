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
import { FeatureFlag } from '@superset-ui/core';
import { ThemeProvider } from '@emotion/react';
import { supersetTheme } from '@superset-ui/core';
import ChartRenderer from './ChartRenderer';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock SuperChart
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ formData }) => (
    <div data-test="mock-super-chart">{JSON.stringify(formData)}</div>
  ),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('./ChartContextMenu/ChartContextMenu', () => () => (
  <div data-test="mock-chart-context-menu" />
));

const mockIsFeatureEnabled = require('@superset-ui/core').isFeatureEnabled;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    search: '?currency_code=USD&timezone=America/New_York',
  },
  writable: true,
});

const baseProps = {
  chartId: 123,
  datasource: { id: 1, type: 'table' },
  formData: {
    viz_type: 'line',
    time_range: 'Last 90 days',
    adhoc_filters: [
      { column: 'region', operator: '==', value: 'North America' },
    ],
  },
  vizType: 'line',
  height: 400,
  width: 600,
  title: 'Sales Performance Dashboard',
  description: 'A comprehensive analysis of sales performance trends across different regions and time periods',
  queriesResponse: [
    {
      data: [
        { date: '2024-01-01', sales: 10000, region: 'North America' },
        { date: '2024-01-02', sales: 12000, region: 'North America' },
        { date: '2024-01-03', sales: 11500, region: 'North America' },
      ],
    },
  ],
};

const mockSuccessResponse = {
  ok: true,
  json: async () => ({
    data: {
      result: {
        insight: 'This line chart displays sales performance over the last 90 days for North America, showing a positive growth trend with sales increasing from $10,000 to $12,000.',
      },
    },
  }),
};

describe('AI Summary Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();

    // Enable AI summary feature flag
    mockIsFeatureEnabled.mockImplementation((flag) => {
      if (flag === FeatureFlag.AiSummary) return true;
      return false;
    });
  });

  afterEach(() => {
    mockIsFeatureEnabled.mockReset();
  });

  it('should complete end-to-end flow from ChartRenderer to AI API with title and description', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...baseProps} />
      </ThemeProvider>,
    );

    // Wait for the AI summary to be generated and displayed
    await waitFor(
      () => {
        expect(screen.getByText(/This line chart displays sales performance/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify the API was called with correct payload
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.intelligence.fynd.com/service/panel/analytics/ai/sql-helper/explain-chart',
      expect.objectContaining({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chart_data: {
            vizType: 'line',
            dataSample: [
              { date: '2024-01-01', sales: 10000, region: 'North America' },
              { date: '2024-01-02', sales: 12000, region: 'North America' },
              { date: '2024-01-03', sales: 11500, region: 'North America' },
            ],
            title: 'Sales Performance Dashboard',
            description: 'A comprehensive analysis of sales performance trends across different regions and time periods',
            currency_code: 'USD',
            timezone: 'America/New_York',
          },
        }),
        credentials: 'include',
      }),
    );

    // Verify the AI summary is displayed with proper styling
    const aiSummary = screen.getByText(/This line chart displays sales performance/);
    expect(aiSummary).toBeInTheDocument();

    // Verify AI icon is present
    expect(screen.getByLabelText('AI')).toBeInTheDocument();
  });

  it('should handle missing description gracefully', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

    const propsWithoutDescription = { ...baseProps };
    delete propsWithoutDescription.description;

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...propsWithoutDescription} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify API was called with undefined description
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          chart_data: expect.objectContaining({
            title: 'Sales Performance Dashboard',
            description: undefined,
          }),
        }),
      }),
    );
  });

  it('should handle missing title correctly', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

    const propsWithoutTitle = {
      ...baseProps,
      title: undefined,
    };

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...propsWithoutTitle} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          chart_data: expect.objectContaining({
            title: undefined,
          }),
        }),
      }),
    );
  });

  it('should handle API errors gracefully without breaking the chart', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...baseProps} />
      </ThemeProvider>,
    );

    // Chart should still render even if AI summary fails
    await waitFor(() => {
      expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
    });

    // AI summary should not be displayed on error
    expect(screen.queryByText(/This line chart displays/)).not.toBeInTheDocument();
  });

  it('should handle large datasets by limiting to 200 rows', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

    // Create a large dataset (300 rows)
    const largeDataset = Array.from({ length: 300 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      sales: 10000 + i * 100,
      region: 'North America',
    }));

    const propsWithLargeDataset = {
      ...baseProps,
      queriesResponse: [{ data: largeDataset }],
    };

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...propsWithLargeDataset} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify only 200 rows were sent to API
    const call = mockFetch.mock.calls[0];
    const payload = JSON.parse(call[1].body);
    expect(payload.chart_data.dataSample).toHaveLength(200);
  });

  it('should regenerate summary when description prop changes', async () => {
    mockFetch.mockResolvedValue(mockSuccessResponse as any);

    const { rerender } = render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...baseProps} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change description and rerender
    const updatedProps = {
      ...baseProps,
      description: 'Updated description with new insights about the data',
    };

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...updatedProps} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verify the new description was sent
    const secondCall = mockFetch.mock.calls[1];
    const payload = JSON.parse(secondCall[1].body);
    expect(payload.chart_data.description).toBe('Updated description with new insights about the data');
  });

  it('should include all URL parameters in API call', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

    // Update window location with more parameters
    Object.defineProperty(window, 'location', {
      value: {
        search: '?currency_code=EUR&timezone=Europe/London&country_code=GB&country=United Kingdom',
      },
      writable: true,
    });

    render(
      <ThemeProvider theme={supersetTheme}>
        <ChartRenderer {...baseProps} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          chart_data: expect.objectContaining({
            currency_code: 'EUR',
            timezone: 'Europe/London',
            country_code: 'GB',
            country: 'United Kingdom',
          }),
        }),
      }),
    );
  });
});

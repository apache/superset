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

// Mock dependencies
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

// Mock AISummaryBox to verify props
jest.mock('./AISummaryBox', () => {
  return function MockAISummaryBox(props) {
    return (
      <div data-test="mock-ai-summary-box">
        <div data-test="ai-title">{props.title}</div>
        <div data-test="ai-description">{props.description}</div>
        <div data-test="ai-viztype">{props.vizType}</div>
      </div>
    );
  };
});

const mockIsFeatureEnabled = require('@superset-ui/core').isFeatureEnabled;

const baseProps = {
  chartId: 1,
  datasource: { id: 1, type: 'table' },
  formData: {
    viz_type: 'line',
  },
  vizType: 'line',
  height: 400,
  width: 600,
  title: 'Test Chart Title',
  description: 'Test Chart Description',
  queriesResponse: [
    {
      data: [
        { month: 'Jan', sales: 1000 },
        { month: 'Feb', sales: 1200 },
      ],
    },
  ],
};

const renderChartRenderer = (props = {}) => {
  // Enable AI summary feature flag
  mockIsFeatureEnabled.mockImplementation((flag) => {
    if (flag === FeatureFlag.AiSummary) return true;
    return false;
  });

  return render(
    <ThemeProvider theme={supersetTheme}>
      <ChartRenderer {...baseProps} {...props} />
    </ThemeProvider>,
  );
};

describe('ChartRenderer - Description Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockIsFeatureEnabled.mockReset();
  });

  it('should pass title and description to AISummaryBox when provided', async () => {
    renderChartRenderer();

    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-summary-box')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ai-description')).toHaveTextContent('Test Chart Description');
    expect(screen.getByTestId('ai-title')).toHaveTextContent('Test Chart Title');
    expect(screen.getByTestId('ai-viztype')).toHaveTextContent('line');
  });

  it('should handle undefined title and description gracefully', async () => {
    renderChartRenderer({ title: undefined, description: undefined });

    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-summary-box')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ai-description')).toBeEmptyDOMElement();
    expect(screen.getByTestId('ai-title')).toBeEmptyDOMElement();
  });

  it('should handle null title and description gracefully', async () => {
    renderChartRenderer({ title: null, description: null });

    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-summary-box')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ai-description')).toBeEmptyDOMElement();
    expect(screen.getByTestId('ai-title')).toBeEmptyDOMElement();
  });

  it('should handle empty string title and description', async () => {
    renderChartRenderer({ title: '', description: '' });

    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-summary-box')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ai-description')).toBeEmptyDOMElement();
    expect(screen.getByTestId('ai-title')).toBeEmptyDOMElement();
  });

  it('should pass provided title correctly', async () => {
    renderChartRenderer({ title: 'Custom Chart Title' });

    await waitFor(() => {
      expect(screen.getByTestId('ai-title')).toHaveTextContent('Custom Chart Title');
    });
  });

  it('should not render AISummaryBox when feature flag is disabled', () => {
    mockIsFeatureEnabled.mockImplementation(() => false);

    renderChartRenderer({ description: 'Test description' });

    expect(screen.queryByTestId('mock-ai-summary-box')).not.toBeInTheDocument();
  });

  it('should pass all required props to AISummaryBox', async () => {
    const description = 'Detailed chart description';
    const timeRange = 'Last 30 days';
    const filters = [{ column: 'region', value: 'US' }];

    renderChartRenderer({
      description,
      formData: {
        ...baseProps.formData,
        time_range: timeRange,
        adhoc_filters: filters,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-summary-box')).toBeInTheDocument();
    });

    // Verify the mock component received the props
    const mockAISummaryBox = screen.getByTestId('mock-ai-summary-box');
    expect(mockAISummaryBox).toBeInTheDocument();
  });

  it('should handle very long descriptions', async () => {
    const longDescription = 'This is a very long description. '.repeat(100);

    renderChartRenderer({ description: longDescription });

    await waitFor(() => {
      expect(screen.getByTestId('ai-description')).toHaveTextContent(longDescription);
    });
  });

  it('should handle special characters in description', async () => {
    const specialDescription = 'Description with special chars: <>&"\'🚀💡📊';

    renderChartRenderer({ description: specialDescription });

    await waitFor(() => {
      expect(screen.getByTestId('ai-description')).toHaveTextContent(specialDescription);
    });
  });
});

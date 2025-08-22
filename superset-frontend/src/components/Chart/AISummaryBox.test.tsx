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

import { render, screen, waitFor, fireEvent } from 'spec/helpers/testing-library';
import { ThemeProvider } from '@emotion/react';
import { supersetTheme } from '@superset-ui/core';
import AISummaryBox from './AISummaryBox';
import * as aiSummary from '../../utils/aiSummary';

// Mock the aiSummary module
jest.mock('../../utils/aiSummary', () => ({
  generateSummary: jest.fn(),
  extractRawDataSample: jest.fn(),
}));

const mockGenerateSummary = aiSummary.generateSummary as jest.MockedFunction<
  typeof aiSummary.generateSummary
>;
const mockExtractRawDataSample = aiSummary.extractRawDataSample as jest.MockedFunction<
  typeof aiSummary.extractRawDataSample
>;

const defaultProps = {
  chartDomId: 'chart-id-123',
  vizType: 'line',
  title: 'Sales Trends',
  description: 'Monthly sales data showing growth trends',
  queriesData: [
    {
      data: [
        { month: 'Jan', sales: 1000 },
        { month: 'Feb', sales: 1200 },
        { month: 'Mar', sales: 1500 },
      ],
    },
  ],
  timeRange: 'Last 3 months',
  filters: { region: 'North America' },
};

const renderComponent = (props = {}) => {
  return render(
    <ThemeProvider theme={supersetTheme}>
      <AISummaryBox {...defaultProps} {...props} />
    </ThemeProvider>,
  );
};

describe('AISummaryBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractRawDataSample.mockReturnValue([
      { month: 'Jan', sales: 1000 },
      { month: 'Feb', sales: 1200 },
      { month: 'Mar', sales: 1500 },
    ]);
  });

  it('should show loading state initially', () => {
    mockGenerateSummary.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderComponent();

    expect(screen.getByLabelText('AI')).toBeInTheDocument();
    expect(screen.getAllByRole('generic')).toHaveLength(6); // Skeleton lines
  });

  it('should call generateSummary with title and description', async () => {
    const mockSummary = 'This chart shows strong sales growth over the first quarter.';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent();

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith(
        {
          vizType: 'line',
          title: 'Sales Trends',
          description: 'Monthly sales data showing growth trends',
          dataSample: [
            { month: 'Jan', sales: 1000 },
            { month: 'Feb', sales: 1200 },
            { month: 'Mar', sales: 1500 },
          ],
          imageBase64: undefined,
          timeRange: 'Last 3 months',
          filters: { region: 'North America' },
        },
        {
          mode: 'data',
          signal: expect.any(AbortSignal),
        },
      );
    });
  });

  it('should display AI summary when successful', async () => {
    const mockSummary = 'This chart shows strong sales growth over the first quarter.';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(mockSummary)).toBeInTheDocument();
    });

    expect(screen.getByLabelText('AI')).toBeInTheDocument();
  });

  it('should handle undefined title and description', async () => {
    const mockSummary = 'Chart analysis without title or description.';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent({ title: undefined, description: undefined });

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          title: undefined,
          description: undefined,
        }),
        expect.any(Object),
      );
    });
  });

  it('should handle empty description gracefully', async () => {
    const mockSummary = 'Chart analysis with empty description.';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent({ description: '' });

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '',
        }),
        expect.any(Object),
      );
    });
  });

  it('should not display anything on error', async () => {
    mockGenerateSummary.mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalled();
    });

    // Component should not render anything when there's an error
    expect(screen.queryByText(/chart/i)).not.toBeInTheDocument();
  });

  it('should regenerate summary when description changes', async () => {
    const mockSummary1 = 'First summary';
    const mockSummary2 = 'Updated summary with new description';
    mockGenerateSummary
      .mockResolvedValueOnce(mockSummary1)
      .mockResolvedValueOnce(mockSummary2);

    const { rerender } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText(mockSummary1)).toBeInTheDocument();
    });

    // Update description
    rerender(
      <ThemeProvider theme={supersetTheme}>
        <AISummaryBox
          {...defaultProps}
          description="Updated description with more details"
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledTimes(2);
      expect(mockGenerateSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({
          description: 'Updated description with more details',
        }),
        expect.any(Object),
      );
    });
  });

  it('should regenerate summary when title changes', async () => {
    const mockSummary = 'Summary with updated title';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    const { rerender } = renderComponent();

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    });

    // Update title
    rerender(
      <ThemeProvider theme={supersetTheme}>
        <AISummaryBox {...defaultProps} title="Updated Chart Title" />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledTimes(2);
      expect(mockGenerateSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Updated Chart Title',
        }),
        expect.any(Object),
      );
    });
  });

  it('should handle long summaries with expand/collapse', async () => {
    const longSummary = 'This is a very long summary that should be truncated. '.repeat(20);
    mockGenerateSummary.mockResolvedValue(longSummary);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(longSummary)).toBeInTheDocument();
    });

    // Should show expand button for long text
    const expandButton = screen.getByTitle('view more');
    expect(expandButton).toBeInTheDocument();

    // Click expand
    fireEvent.click(expandButton);

    // Should show collapse button
    expect(screen.getByTitle('view less')).toBeInTheDocument();
  });

  it('should use image mode when no data sample available', async () => {
    mockExtractRawDataSample.mockReturnValue(null);
    const mockSummary = 'Summary based on chart image';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent();

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSample: null,
        }),
        expect.objectContaining({
          mode: 'image',
        }),
      );
    });
  });

  it('should call onHeightChange when provided', async () => {
    const mockOnHeightChange = jest.fn();
    const mockSummary = 'Test summary';
    mockGenerateSummary.mockResolvedValue(mockSummary);

    renderComponent({ onHeightChange: mockOnHeightChange });

    await waitFor(() => {
      expect(mockOnHeightChange).toHaveBeenCalled();
    });
  });

  it('should abort previous requests when props change', async () => {
    let abortController: AbortController;
    mockGenerateSummary.mockImplementation((input, options) => {
      if (options?.signal) {
        abortController = { abort: jest.fn() } as any;
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve('summary');
    });

    const { rerender } = renderComponent();

    // Change a prop to trigger new request
    rerender(
      <ThemeProvider theme={supersetTheme}>
        <AISummaryBox {...defaultProps} title="New Title" />
      </ThemeProvider>,
    );

    // First request should be aborted
    expect(mockGenerateSummary).toHaveBeenCalledTimes(2);
  });
});

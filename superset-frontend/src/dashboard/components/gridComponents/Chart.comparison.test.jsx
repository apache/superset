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

import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { createStore } from 'redux';
import { ThemeProvider } from '@superset-ui/core';
import Chart from './Chart';
import * as getBigNumberComparisonDataModule from '../../util/getBigNumberComparisonData';

// Mock console methods to avoid noise in tests
const originalConsole = console;
beforeAll(() => {
  console.group = jest.fn();
  console.log = jest.fn();
  console.groupEnd = jest.fn();
});

afterAll(() => {
  console.group = originalConsole.group;
  console.log = originalConsole.log;
  console.groupEnd = originalConsole.groupEnd;
});

// Mock the utility function
const mockGetBigNumberComparisonData = jest.spyOn(
  getBigNumberComparisonDataModule,
  'getBigNumberComparisonData'
);

// Mock ChartContainer to avoid complex rendering
jest.mock('src/components/Chart/ChartContainer', () => {
  return function MockChartContainer() {
    return <div data-test="chart-container">Chart Container</div>;
  };
});

// Mock SliceHeader to verify props are passed correctly
const MockSliceHeader = jest.fn(({ bigNumberComparisonData }) => (
  <div data-test="slice-header" data-comparison={JSON.stringify(bigNumberComparisonData)}>
    Slice Header
  </div>
));

jest.mock('../SliceHeader', () => MockSliceHeader);

// Mock theme
const mockTheme = {
  colors: {
    primary: { base: '#1890ff' },
    grayscale: { light5: '#fafafa' },
  },
  typography: {
    sizes: { s: 12 },
    weights: { medium: 500 },
    families: { sansSerif: 'Arial, sans-serif' },
  },
  gridUnit: 4,
  borderRadius: 4,
};

// Mock store
const mockStore = createStore(() => ({}));

const defaultProps = {
  id: 1,
  componentId: 'test-component',
  dashboardId: 1,
  width: 400,
  height: 300,
  chart: {
    chartStatus: 'success',
    queriesResponse: [],
    chartUpdateEndTime: Date.now(),
  },
  slice: {
    slice_id: 1,
    slice_name: 'Test Chart',
    viz_type: 'big_number_total',
  },
  datasource: { id: 1 },
  formData: { viz_type: 'big_number_total' },
  filters: {},
  updateSliceName: jest.fn(),
  sliceName: 'Test Chart',
  toggleExpandSlice: jest.fn(),
  timeout: 30,
  supersetCanExplore: true,
  supersetCanShare: true,
  supersetCanCSV: true,
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  ownState: {},
  filterState: {},
  handleToggleFullSize: jest.fn(),
  isFullSize: false,
  setControlValue: jest.fn(),
  postTransformProps: {},
  datasetsStatus: 'complete',
  isInView: true,
  emitCrossFilters: jest.fn(),
  logEvent: jest.fn(),
  isExpanded: false,
  editMode: false,
  labelsColor: {},
  labelsColorMap: {},
};

const renderChart = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };
  
  return render(
    <Provider store={mockStore}>
      <Router>
        <ThemeProvider theme={mockTheme}>
          <Chart {...finalProps} />
        </ThemeProvider>
      </Router>
    </Provider>
  );
};

describe('Chart Component BigNumber Comparison Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockSliceHeader.mockClear();
  });

  describe('Comparison data extraction', () => {
    it('should call getBigNumberComparisonData with correct parameters', () => {
      const queriesResponse = [
        {
          data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 80 }],
          colnames: ['Gross Sale', 'Gross Sale__1 day ago'],
        },
      ];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale' };
      
      mockGetBigNumberComparisonData.mockReturnValue({
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      });

      renderChart({
        chart: { ...defaultProps.chart, queriesResponse },
        formData,
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        queriesResponse,
        formData
      );
    });

    it('should pass comparison data to SliceHeader', () => {
      const comparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      mockGetBigNumberComparisonData.mockReturnValue(comparisonData);

      renderChart();

      expect(MockSliceHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          bigNumberComparisonData: comparisonData,
        }),
        {}
      );
    });

    it('should pass null comparison data when no data available', () => {
      mockGetBigNumberComparisonData.mockReturnValue(null);

      renderChart();

      expect(MockSliceHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          bigNumberComparisonData: null,
        }),
        {}
      );
    });
  });

  describe('Different chart types', () => {
    it('should extract comparison data for big_number_total charts', () => {
      const formData = { viz_type: 'big_number_total' };
      
      renderChart({ formData });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        expect.any(Array),
        formData
      );
    });

    it('should extract comparison data for big_number charts', () => {
      const formData = { viz_type: 'big_number' };
      
      renderChart({
        formData,
        slice: { ...defaultProps.slice, viz_type: 'big_number' },
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        expect.any(Array),
        formData
      );
    });

    it('should still call extraction function for non-BigNumber charts', () => {
      const formData = { viz_type: 'table' };
      
      renderChart({
        formData,
        slice: { ...defaultProps.slice, viz_type: 'table' },
      });

      // Function should still be called, but will return null internally
      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        expect.any(Array),
        formData
      );
    });
  });

  describe('Chart status handling', () => {
    it('should extract comparison data even when chart is loading', () => {
      renderChart({
        chart: { ...defaultProps.chart, chartStatus: 'loading' },
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalled();
    });

    it('should extract comparison data when chart has error', () => {
      renderChart({
        chart: { ...defaultProps.chart, chartStatus: 'failed' },
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalled();
    });

    it('should extract comparison data when chart is successful', () => {
      renderChart({
        chart: { ...defaultProps.chart, chartStatus: 'success' },
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle getBigNumberComparisonData throwing an error', () => {
      mockGetBigNumberComparisonData.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw and should render without comparison data
      expect(() => renderChart()).not.toThrow();
      
      expect(MockSliceHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          bigNumberComparisonData: undefined, // Will be undefined due to error
        }),
        {}
      );
    });

    it('should handle missing queriesResponse gracefully', () => {
      renderChart({
        chart: { ...defaultProps.chart, queriesResponse: undefined },
      });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        undefined,
        expect.any(Object)
      );
    });

    it('should handle missing formData gracefully', () => {
      renderChart({ formData: undefined });

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledWith(
        expect.any(Array),
        undefined
      );
    });
  });

  describe('Performance considerations', () => {
    it('should only call getBigNumberComparisonData once per render', () => {
      renderChart();

      expect(mockGetBigNumberComparisonData).toHaveBeenCalledTimes(1);
    });

    it('should call getBigNumberComparisonData on every render (no memoization)', () => {
      const { rerender } = renderChart();
      
      // Re-render with same props
      rerender(
        <Provider store={mockStore}>
          <Router>
            <ThemeProvider theme={mockTheme}>
              <Chart {...defaultProps} />
            </ThemeProvider>
          </Router>
        </Provider>
      );

      // Should be called twice (once for each render)
      expect(mockGetBigNumberComparisonData).toHaveBeenCalledTimes(2);
    });
  });
});

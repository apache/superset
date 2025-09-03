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
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { createStore } from 'redux';
import SliceHeader from './index';
import { BigNumberComparisonData } from '../../util/getBigNumberComparisonData';

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

// Mock theme
const mockTheme = {
  colors: {
    primary: { base: '#1890ff' },
    grayscale: {
      light2: '#f5f5f5',
      light4: '#d9d9d9',
      light5: '#fafafa',
    },
    text: { label: '#666' },
  },
  typography: {
    sizes: { s: 12, m: 14, l: 16 },
    weights: { medium: 500, bold: 600 },
    families: { sansSerif: 'Arial, sans-serif' },
  },
  gridUnit: 4,
  borderRadius: 4,
};

// Mock store
const mockStore = createStore(() => ({
  dashboardState: {},
  dashboardInfo: { crossFiltersEnabled: false },
  dataMask: {},
}));

// Mock UiConfigContext
jest.mock('src/components/UiConfigContext', () => ({
  useUiConfig: () => ({ hideChartControls: false }),
}));

// Mock DashboardPageIdContext
jest.mock('src/dashboard/containers/DashboardPage', () => ({
  DashboardPageIdContext: React.createContext('test-dashboard-id'),
}));

const defaultProps = {
  slice: {
    slice_id: 1,
    slice_name: 'Test BigNumber Chart',
    viz_type: 'big_number_total',
    description: 'Test description',
  },
  componentId: 'test-component',
  dashboardId: 1,
  chartStatus: 'success',
  formData: { viz_type: 'big_number_total' },
  width: 400,
  height: 300,
  filters: {},
  isCached: [false],
  cachedDttm: [null],
  isExpanded: false,
  supersetCanExplore: true,
  supersetCanShare: true,
  supersetCanCSV: true,
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  handleToggleFullSize: jest.fn(),
  isFullSize: false,
  forceRefresh: jest.fn(),
  updateSliceName: jest.fn(),
  toggleExpandSlice: jest.fn(),
  logExploreChart: jest.fn(),
  exportCSV: jest.fn(),
  exportXLSX: jest.fn(),
  exportPivotCSV: jest.fn(),
  exportFullCSV: jest.fn(),
  exportFullXLSX: jest.fn(),
};

const renderSliceHeader = (props = {}, comparisonData?: BigNumberComparisonData | null) => {
  const finalProps = {
    ...defaultProps,
    ...props,
    bigNumberComparisonData: comparisonData,
  };

  return render(
    <Provider store={mockStore}>
      <Router>
        <ThemeProvider theme={mockTheme}>
          <SliceHeader {...finalProps} />
        </ThemeProvider>
      </Router>
    </Provider>
  );
};

describe('SliceHeader BigNumber Comparison Integration', () => {
  describe('Comparison indicator rendering', () => {
    it('should not render comparison indicator when no comparison data provided', () => {
      renderSliceHeader();
      
      // Should not find any comparison indicator elements
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('↘')).not.toBeInTheDocument();
      expect(screen.queryByText('−')).not.toBeInTheDocument();
    });

    it('should render positive comparison indicator correctly', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('should render negative comparison indicator correctly', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: -0.358,
        comparisonIndicator: 'negative',
        previousPeriodValue: 65945361.96,
        currentValue: 42324187.71,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↘')).toBeInTheDocument();
      expect(screen.getByText('-35.8%')).toBeInTheDocument();
    });

    it('should render neutral comparison indicator correctly', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0,
        comparisonIndicator: 'neutral',
        previousPeriodValue: 100,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('−')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should handle NaN percentage change gracefully', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: NaN,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle undefined percentage change gracefully', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: undefined as any,
        comparisonIndicator: 'negative',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↘')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Tooltip functionality', () => {
    it('should have tooltip with comparison text', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      const indicator = screen.getByText('↗').closest('[title]');
      expect(indicator).toHaveAttribute('title', 'Period-over-period comparison');
    });
  });

  describe('Integration with other header elements', () => {
    it('should render comparison indicator alongside other header controls', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.15,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 92,
      };

      renderSliceHeader({}, comparisonData);
      
      // Should have the comparison indicator
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('15.0%')).toBeInTheDocument();
      
      // Should also have the slice name
      expect(screen.getByText('Test BigNumber Chart')).toBeInTheDocument();
    });

    it('should not render comparison indicator in edit mode', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({ editMode: true }, comparisonData);
      
      // Should not render comparison indicator in edit mode
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('25.0%')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should not render comparison indicator during loading', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'positive',
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({ chartStatus: 'loading' }, comparisonData);
      
      // Should not render comparison indicator during loading
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('25.0%')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large percentage changes', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 10.5, // 1050% increase
        comparisonIndicator: 'positive',
        previousPeriodValue: 10,
        currentValue: 115,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('1050.0%')).toBeInTheDocument();
    });

    it('should handle very small percentage changes', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.001, // 0.1% increase
        comparisonIndicator: 'positive',
        previousPeriodValue: 1000,
        currentValue: 1001,
      };

      renderSliceHeader({}, comparisonData);
      
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.1%')).toBeInTheDocument();
    });

    it('should handle invalid comparison indicator gracefully', () => {
      const comparisonData: BigNumberComparisonData = {
        percentageChange: 0.25,
        comparisonIndicator: 'invalid' as any,
        previousPeriodValue: 80,
        currentValue: 100,
      };

      renderSliceHeader({}, comparisonData);
      
      // Should not render any comparison indicator for invalid indicator
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('↘')).not.toBeInTheDocument();
      expect(screen.queryByText('−')).not.toBeInTheDocument();
    });
  });
});

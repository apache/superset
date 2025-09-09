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
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { ThemeProvider } from '@emotion/react';
import { BrowserRouter } from 'react-router-dom';
import { supersetTheme } from '@superset-ui/core';
import SliceHeaderControls from './index';

// Mock the required modules
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
  t: (str: string) => str,
}));

jest.mock('src/utils/findPermission', () => ({
  findPermission: jest.fn(() => true),
}));

const mockStore = createStore(() => ({
  user: { roles: {} },
  dashboardInfo: { metadata: {} },
  dataMask: {},
  charts: {},
}));

const defaultProps = {
  slice: {
    slice_id: 1,
    slice_name: 'Test Chart',
    viz_type: 'table',
    description: 'Test description',
  },
  componentId: 'test-component',
  dashboardId: 1,
  chartStatus: 'success' as const,
  formData: { viz_type: 'table' },
  width: 400,
  height: 300,
  filters: {},
  updateSliceName: jest.fn(),
  toggleExpandSlice: jest.fn(),
  forceRefresh: jest.fn(),
  exploreUrl: '/explore',
  supersetCanExplore: true,
  supersetCanShare: true,
  supersetCanCSV: true,
  exportCSV: jest.fn(),
  exportFullCSV: jest.fn(),
  exportXLSX: jest.fn(),
  exportFullXLSX: jest.fn(),
  handleToggleFullSize: jest.fn(),
  isDescriptionExpanded: false,
  isFullSize: false,
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  sliceName: 'Test Chart',
};

const renderWithProviders = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };
  return render(
    <BrowserRouter>
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          <SliceHeaderControls {...finalProps} />
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  );
};

describe('SliceHeaderControls Download Menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { isFeatureEnabled } = require('@superset-ui/core');
    isFeatureEnabled.mockImplementation((flag: string) => {
      if (flag === 'ENABLE_CHART_FORCE_REFRESH') return true;
      if (flag === 'ALLOW_FULL_CSV_EXPORT') return true;
      return false;
    });
  });

  describe('Default behavior (all options enabled)', () => {
    test('should render Download submenu when CSV permission exists', () => {
      renderWithProviders();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    test('should render all download options by default', () => {
      renderWithProviders();
      expect(screen.getByText('Export to .CSV')).toBeInTheDocument();
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
      expect(screen.getByText('Download as image')).toBeInTheDocument();
    });

    test('should render full export options for table charts', () => {
      renderWithProviders({
        formData: { viz_type: 'table' },
        slice: { ...defaultProps.slice, viz_type: 'table' },
      });
      expect(screen.getByText('Export to full .CSV')).toBeInTheDocument();
      expect(screen.getByText('Export to full Excel')).toBeInTheDocument();
    });
  });

  describe('Individual control disabling', () => {
    test('should hide CSV export when disabled', () => {
      renderWithProviders({
        formData: { ...defaultProps.formData, enable_export_csv: false },
      });
      expect(screen.queryByText('Export to .CSV')).not.toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument(); // Menu still visible
    });

    test('should hide Excel export when disabled', () => {
      renderWithProviders({
        formData: { ...defaultProps.formData, enable_export_excel: false },
      });
      expect(screen.queryByText('Export to Excel')).not.toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    test('should hide full CSV export when disabled', () => {
      renderWithProviders({
        formData: { ...defaultProps.formData, enable_export_full_csv: false },
        slice: { ...defaultProps.slice, viz_type: 'table' },
      });
      expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
      expect(screen.getByText('Export to full Excel')).toBeInTheDocument(); // Other full option still visible
    });

    test('should hide full Excel export when disabled', () => {
      renderWithProviders({
        formData: { ...defaultProps.formData, enable_export_full_excel: false },
        slice: { ...defaultProps.slice, viz_type: 'table' },
      });
      expect(screen.queryByText('Export to full Excel')).not.toBeInTheDocument();
      expect(screen.getByText('Export to full .CSV')).toBeInTheDocument();
    });

    test('should hide image download when disabled', () => {
      renderWithProviders({
        formData: { ...defaultProps.formData, enable_download_image: false },
      });
      expect(screen.queryByText('Download as image')).not.toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('Complete menu hiding', () => {
    test('should hide entire Download submenu when all options disabled', () => {
      renderWithProviders({
        formData: {
          ...defaultProps.formData,
          enable_export_csv: false,
          enable_export_excel: false,
          enable_export_full_csv: false,
          enable_export_full_excel: false,
          enable_download_image: false,
        },
      });
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    test('should hide Download submenu when no CSV permission', () => {
      renderWithProviders({ supersetCanCSV: false });
      expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });
  });

  describe('Feature flag interactions', () => {
    test('should not show full export options when feature flag disabled', () => {
      const { isFeatureEnabled } = require('@superset-ui/core');
      isFeatureEnabled.mockImplementation((flag: string) => {
        if (flag === 'ALLOW_FULL_CSV_EXPORT') return false;
        return flag === 'ENABLE_CHART_FORCE_REFRESH';
      });

      renderWithProviders({
        slice: { ...defaultProps.slice, viz_type: 'table' },
      });
      
      expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
      expect(screen.queryByText('Export to full Excel')).not.toBeInTheDocument();
      expect(screen.getByText('Export to .CSV')).toBeInTheDocument(); // Regular options still visible
    });
  });

  describe('Chart type interactions', () => {
    test('should not show full export options for non-table charts', () => {
      renderWithProviders({
        formData: { viz_type: 'line' },
        slice: { ...defaultProps.slice, viz_type: 'line' },
      });
      
      expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
      expect(screen.queryByText('Export to full Excel')).not.toBeInTheDocument();
      expect(screen.getByText('Export to .CSV')).toBeInTheDocument();
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });
  });
});

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
import { render, screen } from '@superset-ui/core/spec';
import { AgGridReact } from 'ag-grid-react';
import { createRef } from 'react';
import { ThemeProvider, supersetTheme } from '../../theme';
import { ThemedAgGridReact } from './index';
import * as themeUtils from '../../theme/utils/themeUtils';

// Mock useThemeMode hook
jest.mock('../../theme/utils/themeUtils', () => ({
  ...jest.requireActual('../../theme/utils/themeUtils'),
  useThemeMode: jest.fn(() => false), // Default to light mode
}));

// Mock ag-grid-react to avoid complex setup
jest.mock('ag-grid-react', () => ({
  AgGridReact: jest.fn(({ theme, ...props }) => (
    <div
      data-test="ag-grid-react"
      data-theme={JSON.stringify(theme)}
      {...props}
    >
      AgGrid Mock
    </div>
  )),
}));

// Mock ag-grid-community
jest.mock('ag-grid-community', () => ({
  themeQuartz: {
    withPart: jest.fn().mockReturnThis(),
    withParams: jest.fn(params => ({ ...params, _type: 'theme' })),
  },
  colorSchemeDark: { _type: 'dark' },
  colorSchemeLight: { _type: 'light' },
  AllCommunityModule: {},
  ClientSideRowModelModule: {},
  ModuleRegistry: { registerModules: jest.fn() },
}));

const mockRowData = [
  { id: 1, name: 'Test 1' },
  { id: 2, name: 'Test 2' },
];

const mockColumnDefs = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to light mode by default
  (themeUtils.useThemeMode as jest.Mock).mockReturnValue(false);
});

test('renders the AgGridReact component', () => {
  render(
    <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />,
  );

  expect(screen.getByTestId('ag-grid-react')).toBeInTheDocument();
});

test('applies light theme when background is light', () => {
  const lightTheme = {
    ...supersetTheme,
    colorBgBase: '#ffffff',
    colorText: '#000000',
  };

  render(
    <ThemeProvider theme={lightTheme}>
      <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
    </ThemeProvider>,
  );

  const agGrid = screen.getByTestId('ag-grid-react');
  const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

  expect(theme.browserColorScheme).toBe('light');
  expect(theme.foregroundColor).toBe('#000000');
});

test('applies dark theme when background is dark', () => {
  // Mock dark mode
  (themeUtils.useThemeMode as jest.Mock).mockReturnValue(true);

  const darkTheme = {
    ...supersetTheme,
    colorBgBase: '#1a1a1a',
    colorText: '#ffffff',
  };

  render(
    <ThemeProvider theme={darkTheme}>
      <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
    </ThemeProvider>,
  );

  const agGrid = screen.getByTestId('ag-grid-react');
  const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

  expect(theme.browserColorScheme).toBe('dark');
  expect(theme.foregroundColor).toBe('#ffffff');
});

test('forwards ref to AgGridReact', () => {
  const ref = createRef<AgGridReact>();

  render(
    <ThemedAgGridReact
      ref={ref}
      rowData={mockRowData}
      columnDefs={mockColumnDefs}
    />,
  );

  // Check that AgGridReact was called with the ref
  expect(AgGridReact).toHaveBeenCalledWith(
    expect.objectContaining({
      rowData: mockRowData,
      columnDefs: mockColumnDefs,
    }),
    expect.any(Object), // ref is passed as second argument
  );
});

test('passes all props through to AgGridReact', () => {
  const onGridReady = jest.fn();
  const onCellClicked = jest.fn();

  render(
    <ThemedAgGridReact
      rowData={mockRowData}
      columnDefs={mockColumnDefs}
      onGridReady={onGridReady}
      onCellClicked={onCellClicked}
      pagination
      paginationPageSize={10}
    />,
  );

  expect(AgGridReact).toHaveBeenCalledWith(
    expect.objectContaining({
      rowData: mockRowData,
      columnDefs: mockColumnDefs,
      onGridReady,
      onCellClicked,
      pagination: true,
      paginationPageSize: 10,
    }),
    expect.any(Object),
  );
});

test('applies custom theme colors from Superset theme', () => {
  const customTheme = {
    ...supersetTheme,
    colorFillTertiary: '#e5e5e5',
    colorSplit: '#d9d9d9',
  };

  render(
    <ThemeProvider theme={customTheme}>
      <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
    </ThemeProvider>,
  );

  const agGrid = screen.getByTestId('ag-grid-react');
  const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

  // Just verify a couple key theme properties are applied
  expect(theme.headerBackgroundColor).toBe('#e5e5e5');
  expect(theme.borderColor).toBe('#d9d9d9');
});

test('wraps component with proper container div', () => {
  const { container } = render(
    <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />,
  );

  const wrapper = container.querySelector('[data-themed-ag-grid="true"]');
  expect(wrapper).toBeInTheDocument();
  // Styles are now applied via css prop, not inline styles
  expect(wrapper).toHaveAttribute('data-themed-ag-grid', 'true');
});

test('handles missing theme gracefully', () => {
  const incompleteTheme = {
    ...supersetTheme,
    colorBgBase: undefined,
  };

  render(
    <ThemeProvider theme={incompleteTheme}>
      <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
    </ThemeProvider>,
  );

  // Should still render without crashing
  expect(screen.getByTestId('ag-grid-react')).toBeInTheDocument();
});

test('merges theme overrides with default theme parameters', () => {
  const themeOverrides = {
    fontSize: 16,
    headerBackgroundColor: '#custom-color',
  };

  render(
    <ThemedAgGridReact
      rowData={mockRowData}
      columnDefs={mockColumnDefs}
      themeOverrides={themeOverrides}
    />,
  );

  const agGrid = screen.getByTestId('ag-grid-react');
  const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

  // Custom overrides should be applied
  expect(theme.fontSize).toBe(16);
  expect(theme.headerBackgroundColor).toBe('#custom-color');

  // Default theme parameters should still be present
  expect(theme.foregroundColor).toBeDefined();
  expect(theme.borderColor).toBeDefined();
});

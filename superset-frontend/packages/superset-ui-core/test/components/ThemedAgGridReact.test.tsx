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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgGridReact } from 'ag-grid-react';
import { createRef } from 'react';
import { ThemeProvider, supersetTheme } from '../../src/theme';
import { ThemedAgGridReact } from '../../src/components/ThemedAgGridReact';

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

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));

describe('ThemedAgGridReact', () => {
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
  });

  it('renders the AgGridReact component', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('ag-grid-react')).toBeInTheDocument();
  });

  it('applies light theme when background is light', () => {
    const lightTheme = {
      ...supersetTheme,
      colorBgBase: '#ffffff',
      colorText: '#000000',
      colorFillTertiary: '#f0f0f0',
      colorFillQuaternary: '#f8f8f8',
      colorSplit: '#e0e0e0',
      fontSizeSM: 12,
    };

    render(
      <ThemeProvider theme={lightTheme}>
        <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
      </ThemeProvider>,
    );

    const agGrid = screen.getByTestId('ag-grid-react');
    const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

    expect(theme.backgroundColor).toBe('transparent');
    expect(theme.foregroundColor).toBe('#000000');
    expect(theme.browserColorScheme).toBe('light');
    expect(theme.headerBackgroundColor).toBe('#f0f0f0');
  });

  it('applies dark theme when background is dark', () => {
    const darkTheme = {
      ...supersetTheme,
      colorBgBase: '#1a1a1a',
      colorText: '#ffffff',
      colorFillTertiary: '#2a2a2a',
      colorFillQuaternary: '#333333',
      colorSplit: '#404040',
      fontSizeSM: 12,
    };

    render(
      <ThemeProvider theme={darkTheme}>
        <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
      </ThemeProvider>,
    );

    const agGrid = screen.getByTestId('ag-grid-react');
    const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

    expect(theme.backgroundColor).toBe('transparent');
    expect(theme.foregroundColor).toBe('#ffffff');
    expect(theme.browserColorScheme).toBe('dark');
    expect(theme.headerBackgroundColor).toBe('#2a2a2a');
  });

  it('forwards ref to AgGridReact', () => {
    const ref = createRef<AgGridReact>();

    render(
      <ThemeProvider theme={supersetTheme}>
        <ThemedAgGridReact
          ref={ref}
          rowData={mockRowData}
          columnDefs={mockColumnDefs}
        />
      </ThemeProvider>,
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

  it('passes all props through to AgGridReact', () => {
    const onGridReady = jest.fn();
    const onCellClicked = jest.fn();

    render(
      <ThemeProvider theme={supersetTheme}>
        <ThemedAgGridReact
          rowData={mockRowData}
          columnDefs={mockColumnDefs}
          onGridReady={onGridReady}
          onCellClicked={onCellClicked}
          pagination
          paginationPageSize={10}
        />
      </ThemeProvider>,
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

  it('applies correct theme colors from Superset theme', () => {
    const customTheme = {
      ...supersetTheme,
      colorBgBase: '#fafafa',
      colorText: '#1a1a1a',
      colorTextHeading: '#0a0a0a',
      colorFillTertiary: '#e5e5e5',
      colorFillQuaternary: '#f5f5f5',
      colorFillSecondary: '#d5d5d5',
      colorPrimary: '#1890ff',
      colorPrimaryBg: '#e6f7ff',
      colorBgContainer: '#ffffff',
      colorSplit: '#d9d9d9',
      colorTextPlaceholder: '#8c8c8c',
      fontFamily: 'Inter, sans-serif',
      fontSizeSM: 13,
      sizeUnit: 4,
    };

    render(
      <ThemeProvider theme={customTheme}>
        <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
      </ThemeProvider>,
    );

    const agGrid = screen.getByTestId('ag-grid-react');
    const theme = JSON.parse(agGrid.getAttribute('data-theme') || '{}');

    expect(theme.backgroundColor).toBe('transparent');
    expect(theme.foregroundColor).toBe('#1a1a1a');
    expect(theme.headerBackgroundColor).toBe('#e5e5e5');
    expect(theme.headerTextColor).toBe('#0a0a0a');
    expect(theme.oddRowBackgroundColor).toBe('#f5f5f5');
    expect(theme.rowHoverColor).toBe('#d5d5d5');
    expect(theme.selectedRowBackgroundColor).toBe('#e6f7ff');
    expect(theme.cellTextColor).toBe('#1a1a1a');
    expect(theme.borderColor).toBe('#d9d9d9');
    expect(theme.columnBorderColor).toBe('#d9d9d9');
    expect(theme.accentColor).toBe('#1890ff');
    expect(theme.rangeSelectionBorderColor).toBe('#1890ff');
    expect(theme.rangeSelectionBackgroundColor).toBe('#e6f7ff');
    expect(theme.inputBackgroundColor).toBe('#ffffff');
    expect(theme.inputBorderColor).toBe('#d9d9d9');
    expect(theme.inputTextColor).toBe('#1a1a1a');
    expect(theme.inputPlaceholderTextColor).toBe('#8c8c8c');
    expect(theme.fontFamily).toBe('Inter, sans-serif');
    expect(theme.fontSize).toBe(13);
    expect(theme.spacing).toBe(4);
  });

  it('wraps component with proper container div', () => {
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <ThemedAgGridReact rowData={mockRowData} columnDefs={mockColumnDefs} />
      </ThemeProvider>,
    );

    const wrapper = container.querySelector('[data-themed-ag-grid="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('superset-ag-grid-test-id-123');
    expect(wrapper).toHaveStyle({ width: '100%', height: '100%' });
  });

  it('handles missing theme gracefully', () => {
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
});

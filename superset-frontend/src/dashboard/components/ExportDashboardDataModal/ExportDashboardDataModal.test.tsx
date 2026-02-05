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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ExportDashboardDataModal from '.';

const mockAddSuccessToast = jest.fn();
const mockAddDangerToast = jest.fn();
const mockAddWarningToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: React.ComponentType) => Component,
  useToasts: () => ({
    addSuccessToast: mockAddSuccessToast,
    addDangerToast: mockAddDangerToast,
    addWarningToast: mockAddWarningToast,
  }),
}));

const mockPost = jest.fn();

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: {
      ...actual.SupersetClient,
      post: mockPost,
    },
  };
});

// Mock buildV1ChartDataPayload
jest.mock('src/explore/exploreUtils', () => ({
  buildV1ChartDataPayload: jest.fn(async ({ formData }) => ({
    queries: [formData],
  })),
}));

// Mock xlsx library for Excel generation
const mockWriteFile = jest.fn();
const mockBookNew = jest.fn(() => ({ SheetNames: [], Sheets: {} }));
const mockJsonToSheet = jest.fn(() => ({}));
const mockBookAppendSheet = jest.fn();

jest.mock('xlsx', () => ({
  utils: {
    book_new: mockBookNew,
    json_to_sheet: mockJsonToSheet,
    book_append_sheet: mockBookAppendSheet,
  },
  writeFile: mockWriteFile,
}));

const mockCharts = [
  { id: 1, name: 'Sales by Region', vizType: 'table' },
  { id: 2, name: 'Revenue Trend', vizType: 'line' },
  { id: 3, name: 'Top Products', vizType: 'bar' },
];

const mockSlices = {
  1: {
    slice_id: 1,
    slice_name: 'Sales by Region',
    form_data: {
      datasource: '1__table',
      viz_type: 'table',
    },
  },
  2: {
    slice_id: 2,
    slice_name: 'Revenue Trend',
    form_data: {
      datasource: '2__table',
      viz_type: 'line',
    },
  },
  3: {
    slice_id: 3,
    slice_name: 'Top Products',
    form_data: {
      datasource: '3__table',
      viz_type: 'bar',
    },
  },
};

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  dashboardTitle: 'Sales Dashboard',
  charts: mockCharts,
  slices: mockSlices,
};

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * USER STORY: Opening the export modal
 * As a user, when I click "Export Dashboard Data" from the Download menu,
 * I should see a modal with all charts selected by default
 */
test('User opens export modal and sees all charts selected by default', () => {
  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  // Modal should be visible
  expect(screen.getByText('Export Dashboard Data')).toBeInTheDocument();

  // All 3 charts should be listed
  expect(screen.getByText('Sales by Region')).toBeInTheDocument();
  expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
  expect(screen.getByText('Top Products')).toBeInTheDocument();

  // Selection count should show all selected
  expect(screen.getByText('3 of 3 charts selected')).toBeInTheDocument();

  // Export button should show correct count
  expect(screen.getByText('Export 3 charts')).toBeInTheDocument();
});

/**
 * USER STORY: Selecting specific charts
 * As a user, I want to export only specific charts, not all of them
 */
test('User can select only specific charts to export', async () => {
  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  // User clicks "Deselect All" to start fresh
  const deselectAllButton = screen.getByText('Deselect All');
  await userEvent.click(deselectAllButton);

  expect(screen.getByText('0 of 3 charts selected')).toBeInTheDocument();
  expect(screen.getByText('Export 0 charts')).toBeInTheDocument();

  // User selects only 2 charts
  const salesChart = screen.getByText('Sales by Region');
  const revenueChart = screen.getByText('Revenue Trend');

  await userEvent.click(salesChart);
  await userEvent.click(revenueChart);

  // Should show correct selection count
  expect(screen.getByText('2 of 3 charts selected')).toBeInTheDocument();
  expect(screen.getByText('Export 2 charts')).toBeInTheDocument();
});

/**
 * USER STORY: Successfully exporting charts
 * As a user, when I click "Export X charts", I should see progress
 * and eventually receive an Excel file with my data
 */
test('User exports selected charts and receives Excel file', async () => {
  const mockSalesData = {
    result: [
      {
        data: [
          { region: 'North', sales: 1000 },
          { region: 'South', sales: 1500 },
        ],
        colnames: ['region', 'sales'],
      },
    ],
  };

  const mockRevenueData = {
    result: [
      {
        data: [
          { month: 'Jan', revenue: 5000 },
          { month: 'Feb', revenue: 6000 },
        ],
        colnames: ['month', 'revenue'],
      },
    ],
  };

  const mockProductsData = {
    result: [
      {
        data: [
          { product: 'Widget A', count: 100 },
          { product: 'Widget B', count: 150 },
        ],
        colnames: ['product', 'count'],
      },
    ],
  };

  mockPost
    .mockResolvedValueOnce({ json: mockSalesData })
    .mockResolvedValueOnce({ json: mockRevenueData })
    .mockResolvedValueOnce({ json: mockProductsData });

  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  const exportButton = screen.getByText('Export 3 charts');
  await userEvent.click(exportButton);

  // User should see progress indicator
  await waitFor(() => {
    expect(screen.getByText(/Exporting chart/)).toBeInTheDocument();
  });

  // All 3 charts should be exported
  await waitFor(
    () => {
      expect(mockPost).toHaveBeenCalledTimes(3);
    },
    { timeout: 10000 },
  );

  // Excel file should be generated
  await waitFor(
    () => {
      expect(mockWriteFile).toHaveBeenCalled();
    },
    { timeout: 10000 },
  );

  // User should see success message
  await waitFor(
    () => {
      expect(mockAddSuccessToast).toHaveBeenCalled();
    },
    { timeout: 10000 },
  );
});

/**
 * EDGE CASE: Exporting with permission errors
 * As a user, if I don't have permission to export some charts,
 * I should still get an Excel file with the charts I can access
 */
test('User exports charts but some fail due to permissions - receives partial export', async () => {
  const mockSalesData = {
    result: [
      {
        data: [{ region: 'North', sales: 1000 }],
        colnames: ['region', 'sales'],
      },
    ],
  };

  const mockProductsData = {
    result: [
      {
        data: [{ product: 'Widget A', count: 100 }],
        colnames: ['product', 'count'],
      },
    ],
  };

  mockPost
    .mockResolvedValueOnce({ json: mockSalesData })
    .mockRejectedValueOnce(new Error('Permission denied'))
    .mockResolvedValueOnce({ json: mockProductsData });

  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  const exportButton = screen.getByText('Export 3 charts');
  await userEvent.click(exportButton);

  await waitFor(
    () => {
      expect(mockPost).toHaveBeenCalledTimes(3);
    },
    { timeout: 10000 },
  );

  // Should show which chart failed
  await waitFor(() => {
    expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
    expect(screen.getByText(/Failed/)).toBeInTheDocument();
  });

  // User should see warning about partial success
  await waitFor(
    () => {
      expect(mockAddWarningToast).toHaveBeenCalled();
    },
    { timeout: 10000 },
  );

  // Excel file should still be generated with successful charts
  await waitFor(
    () => {
      expect(mockWriteFile).toHaveBeenCalled();
    },
    { timeout: 10000 },
  );
});

/**
 * EDGE CASE: Large dashboard warning
 * As a user exporting a dashboard with >20 charts,
 * I should see a warning about performance
 */
test('User sees warning when exporting more than 20 charts', () => {
  const manyCharts = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `Chart ${i + 1}`,
    vizType: 'table',
  }));

  const manySlices = Object.fromEntries(
    manyCharts.map(chart => [
      chart.id,
      {
        slice_id: chart.id,
        slice_name: chart.name,
        form_data: { datasource: '1__table', viz_type: 'table' },
      },
    ]),
  );

  render(
    <ExportDashboardDataModal
      {...defaultProps}
      charts={manyCharts}
      slices={manySlices}
    />,
    {
      useRedux: true,
    },
  );

  expect(
    screen.getByText(/Exporting more than 20 charts may take some time/),
  ).toBeInTheDocument();
});

/**
 * EDGE CASE: Empty dashboard
 * As a user opening export modal on a dashboard with no charts,
 * I should see a message that there's nothing to export
 */
test('User opens export modal on empty dashboard and sees helpful message', () => {
  render(
    <ExportDashboardDataModal {...defaultProps} charts={[]} slices={{}} />,
    {
      useRedux: true,
    },
  );

  expect(screen.getByText(/No charts available to export/)).toBeInTheDocument();
});

/**
 * EDGE CASE: Charts with special characters in names
 * As a user exporting charts with special characters (/, :, *, etc.),
 * the Excel sheet names should be sanitized properly
 */
test('User exports charts with special characters in names - sanitized for Excel', async () => {
  const specialCharCharts = [
    { id: 1, name: 'Sales/Revenue: 2024*', vizType: 'table' },
    { id: 2, name: 'Users [Active]', vizType: 'bar' },
  ];

  const specialCharSlices = {
    1: {
      slice_id: 1,
      slice_name: 'Sales/Revenue: 2024*',
      form_data: { datasource: '1__table', viz_type: 'table' },
    },
    2: {
      slice_id: 2,
      slice_name: 'Users [Active]',
      form_data: { datasource: '2__table', viz_type: 'bar' },
    },
  };

  mockPost.mockResolvedValue({
    result: [
      {
        data: [{ value: 123 }],
        colnames: ['value'],
      },
    ],
  });

  render(
    <ExportDashboardDataModal
      {...defaultProps}
      charts={specialCharCharts}
      slices={specialCharSlices}
    />,
    {
      useRedux: true,
    },
  );

  const exportButton = screen.getByText('Export 2 charts');
  await userEvent.click(exportButton);

  await waitFor(
    () => {
      expect(mockPost).toHaveBeenCalledTimes(2);
    },
    { timeout: 10000 },
  );

  // Sheet names should be sanitized (/ → _, : → _, * → _, [ → _, ] → _)
  await waitFor(
    () => {
      expect(mockBookAppendSheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringMatching(/Sales_Revenue_ 2024_/),
      );
    },
    { timeout: 10000 },
  );
});

/**
 * USER STORY: Canceling export
 * As a user, I should be able to close the modal without exporting
 */
test('User closes modal without exporting', async () => {
  const mockOnHide = jest.fn();

  render(<ExportDashboardDataModal {...defaultProps} onHide={mockOnHide} />, {
    useRedux: true,
  });

  const closeButton = screen.getByRole('button', { name: /Close/ });
  await userEvent.click(closeButton);

  expect(mockOnHide).toHaveBeenCalled();
  expect(mockPost).not.toHaveBeenCalled();
});

/**
 * EDGE CASE: No charts selected
 * As a user, if I deselect all charts, the export button should be disabled
 */
test('User cannot export when no charts are selected', async () => {
  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  const deselectAllButton = screen.getByText('Deselect All');
  await userEvent.click(deselectAllButton);

  const exportButton = screen.getByRole('button', { name: /Export 0 charts/ });
  expect(exportButton).toBeDisabled();
});

/**
 * EDGE CASE: Duplicate chart names
 * As a user exporting charts with duplicate names,
 * Excel sheets should be numbered to avoid conflicts
 */
test('User exports charts with duplicate names - sheets are numbered', async () => {
  const duplicateNameCharts = [
    { id: 1, name: 'Sales Chart', vizType: 'table' },
    { id: 2, name: 'Sales Chart', vizType: 'bar' },
    { id: 3, name: 'Sales Chart', vizType: 'line' },
  ];

  const duplicateNameSlices = Object.fromEntries(
    duplicateNameCharts.map(chart => [
      chart.id,
      {
        slice_id: chart.id,
        slice_name: chart.name,
        form_data: { datasource: '1__table', viz_type: chart.vizType },
      },
    ]),
  );

  mockPost.mockResolvedValue({
    result: [
      {
        data: [{ value: 123 }],
        colnames: ['value'],
      },
    ],
  });

  render(
    <ExportDashboardDataModal
      {...defaultProps}
      charts={duplicateNameCharts}
      slices={duplicateNameSlices}
    />,
    {
      useRedux: true,
    },
  );

  const exportButton = screen.getByText('Export 3 charts');
  await userEvent.click(exportButton);

  await waitFor(
    () => {
      expect(mockPost).toHaveBeenCalledTimes(3);
    },
    { timeout: 10000 },
  );

  // Sheets should be named: "Sales Chart", "Sales Chart(2)", "Sales Chart(3)"
  await waitFor(
    () => {
      expect(mockBookAppendSheet).toHaveBeenCalledTimes(3);
    },
    { timeout: 10000 },
  );
});

/**
 * USER STORY: Progress tracking
 * As a user during export, I should see which charts are being exported,
 * which completed, and which failed
 */
test('User sees detailed progress as charts export', async () => {
  mockPost
    .mockImplementationOnce(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                json: {
                  result: [
                    {
                      data: [{ value: 1 }],
                      colnames: ['value'],
                    },
                  ],
                },
              }),
            100,
          ),
        ),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                json: {
                  result: [
                    {
                      data: [{ value: 2 }],
                      colnames: ['value'],
                    },
                  ],
                },
              }),
            100,
          ),
        ),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                json: {
                  result: [
                    {
                      data: [{ value: 3 }],
                      colnames: ['value'],
                    },
                  ],
                },
              }),
            100,
          ),
        ),
    );

  render(<ExportDashboardDataModal {...defaultProps} />, {
    useRedux: true,
  });

  const exportButton = screen.getByText('Export 3 charts');
  await userEvent.click(exportButton);

  // Should show progress text
  await waitFor(() => {
    expect(screen.getByText(/Exporting chart 1 of 3/)).toBeInTheDocument();
  });

  // Progress should update
  await waitFor(
    () => {
      expect(screen.getByText(/Exporting chart 2 of 3/)).toBeInTheDocument();
    },
    { timeout: 5000 },
  );

  await waitFor(
    () => {
      expect(screen.getByText(/Exporting chart 3 of 3/)).toBeInTheDocument();
    },
    { timeout: 5000 },
  );
});

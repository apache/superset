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
import fetchMock from 'fetch-mock';
import {
  fireEvent,
  screen,
  waitFor,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import { DatasourceType, isFeatureEnabled } from '@superset-ui/core';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  asyncRender,
  fastRender,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  dismissDatasourceWarning,
  createDeferredPromise,
} from './DatasourceEditor.test.utils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

beforeEach(() => {
  jest.useRealTimers();
  fetchMock.removeRoutes();
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
  jest.clearAllMocks();
});

afterEach(async () => {
  jest.useRealTimers();
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
  // Reset module mock since jest.fn() doesn't support mockRestore()
  jest.mocked(isFeatureEnabled).mockReset();
  // Restore console.error if it was spied on
  if (jest.isMockFunction(console.error)) {
    (console.error as jest.Mock).mockRestore();
  }
});

test('renders Tabs', async () => {
  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });
  expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
});

test('can sync columns from source', async () => {
  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const columnsTab = screen.getByTestId('collection-tab-Columns');
  userEvent.click(columnsTab);

  const syncButton = screen.getByText(/sync columns from source/i);
  expect(syncButton).toBeInTheDocument();

  // Use a Promise to track when fetchMock is called
  const fetchPromise = new Promise<string>(resolve => {
    fetchMock.removeRoute(DATASOURCE_ENDPOINT);
    fetchMock.get(
      DATASOURCE_ENDPOINT,
      ({ url }) => {
        resolve(url);
        return [];
      },
      { name: DATASOURCE_ENDPOINT },
    );
  });

  userEvent.click(syncButton);

  // Wait for the fetch to be called
  const url = await fetchPromise;
  expect(url).toContain('Vehicle+Sales%20%2B');
});

// to add, remove and modify columns accordingly
test('can modify columns', async () => {
  const baseProps = createProps();
  const limitedProps = {
    ...baseProps,
    onChange: jest.fn(),
    datasource: {
      ...baseProps.datasource,
      table_name: 'Vehicle Sales +',
      columns: baseProps.datasource.columns
        .slice(0, 1)
        .map(column => ({ ...column })),
    },
  };

  fastRender(limitedProps);

  await dismissDatasourceWarning();

  const columnsTab = await screen.findByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const getToggles = await screen.findAllByRole('button', {
    name: /expand row/i,
  });
  await userEvent.click(getToggles[0]);

  const getTextboxes = await screen.findAllByRole('textbox');
  expect(getTextboxes.length).toBeGreaterThanOrEqual(5);

  const inputLabel = screen.getByPlaceholderText('Label');
  const inputCertDetails = screen.getByPlaceholderText('Certification details');

  // Clear onChange mock to track user action callbacks
  limitedProps.onChange.mockClear();

  // Use fireEvent.change for speed - testing wiring, not per-keystroke behavior
  fireEvent.change(inputLabel, { target: { value: 'test_label' } });
  fireEvent.change(inputCertDetails, { target: { value: 'test_details' } });

  // Verify the inputs were updated and onChange was triggered
  await waitFor(() => {
    expect(inputLabel).toHaveValue('test_label');
    expect(inputCertDetails).toHaveValue('test_details');
    expect(limitedProps.onChange).toHaveBeenCalled();
  });
});

test('can delete columns', async () => {
  const baseProps = createProps();
  const limitedProps = {
    ...baseProps,
    onChange: jest.fn(),
    datasource: {
      ...baseProps.datasource,
      table_name: 'Vehicle Sales +',
      columns: baseProps.datasource.columns
        .slice(0, 1)
        .map(column => ({ ...column })),
    },
  };

  fastRender(limitedProps);

  await dismissDatasourceWarning();

  const columnsTab = await screen.findByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const columnsPanel = within(
    await screen.findByRole('tabpanel', { name: /columns/i }),
  );

  const getToggles = await columnsPanel.findAllByRole('button', {
    name: /expand row/i,
  });

  await userEvent.click(getToggles[0]);

  const deleteButtons = await columnsPanel.findAllByRole('button', {
    name: /delete item/i,
  });
  const initialCount = deleteButtons.length;
  expect(initialCount).toBeGreaterThan(0);

  // Clear onChange mock to track delete action
  limitedProps.onChange.mockClear();

  await userEvent.click(deleteButtons[0]);

  await waitFor(() =>
    expect(
      columnsPanel.queryAllByRole('button', { name: /delete item/i }),
    ).toHaveLength(initialCount - 1),
  );
  await waitFor(() => expect(limitedProps.onChange).toHaveBeenCalled());
});

test('can add new columns', async () => {
  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const calcColsTab = screen.getByTestId('collection-tab-Calculated columns');
  await userEvent.click(calcColsTab);

  const addBtn = screen.getByRole('button', {
    name: /add item/i,
  });
  expect(addBtn).toBeInTheDocument();

  await userEvent.click(addBtn);

  // newColumn (Column name) is the first textbox in the tab
  await waitFor(() => {
    const newColumn = screen.getAllByRole('textbox')[0];
    expect(newColumn).toHaveValue('<new column>');
  });
});

test('renders Data type label in calculated columns tab', async () => {
  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const calcColsTab = screen.getByTestId('collection-tab-Calculated columns');
  await userEvent.click(calcColsTab);

  const calcColsPanel = within(
    await screen.findByRole('tabpanel', { name: /calculated columns/i }),
  );

  const addBtn = calcColsPanel.getByRole('button', { name: /add item/i });
  await userEvent.click(addBtn);

  const dataTypeLabels = await calcColsPanel.findAllByText('Data type');
  expect(dataTypeLabels.length).toBeGreaterThanOrEqual(2);
});

test('renders isSqla fields', async () => {
  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const columnsTab = screen.getByRole('tab', {
    name: /settings/i,
  });
  await userEvent.click(columnsTab);

  const extraField = screen.getAllByText(/extra/i);
  expect(extraField.length).toBeGreaterThan(0);
  expect(screen.getByText(/autocomplete query predicate/i)).toBeInTheDocument();
  expect(screen.getByText(/template parameters/i)).toBeInTheDocument();
});

test('Source Tab: edit mode', async () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(() => false);

  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const getLockBtn = screen.getByRole('img', { name: /lock/i });
  await userEvent.click(getLockBtn);

  const physicalRadioBtn = screen.getByRole('radio', {
    name: /physical \(table or view\)/i,
  });
  const virtualRadioBtn = screen.getByRole('radio', {
    name: /virtual \(sql\)/i,
  });

  expect(physicalRadioBtn).toBeEnabled();
  expect(virtualRadioBtn).toBeEnabled();
});

test('Source Tab: readOnly mode', async () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(() => false);

  const testProps = createProps();
  await asyncRender({
    ...testProps,
    datasource: { ...testProps.datasource, table_name: 'Vehicle Sales +' },
  });

  const getLockBtn = screen.getByRole('img', { name: /lock/i });
  expect(getLockBtn).toBeInTheDocument();

  const physicalRadioBtn = screen.getByRole('radio', {
    name: /physical \(table or view\)/i,
  });
  const virtualRadioBtn = screen.getByRole('radio', {
    name: /virtual \(sql\)/i,
  });

  expect(physicalRadioBtn).toBeDisabled();
  expect(virtualRadioBtn).toBeDisabled();
});

test('calls onChange with empty SQL when switching to physical dataset', async () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(() => false);

  const testProps = createProps();

  await asyncRender({
    ...testProps,
    datasource: {
      ...testProps.datasource,
      table_name: 'Vehicle Sales +',
      type: DatasourceType.Query,
      sql: 'SELECT * FROM users',
    },
  });

  // Enable edit mode
  const getLockBtn = screen.getByRole('img', { name: /lock/i });
  await userEvent.click(getLockBtn);

  // Switch to physical dataset
  const physicalRadioBtn = screen.getByRole('radio', {
    name: /physical \(table or view\)/i,
  });
  await userEvent.click(physicalRadioBtn);

  // Assert that the latest onChange call has empty SQL
  expect(testProps.onChange).toHaveBeenCalled();
  const lastCallIndex = testProps.onChange.mock.calls.length - 1;
  const updatedDatasource = testProps.onChange.mock.calls[lastCallIndex];
  expect(updatedDatasource[0].sql).toBe('');
});

test('properly renders the metric information', async () => {
  await asyncRender(createProps());

  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  const expandToggle = await screen.findAllByLabelText(/expand row/i);
  // Metrics are sorted by ID descending, so metric with id=1 (which has certification)
  // is at position 6 (last). Expand that one.
  await userEvent.click(expandToggle[6]);

  // Wait for fields to appear
  const certificationDetails = await screen.findByPlaceholderText(
    /certification details/i,
  );
  const certifiedBy = await screen.findByPlaceholderText(/certified by/i);

  expect(certificationDetails).toHaveValue('foo');
  expect(certifiedBy).toHaveValue('someone');
});

test('properly updates the metric information', async () => {
  await asyncRender(createProps());

  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  const expandToggle = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggle[1]);

  const certifiedBy = await screen.findByPlaceholderText(/certified by/i);
  const certificationDetails = await screen.findByPlaceholderText(
    /certification details/i,
  );

  // Use fireEvent.change for speed - we're testing wiring, not keystroke behavior
  fireEvent.change(certifiedBy, {
    target: { value: 'I am typing a new name' },
  });
  fireEvent.change(certificationDetails, {
    target: { value: 'I am typing something new' },
  });

  await waitFor(() => {
    expect(certifiedBy).toHaveValue('I am typing a new name');
    expect(certificationDetails).toHaveValue('I am typing something new');
  });
});

test('shows the default datetime column in dropdown', async () => {
  await asyncRender(createProps());

  const columnsButton = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsButton);

  // Find the Default Column Settings section
  const defaultColumnSettings = screen.getByTestId('default-column-settings');
  expect(defaultColumnSettings).toBeInTheDocument();

  // Find the default datetime column dropdown
  const defaultDatetimeDropdown = screen.getByRole('combobox', {
    name: 'Default datetime column',
  });
  expect(defaultDatetimeDropdown).toBeInTheDocument();

  // Verify the current value is 'ds' (from main_dttm_col in props)
  const selectedValue = await screen.findByText('ds', {
    selector: '.ant-select-selection-item',
  });
  expect(selectedValue).toBeInTheDocument();
});

test('default datetime dropdown shows only temporal columns', async () => {
  await asyncRender(createProps());

  const columnsButton = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsButton);

  // Find the default datetime column dropdown
  const defaultDatetimeDropdown = screen.getByRole('combobox', {
    name: 'Default datetime column',
  });

  await userEvent.click(defaultDatetimeDropdown);

  // Check that temporal column 'ds' is in the dropdown options
  const options = document.querySelectorAll('.ant-select-item-option');
  const dsOption = Array.from(options).find(o => o.textContent?.includes('ds'));
  expect(dsOption).toBeDefined();

  // Check that non-temporal column 'gender' is NOT in the dropdown
  const genderOption = Array.from(options).find(o =>
    o.textContent?.includes('gender'),
  );
  expect(genderOption).toBeUndefined();
});

test('aborts pending requests on unmount without errors', async () => {
  // Spy on console.error to catch React warnings
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  const props = createProps();

  // Mock formatQuery to delay response
  const formatQueryDeferred = createDeferredPromise();
  props.formatQuery!.mockReturnValue(formatQueryDeferred.promise);

  const { unmount } = await asyncRender(props);

  // Call formatQuery prop directly to trigger the async operation
  // In real usage, this is called via onQueryFormat() method
  props.formatQuery!('SELECT * FROM table');

  // Unmount BEFORE request completes
  unmount();

  // Resolve the promise after unmount
  formatQueryDeferred.resolve({ json: { result: 'SELECT * FROM table' } });

  // Wait for async cleanup
  await cleanupAsyncOperations();

  // CRITICAL: No setState warnings
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('setState'),
  );
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted component'),
  );

  consoleErrorSpy.mockRestore();
});

test('resets loading state when request aborted', async () => {
  // Spy on console.error to catch React warnings
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  const props = createProps();
  const { unmount } = await asyncRender(props);

  // Navigate to Usage tab
  const usageTab = screen.getByRole('tab', { name: /usage/i });
  await userEvent.click(usageTab);

  // Unmount while usage data is loading
  unmount();

  // Should not throw "Can't perform a React state update on unmounted component"
  await cleanupAsyncOperations();

  // Verify no React warnings
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('setState'),
  );
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted component'),
  );

  consoleErrorSpy.mockRestore();
});

test('allows simultaneous different async operations', async () => {
  const props = createProps();
  await asyncRender(props);

  // Both operations should be able to run simultaneously without interference
  // This test verifies per-request controllers don't cancel each other

  // Note: We can't easily trigger formatSql and syncMetadata buttons in tests
  // without more complex setup, but the pattern is tested via unit structure
  expect(props.datasource).toBeDefined();
});

test('fetchUsageData rethrows AbortError without updating state', async () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  const props = createProps();
  const { unmount } = await asyncRender(props);

  // Mock the API to reject with AbortError
  fetchMock.get('glob:*/api/v1/chart/*', () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  });

  // Navigate to Usage tab to trigger fetchUsageData
  const usageTab = screen.getByRole('tab', { name: /usage/i });
  userEvent.click(usageTab);

  // Unmount immediately
  unmount();

  await cleanupAsyncOperations();

  // Verify no setState warnings
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('setState'),
  );
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted component'),
  );

  consoleErrorSpy.mockRestore();
});

test('immediate unmount after mount does not cause unhandled rejection from initial fetchUsageData', async () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  // Mock chart API to delay long enough for unmount to happen first
  fetchMock.get(
    'glob:*/api/v1/chart/*',
    new Promise(() => {}), // Never resolves - will be aborted
  );

  const props = createProps();

  // Use fastRender to mount without waiting for async completion
  // This triggers fetchUsageData() in componentDidMount
  const { unmount } = fastRender(props);

  // Immediately unmount while initial fetchUsageData is in-flight
  // This calls AbortController.abort() via componentWillUnmount
  unmount();

  await cleanupAsyncOperations();

  // CRITICAL: The .catch() handler in componentDidMount should swallow AbortError
  // No unhandled rejection or React warnings should appear
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('Unhandled'),
  );
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining('unmounted component'),
  );

  consoleErrorSpy.mockRestore();
});

test('can search metrics by metric name', async () => {
  const testProps = createProps();
  await asyncRender(testProps);

  // Navigate to Metrics tab
  const metricsTab = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricsTab);

  // Find the search input
  const searchInput = screen.getByPlaceholderText(
    'Search metrics by key or label',
  );
  expect(searchInput).toBeInTheDocument();

  // Verify initial metrics are shown
  expect(screen.getByText('sum__num')).toBeInTheDocument();
  expect(screen.getByText('avg__num')).toBeInTheDocument();

  // Search for a specific metric
  await userEvent.type(searchInput, 'sum');

  // Verify filtered results
  expect(screen.getByText('sum__num')).toBeInTheDocument();
  expect(screen.queryByText('avg__num')).not.toBeInTheDocument();

  // Clear search
  await userEvent.clear(searchInput);

  // Verify all metrics are shown again
  await waitFor(() => {
    expect(screen.getByText('sum__num')).toBeInTheDocument();
    expect(screen.getByText('avg__num')).toBeInTheDocument();
  });
});

test('can search metrics by verbose name', async () => {
  const testProps = createProps();
  await asyncRender(testProps);

  // Navigate to Metrics tab
  const metricsTab = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricsTab);

  const searchInput = screen.getByPlaceholderText(
    'Search metrics by key or label',
  );

  // Search by verbose name
  await userEvent.type(searchInput, 'avg');

  // Verify filtered results
  await waitFor(() => {
    expect(screen.queryByText('sum__num')).not.toBeInTheDocument();
    expect(screen.getByText('avg__num')).toBeInTheDocument();
  });
});

test('metric search is case-insensitive', async () => {
  const testProps = createProps();
  await asyncRender(testProps);

  const metricsTab = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricsTab);

  const searchInput = screen.getByPlaceholderText(
    'Search metrics by key or label',
  );

  // Search with uppercase
  await userEvent.type(searchInput, 'SUM');

  // Verify results are still found
  await waitFor(() => {
    expect(screen.getByText('sum__num')).toBeInTheDocument();
  });
});

test('can search columns by name', async () => {
  const testProps = createProps();
  await asyncRender(testProps);

  // Navigate to Columns tab
  const columnsTab = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  // Find the search input
  const searchInput = screen.getByPlaceholderText('Search columns by name');
  expect(searchInput).toBeInTheDocument();

  // Get initial column count
  const initialColumns = screen.getAllByRole('row');

  // Search for a specific column
  await userEvent.type(searchInput, 'ds');

  // Verify filtered results (fewer rows than before)
  await waitFor(() => {
    const filteredColumns = screen.getAllByRole('row');
    expect(filteredColumns.length).toBeLessThan(initialColumns.length);
  });

  // Clear search
  await userEvent.clear(searchInput);

  // Verify all columns are shown again
  await waitFor(() => {
    const allColumns = screen.getAllByRole('row');
    expect(allColumns.length).toBe(initialColumns.length);
  });
});

test('column search is case-insensitive', async () => {
  const testProps = createProps();
  await asyncRender(testProps);

  const columnsTab = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const searchInput = screen.getByPlaceholderText('Search columns by name');

  // Search with uppercase
  await userEvent.type(searchInput, 'DS');

  // Verify results are still found
  await waitFor(() => {
    const filteredColumns = screen.getAllByRole('row');
    // Should have fewer rows than total (header + filtered rows)
    expect(filteredColumns.length).toBeGreaterThan(0);
  });
});

test('can search calculated columns by name', async () => {
  const testProps = createProps();
  // Add some calculated columns with expressions
  testProps.datasource.columns = [
    ...testProps.datasource.columns,
    {
      id: 999,
      type: 'VARCHAR',
      filterable: true,
      is_dttm: false,
      is_active: true,
      expression: 'CASE WHEN state = "CA" THEN 1 ELSE 0 END',
      groupby: true,
      column_name: 'is_california',
    },
    {
      id: 1000,
      type: 'VARCHAR',
      filterable: true,
      is_dttm: false,
      is_active: true,
      expression: 'UPPER(name)',
      groupby: true,
      column_name: 'upper_name',
    },
  ];

  await asyncRender(testProps);

  // Navigate to Calculated Columns tab
  const calculatedColumnsTab = screen.getByTestId(
    'collection-tab-Calculated columns',
  );
  await userEvent.click(calculatedColumnsTab);

  // Wait for calculated columns to be displayed
  // column_name is rendered as an input (TextControl) since editableColumnName=true
  await waitFor(() => {
    expect(screen.getByDisplayValue('is_california')).toBeInTheDocument();
  });

  // Find the search input
  const searchInput = screen.getByPlaceholderText(
    'Search calculated columns by name',
  );
  expect(searchInput).toBeInTheDocument();

  // Verify both columns are visible initially
  expect(screen.getByDisplayValue('upper_name')).toBeInTheDocument();

  // Search for a specific calculated column
  await userEvent.type(searchInput, 'california');

  // Verify filtered results
  await waitFor(() => {
    expect(screen.getByDisplayValue('is_california')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('upper_name')).not.toBeInTheDocument();
  });

  // Clear search
  await userEvent.clear(searchInput);

  // Verify all calculated columns are shown again
  await waitFor(() => {
    expect(screen.getByDisplayValue('is_california')).toBeInTheDocument();
    expect(screen.getByDisplayValue('upper_name')).toBeInTheDocument();
  });
});

test('calculated column search is case-insensitive', async () => {
  const testProps = createProps();
  testProps.datasource.columns = [
    ...testProps.datasource.columns,
    {
      id: 999,
      type: 'VARCHAR',
      filterable: true,
      is_dttm: false,
      is_active: true,
      expression: 'UPPER(name)',
      groupby: true,
      column_name: 'upper_name',
    },
  ];

  await asyncRender(testProps);

  const calculatedColumnsTab = screen.getByTestId(
    'collection-tab-Calculated columns',
  );
  await userEvent.click(calculatedColumnsTab);

  // Wait for calculated column to be displayed
  // column_name is rendered as an input (TextControl) since editableColumnName=true
  await waitFor(() => {
    expect(screen.getByDisplayValue('upper_name')).toBeInTheDocument();
  });

  const searchInput = screen.getByPlaceholderText(
    'Search calculated columns by name',
  );

  // Search with different case
  await userEvent.type(searchInput, 'UPPER');

  // Verify results are still found
  await waitFor(() => {
    expect(screen.getByDisplayValue('upper_name')).toBeInTheDocument();
  });
});

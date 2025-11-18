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
  screen,
  waitFor,
  userEvent,
  cleanup,
} from 'spec/helpers/testing-library';
import { DatasourceType, isFeatureEnabled } from '@superset-ui/core';
import {
  props,
  DATASOURCE_ENDPOINT,
  asyncRender,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
} from './DatasourceEditor.test.utils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
  setupDatasourceEditorMocks();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.restore();
});

test('renders Tabs', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
  });
  expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
});

test('can sync columns from source', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
  });

  const columnsTab = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const syncButton = screen.getByText(/sync columns from source/i);
  expect(syncButton).toBeInTheDocument();

  // Use a Promise to track when fetchMock is called
  const fetchPromise = new Promise<string>(resolve => {
    fetchMock.get(
      DATASOURCE_ENDPOINT,
      (url: string) => {
        resolve(url);
        return [];
      },
      { overwriteRoutes: true },
    );
  });

  await userEvent.click(syncButton);

  // Wait for the fetch to be called
  const url = await fetchPromise;
  expect(url).toContain('Vehicle+Sales%20%2B');
});

// to add, remove and modify columns accordingly
test('can modify columns', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
  });

  const columnsTab = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const getToggles = screen.getAllByRole('button', {
    name: /expand row/i,
  });
  await userEvent.click(getToggles[0]);

  const getTextboxes = await screen.findAllByRole('textbox');
  expect(getTextboxes.length).toBeGreaterThanOrEqual(5);

  const inputLabel = screen.getByPlaceholderText('Label');
  const inputDescription = screen.getByPlaceholderText('Description');
  const inputDtmFormat = screen.getByPlaceholderText('%Y-%m-%d');
  const inputCertifiedBy = screen.getByPlaceholderText('Certified by');
  const inputCertDetails = screen.getByPlaceholderText('Certification details');

  // Clear onChange mock to track user action callbacks
  props.onChange.mockClear();

  await userEvent.type(inputLabel, 'test_label');
  await userEvent.type(inputDescription, 'test');
  await userEvent.type(inputDtmFormat, 'test');
  await userEvent.type(inputCertifiedBy, 'test');
  await userEvent.type(inputCertDetails, 'test');

  // Verify the inputs were updated with the typed values
  await waitFor(() => {
    expect(inputLabel).toHaveValue('test_label');
    expect(inputDescription).toHaveValue('test');
    expect(inputDtmFormat).toHaveValue('test');
    expect(inputCertifiedBy).toHaveValue('test');
    expect(inputCertDetails).toHaveValue('test');
  });

  // Verify that onChange was triggered by user actions
  await waitFor(() => {
    expect(props.onChange).toHaveBeenCalled();
  });
}, 40000);

test('can delete columns', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
  });

  const columnsTab = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsTab);

  const getToggles = screen.getAllByRole('button', {
    name: /expand row/i,
  });

  await userEvent.click(getToggles[0]);

  const deleteButtons = await screen.findAllByRole('button', {
    name: /delete item/i,
  });
  const initialCount = deleteButtons.length;
  expect(initialCount).toBeGreaterThan(0);

  await userEvent.click(deleteButtons[0]);

  await waitFor(() => {
    const countRows = screen.getAllByRole('button', { name: /delete item/i });
    expect(countRows.length).toBe(initialCount - 1);
  });
}, 60000); // 60 seconds timeout to avoid timeouts

test('can add new columns', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
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
}, 60000);

test('renders isSqla fields', async () => {
  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
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

  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
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

  (isFeatureEnabled as jest.Mock).mockRestore();
});

test('Source Tab: readOnly mode', async () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(() => false);

  await asyncRender({
    ...props,
    datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
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

  (isFeatureEnabled as jest.Mock).mockRestore();
});

test('calls onChange with empty SQL when switching to physical dataset', async () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(() => false);

  // Clean previous render
  cleanup();

  props.onChange.mockClear();

  await asyncRender({
    ...props,
    datasource: {
      ...props.datasource,
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
  expect(props.onChange).toHaveBeenCalled();
  const updatedDatasource = props.onChange.mock.calls[0];
  expect(updatedDatasource[0].sql).toBe('');

  (isFeatureEnabled as jest.Mock).mockRestore();
});

test('properly renders the metric information', async () => {
  await asyncRender(props);

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
  await asyncRender(props);

  const metricButton = screen.getByTestId('collection-tab-Metrics');
  await userEvent.click(metricButton);

  const expandToggle = await screen.findAllByLabelText(/expand row/i);
  await userEvent.click(expandToggle[1]);

  const certifiedBy = await screen.findByPlaceholderText(/certified by/i);
  // Use userEvent.clear and userEvent.type instead of directly setting value
  await userEvent.clear(certifiedBy);
  await userEvent.type(certifiedBy, 'I am typing a new name');

  const certificationDetails = await screen.findByPlaceholderText(
    /certification details/i,
  );
  await waitFor(() => {
    expect(certifiedBy).toHaveValue('I am typing a new name');
  });

  await userEvent.clear(certificationDetails);
  await userEvent.type(certificationDetails, 'I am typing something new');

  await waitFor(() => {
    expect(certificationDetails).toHaveValue('I am typing something new');
  });
});

test('shows the default datetime column', async () => {
  await asyncRender(props);

  const columnsButton = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsButton);

  const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
  expect(dsDefaultDatetimeRadio).toBeChecked();

  const genderDefaultDatetimeRadio = screen.getByTestId(
    'radio-default-dttm-gender',
  );
  expect(genderDefaultDatetimeRadio).not.toBeChecked();
});

test('allows choosing only temporal columns as the default datetime', async () => {
  await asyncRender(props);

  const columnsButton = screen.getByTestId('collection-tab-Columns');
  await userEvent.click(columnsButton);

  const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
  expect(dsDefaultDatetimeRadio).toBeEnabled();

  const genderDefaultDatetimeRadio = screen.getByTestId(
    'radio-default-dttm-gender',
  );
  expect(genderDefaultDatetimeRadio).toBeDisabled();
});

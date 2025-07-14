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
  render,
  screen,
  waitFor,
  userEvent,
  cleanup,
} from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import { isFeatureEnabled } from '@superset-ui/core';
import DatasourceEditor from './DatasourceEditor';

/* eslint-disable jest/no-export */
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Common setup for tests
export const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: jest.fn(),
  columnLabels: {
    state: 'State',
  },
  columnLabelTooltips: {
    state: 'This is a tooltip for state',
  },
};
export const DATASOURCE_ENDPOINT =
  'glob:*/datasource/external_metadata_by_name/*';
const routeProps = {
  history: {},
  location: {},
  match: {},
};
export const asyncRender = props =>
  waitFor(() =>
    render(<DatasourceEditor {...props} {...routeProps} />, {
      useRedux: true,
      initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
      useRouter: true,
    }),
  );

describe('DatasourceEditor', () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  beforeEach(async () => {
    fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
    await asyncRender({
      ...props,
      datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
    });
  });

  afterEach(() => {
    fetchMock.restore();
    // jest.clearAllMocks();
  });

  it('renders Tabs', () => {
    expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
  });

  it('can sync columns from source', async () => {
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    userEvent.click(columnsTab);

    const syncButton = screen.getByText(/sync columns from source/i);
    expect(syncButton).toBeInTheDocument();

    // Use a Promise to track when fetchMock is called
    const fetchPromise = new Promise(resolve => {
      fetchMock.get(
        DATASOURCE_ENDPOINT,
        url => {
          resolve(url);
          return [];
        },
        { overwriteRoutes: true },
      );
    });

    userEvent.click(syncButton);

    // Wait for the fetch to be called
    const url = await fetchPromise;
    expect(url).toContain('Vehicle+Sales%20%2B');
  });

  // to add, remove and modify columns accordingly
  it('can modify columns', async () => {
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    userEvent.click(columnsTab);

    const getToggles = screen.getAllByRole('button', {
      name: /expand row/i,
    });
    userEvent.click(getToggles[0]);

    const getTextboxes = await screen.findAllByRole('textbox');
    expect(getTextboxes.length).toBeGreaterThanOrEqual(5);

    const inputLabel = screen.getByPlaceholderText('Label');
    const inputDescription = screen.getByPlaceholderText('Description');
    const inputDtmFormat = screen.getByPlaceholderText('%Y-%m-%d');
    const inputCertifiedBy = screen.getByPlaceholderText('Certified by');
    const inputCertDetails = screen.getByPlaceholderText(
      'Certification details',
    );

    userEvent.type(inputLabel, 'test_label');
    userEvent.type(inputDescription, 'test');
    userEvent.type(inputDtmFormat, 'test');
    userEvent.type(inputCertifiedBy, 'test');
    userEvent.type(inputCertDetails, 'test');
  }, 40000);

  it('can delete columns', async () => {
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    userEvent.click(columnsTab);

    const getToggles = screen.getAllByRole('button', {
      name: /expand row/i,
    });

    userEvent.click(getToggles[0]);

    const deleteButtons = await screen.findAllByRole('button', {
      name: /delete item/i,
    });
    const initialCount = deleteButtons.length;
    expect(initialCount).toBeGreaterThan(0);

    userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      const countRows = screen.getAllByRole('button', { name: /delete item/i });
      expect(countRows.length).toBe(initialCount - 1);
    });
  }, 60000); // 60 seconds timeout to avoid timeouts

  it('can add new columns', async () => {
    const calcColsTab = screen.getByTestId('collection-tab-Calculated columns');
    userEvent.click(calcColsTab);

    const addBtn = screen.getByRole('button', {
      name: /add item/i,
    });
    expect(addBtn).toBeInTheDocument();

    userEvent.click(addBtn);

    // newColumn (Column name) is the first textbox in the tab
    await waitFor(() => {
      const newColumn = screen.getAllByRole('textbox')[0];
      expect(newColumn).toHaveValue('<new column>');
    });
  });

  it('renders isSqla fields', async () => {
    const columnsTab = screen.getByRole('tab', {
      name: /settings/i,
    });
    userEvent.click(columnsTab);

    const extraField = screen.getAllByText(/extra/i);
    expect(extraField.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/autocomplete query predicate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/template parameters/i)).toBeInTheDocument();
  });
});

describe('DatasourceEditor Source Tab', () => {
  beforeAll(() => {
    isFeatureEnabled.mockImplementation(() => false);
  });

  beforeEach(async () => {
    fetchMock.get(DATASOURCE_ENDPOINT, [], { overwriteRoutes: true });
    await asyncRender({
      ...props,
      datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  afterAll(() => {
    isFeatureEnabled.mockRestore();
  });

  it('Source Tab: edit mode', async () => {
    const getLockBtn = screen.getByRole('img', { name: /lock/i });
    userEvent.click(getLockBtn);

    const physicalRadioBtn = screen.getByRole('radio', {
      name: /physical \(table or view\)/i,
    });
    const virtualRadioBtn = screen.getByRole('radio', {
      name: /virtual \(sql\)/i,
    });

    expect(physicalRadioBtn).toBeEnabled();
    expect(virtualRadioBtn).toBeEnabled();
  });

  it('Source Tab: readOnly mode', () => {
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

  it('calls onChange with empty SQL when switching to physical dataset', async () => {
    // Clean previous render
    cleanup();

    props.onChange.mockClear();

    await asyncRender({
      ...props,
      datasource: {
        ...props.datasource,
        table_name: 'Vehicle Sales +',
        datasourceType: 'virtual',
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
  });
});

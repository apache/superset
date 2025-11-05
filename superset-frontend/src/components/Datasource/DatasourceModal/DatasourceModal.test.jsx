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
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';
import { SupersetClient } from '@superset-ui/core';
import mockDatasource from 'spec/fixtures/mockDatasource';
import DatasourceModal from '.';

// Define your constants here
const SAVE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const SAVE_PAYLOAD = { new: 'data' };
const SAVE_DATASOURCE_ENDPOINT = 'glob:*/api/v1/dataset/7?override_columns=*';
const GET_DATASOURCE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const GET_DATABASE_ENDPOINT = 'glob:*/api/v1/database/?q=*';

const mockedProps = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: sinon.spy(),
};

let container;
const routeProps = {
  history: {},
  location: {},
  match: {},
};
async function renderAndWait(props = mockedProps) {
  const { container: renderedContainer } = render(
    <DatasourceModal {...props} {...routeProps} />,
    { store, useRouter: true },
  );

  container = renderedContainer;
}

beforeEach(() => {
  fetchMock.reset();
  cleanup();
  renderAndWait();
  fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
  fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
  fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
  fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DatasourceModal', () => {
  test('renders', async () => {
    expect(container).toBeDefined();
  });

  test('renders the component', () => {
    expect(screen.getByText('Edit Dataset')).toBeInTheDocument();
  });

  test('renders a Modal', async () => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('renders a DatasourceEditor', async () => {
    expect(screen.getByTestId('datasource-editor')).toBeInTheDocument();
  });

  test('disables the save button when the datasource is managed externally', () => {
    // the render is currently in a before operation, so it needs to be cleaned up
    // we could alternatively move all the renders back into the tests or find a better
    // way to automatically render but still allow to pass in props with the tests
    cleanup();

    renderAndWait({
      ...mockedProps,
      datasource: { ...mockedProps.datasource, is_managed_externally: true },
    });
    const saveButton = screen.getByTestId('datasource-modal-save');
    expect(saveButton).toBeDisabled();
  });

  test('calls the onDatasourceSave function when the save button is clicked', async () => {
    cleanup();
    const onDatasourceSave = jest.fn();

    renderAndWait({ ...mockedProps, onDatasourceSave });
    const saveButton = screen.getByTestId('datasource-modal-save');
    await act(async () => {
      fireEvent.click(saveButton);
      const okButton = await screen.findByRole('button', { name: 'OK' });
      okButton.click();
    });
    await waitFor(() => {
      expect(onDatasourceSave).toHaveBeenCalled();
    });
  });

  test('should render error dialog', async () => {
    const putSpy = jest
      .spyOn(SupersetClient, 'put')
      .mockRejectedValue(new Error('Something went wrong'));

    await act(async () => {
      const saveButton = screen.getByTestId('datasource-modal-save');
      fireEvent.click(saveButton);
      const okButton = await screen.findByRole('button', { name: 'OK' });
      okButton.click();
    });

    await act(async () => {
      const errorElements = await screen.findAllByText('Error saving dataset');
      const errorDiv = errorElements.find(el => el.closest('div'));
      expect(errorDiv).toBeInTheDocument();
    });
    putSpy.mockRestore();
  });

  test('shows sync columns checkbox when SQL changes', async () => {
    cleanup();
    const datasourceWithSQL = {
      ...mockedProps.datasource,
      sql: 'SELECT * FROM original_table',
    };
    const modifiedDatasource = {
      ...datasourceWithSQL,
      sql: 'SELECT * FROM new_table', // Different SQL to trigger checkbox
    };

    const { rerender } = render(
      <DatasourceModal {...mockedProps} datasource={datasourceWithSQL} />,
      { store, useRouter: true },
    );

    // Update with modified SQL
    rerender(
      <DatasourceModal {...mockedProps} datasource={modifiedDatasource} />,
    );

    const saveButton = screen.getByTestId('datasource-modal-save');
    fireEvent.click(saveButton);

    // Wait for confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText('Confirm save')).toBeInTheDocument();
    });

    // Checkbox should be present and checked by default when SQL changes
    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    // Should show the sync columns message
    expect(screen.getByText('Automatically sync columns')).toBeInTheDocument();
  });

  test('syncs columns when checkbox is checked and submits with override_columns=true', async () => {
    const datasourceWithSQL = {
      ...mockedProps.datasource,
      sql: 'SELECT * FROM original_table',
    };
    const modifiedDatasource = {
      ...datasourceWithSQL,
      sql: 'SELECT * FROM new_table',
    };

    // Render with the initial datasource
    cleanup();
    fetchMock.reset();
    fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    const { rerender } = render(
      <DatasourceModal {...mockedProps} datasource={datasourceWithSQL} />,
      { store, useRouter: true },
    );

    // Update with modified SQL to trigger checkbox
    rerender(
      <DatasourceModal {...mockedProps} datasource={modifiedDatasource} />,
    );

    const saveButton = screen.getByTestId('datasource-modal-save');
    fireEvent.click(saveButton);

    // Wait for confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText('Confirm save')).toBeInTheDocument();
    });

    // Checkbox should be present and checked by default when SQL changes
    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toBeChecked();

    // Click OK to submit
    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    // Verify the PUT request was made with override_columns=true
    await waitFor(() => {
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/api/v1/dataset/7') &&
            call[0].includes('override_columns') &&
            call[1]?.method === 'PUT',
        );
      expect(putCalls.length).toBeGreaterThan(0);
      expect(putCalls[putCalls.length - 1][0]).toContain(
        'override_columns=true',
      );
    });
  });

  test('does not sync columns when checkbox is unchecked and submits with override_columns=false', async () => {
    const datasourceWithSQL = {
      ...mockedProps.datasource,
      sql: 'SELECT * FROM original_table',
    };
    const modifiedDatasource = {
      ...datasourceWithSQL,
      sql: 'SELECT * FROM new_table',
    };

    // Render with the initial datasource
    cleanup();
    fetchMock.reset();
    fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    const { rerender } = render(
      <DatasourceModal {...mockedProps} datasource={datasourceWithSQL} />,
      { store, useRouter: true },
    );

    // Update with modified SQL to trigger checkbox
    rerender(
      <DatasourceModal {...mockedProps} datasource={modifiedDatasource} />,
    );

    const saveButton = screen.getByTestId('datasource-modal-save');
    fireEvent.click(saveButton);

    // Wait for confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText('Confirm save')).toBeInTheDocument();
    });

    // Checkbox should be present and checked by default when SQL changes
    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toBeChecked();

    // Uncheck the checkbox
    fireEvent.click(checkbox);

    // Verify checkbox is now unchecked
    expect(checkbox).not.toBeChecked();

    // Click OK to submit
    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    // Verify the PUT request was made with override_columns=false
    await waitFor(() => {
      const putCalls = fetchMock
        .calls()
        .filter(
          call =>
            call[0].includes('/api/v1/dataset/7') &&
            call[0].includes('override_columns') &&
            call[1]?.method === 'PUT',
        );
      expect(putCalls.length).toBeGreaterThan(0);
      expect(putCalls[putCalls.length - 1][0]).toContain(
        'override_columns=false',
      );
    });
  });
});

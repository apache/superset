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
  waitFor,
  fireEvent,
  cleanup,
  userEvent,
  act,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import mockDatasource from 'spec/fixtures/mockDatasource';
import React from 'react';
import DatasourceModalComponent, { buildExtraJsonObject } from '.';

// Cast to accept partial mock props in tests
const DatasourceModal = DatasourceModalComponent as unknown as React.FC<
  Record<string, any>
>;

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
  onDatasourceSave: jest.fn(),
};

let container: HTMLElement;
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

// A modal that wasn't handed an `etag` reads the dataset itself and can't save
// until that lands, so tests must wait before acting on the Save button.
async function waitForSaveEnabled() {
  await waitFor(() =>
    expect(screen.getByTestId('datasource-modal-save')).toBeEnabled(),
  );
}

beforeEach(async () => {
  fetchMock.clearHistory().removeRoutes();
  cleanup();
  fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
  fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
  fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
  fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });
  renderAndWait();
  await waitForSaveEnabled();
});

afterEach(() => {
  jest.useRealTimers();
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

    renderAndWait({
      ...mockedProps,
      onDatasourceSave:
        onDatasourceSave as unknown as typeof mockedProps.onDatasourceSave,
    });
    await waitForSaveEnabled();
    const saveButton = screen.getByTestId('datasource-modal-save');
    fireEvent.click(saveButton);
    const okButton = await screen.findByRole('button', { name: 'Confirm' });
    fireEvent.click(okButton);
    await waitFor(() => {
      expect(onDatasourceSave).toHaveBeenCalled();
    });
    const putCall = fetchMock.callHistory
      .calls()
      .find(
        call =>
          call.url.includes('/api/v1/dataset/7') &&
          call.options?.method === 'put',
      );
    expect(JSON.parse(putCall?.options?.body as string).editors).toEqual([1]);
  });

  test('saves dataset certification from Settings without dropping Extra metadata', async () => {
    cleanup();
    renderAndWait({
      ...mockedProps,
      datasource: {
        ...mockedProps.datasource,
        extra: JSON.stringify({
          custom_key: { enabled: true },
          warning_markdown: 'Use only finalized records',
        }),
      } as typeof mockedProps.datasource & { extra: string },
    });

    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    const defaultUrlLabel = await screen.findByText('Default URL');
    const defaultUrl = defaultUrlLabel
      .closest('.ant-form-item')
      ?.querySelector('input');
    expect(defaultUrl).not.toBeNull();
    const certifiedBy = await screen.findByPlaceholderText('Certified by');
    const details = screen.getByPlaceholderText('Certification details');

    jest.useFakeTimers();
    fireEvent.change(defaultUrl as HTMLInputElement, {
      target: { value: '/dashboard/7/' },
    });
    fireEvent.change(certifiedBy, { target: { value: 'E2E Team' } });
    fireEvent.change(details, {
      target: { value: 'Reviewed for production' },
    });
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE);
    });
    jest.useRealTimers();

    fireEvent.click(screen.getByTestId('datasource-modal-save'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      const putCall = fetchMock.callHistory
        .calls()
        .find(
          call =>
            call.url.includes('/api/v1/dataset/7') &&
            call.options?.method === 'put',
        );
      expect(putCall).toBeDefined();

      const payload = JSON.parse(putCall?.options?.body as string);
      expect(payload.default_endpoint).toBe('/dashboard/7/');
      expect(JSON.parse(payload.extra)).toEqual({
        custom_key: { enabled: true },
        warning_markdown: 'Use only finalized records',
        certification: {
          certified_by: 'E2E Team',
          details: 'Reviewed for production',
        },
      });
    });
  });

  test('shows existing dataset certification in Settings', async () => {
    cleanup();
    renderAndWait({
      ...mockedProps,
      datasource: {
        ...mockedProps.datasource,
        extra: JSON.stringify({
          certification: {
            certified_by: 'Data Platform Team',
            details: 'Source of truth',
          },
        }),
      } as typeof mockedProps.datasource & { extra: string },
    });

    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    expect(await screen.findByPlaceholderText('Certified by')).toHaveValue(
      'Data Platform Team',
    );
    expect(screen.getByPlaceholderText('Certification details')).toHaveValue(
      'Source of truth',
    );
  });

  test('should render error dialog', async () => {
    const putSpy = jest
      .spyOn(SupersetClient, 'put')
      .mockRejectedValue(new Error('Something went wrong'));

    const saveButton = screen.getByTestId('datasource-modal-save');
    fireEvent.click(saveButton);
    const okButton = await screen.findByRole('button', { name: 'Confirm' });
    fireEvent.click(okButton);

    const errorElements = await screen.findAllByText('Error saving dataset');
    const errorDiv = errorElements.find(el => el.closest('div'));
    expect(errorDiv).toBeInTheDocument();
    putSpy.mockRestore();
  });

  test('sends the supplied etag as If-Match so a stale save is refused', async () => {
    cleanup();
    renderAndWait({ ...mockedProps, etag: '"v1"' } as typeof mockedProps);

    fireEvent.click(screen.getByTestId('datasource-modal-save'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      const putCall = fetchMock.callHistory
        .calls()
        .find(call => call.options?.method === 'put');
      expect(
        new Headers(putCall?.options?.headers as HeadersInit).get('If-Match'),
      ).toEqual('"v1"');
    });
  });

  test('reads the etag from the dataset when the caller supplies none', async () => {
    cleanup();
    fetchMock.clearHistory().removeRoutes();
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    fetchMock.get(GET_DATASOURCE_ENDPOINT, {
      body: { result: {} },
      headers: { ETag: '"v2"' },
    });
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    renderAndWait();

    // The form is seeded from the same read as the validator, so saving is
    // unavailable until it lands.
    expect(screen.getByTestId('datasource-modal-save')).toBeDisabled();
    await screen.findByTestId('datasource-editor');

    fireEvent.click(screen.getByTestId('datasource-modal-save'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      const putCall = fetchMock.callHistory
        .calls()
        .find(call => call.options?.method === 'put');
      expect(
        new Headers(putCall?.options?.headers as HeadersInit).get('If-Match'),
      ).toEqual('"v2"');
    });
  });

  test('never saves unguarded while the validator read is in flight', async () => {
    cleanup();
    fetchMock.clearHistory().removeRoutes();
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    // A read that never resolves: the save path must stay closed rather than
    // fall through to an unconditional PUT.
    fetchMock.get(GET_DATASOURCE_ENDPOINT, new Promise(() => {}));
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    renderAndWait();

    const saveButton = await screen.findByTestId('datasource-modal-save');
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);

    expect(
      fetchMock.callHistory
        .calls()
        .find(call => call.options?.method === 'put'),
    ).toBeUndefined();
  });

  test('shows a conflict dialog instead of a generic error on 412', async () => {
    const putSpy = jest
      .spyOn(SupersetClient, 'put')
      .mockRejectedValue(new Response('', { status: 412 }));

    try {
      fireEvent.click(screen.getByTestId('datasource-modal-save'));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

      const conflictElements = await screen.findAllByText(
        'Dataset changed since you opened it',
      );
      expect(conflictElements.length).toBeGreaterThan(0);
      expect(
        screen.queryByText('Error saving dataset'),
      ).not.toBeInTheDocument();
    } finally {
      putSpy.mockRestore();
    }
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
      <DatasourceModal
        {...mockedProps}
        datasource={datasourceWithSQL}
        etag='"v1"'
      />,
      { store, useRouter: true },
    );

    // Update with modified SQL
    rerender(
      <DatasourceModal
        {...mockedProps}
        datasource={modifiedDatasource}
        etag='"v1"'
      />,
    );

    await waitForSaveEnabled();
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
    fetchMock.clearHistory().removeRoutes();
    fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    const { rerender } = render(
      <DatasourceModal
        {...mockedProps}
        datasource={datasourceWithSQL}
        etag='"v1"'
      />,
      { store, useRouter: true },
    );

    // Update with modified SQL to trigger checkbox
    rerender(
      <DatasourceModal
        {...mockedProps}
        datasource={modifiedDatasource}
        etag='"v1"'
      />,
    );

    await waitForSaveEnabled();
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
    const okButton = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(okButton);

    // Verify the PUT request was made with override_columns=true
    await waitFor(() => {
      const putCalls = fetchMock.callHistory
        .calls()
        .filter(
          call =>
            call.url.includes('/api/v1/dataset/7') &&
            call.url.includes('override_columns') &&
            call.options?.method === 'put',
        );
      expect(putCalls.length).toBeGreaterThan(0);
      expect(putCalls[putCalls.length - 1].url).toContain(
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
    fetchMock.clearHistory().removeRoutes();
    fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
    fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
    fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
    fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });

    const { rerender } = render(
      <DatasourceModal
        {...mockedProps}
        datasource={datasourceWithSQL}
        etag='"v1"'
      />,
      { store, useRouter: true },
    );

    // Update with modified SQL to trigger checkbox
    rerender(
      <DatasourceModal
        {...mockedProps}
        datasource={modifiedDatasource}
        etag='"v1"'
      />,
    );

    await waitForSaveEnabled();
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
    const okButton = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(okButton);

    // Verify the PUT request was made with override_columns=false
    await waitFor(() => {
      const putCalls = fetchMock.callHistory
        .calls()
        .filter(
          call =>
            call.url.includes('/api/v1/dataset/7') &&
            call.url.includes('override_columns') &&
            call.options?.method === 'put',
        );
      expect(putCalls.length).toBeGreaterThan(0);
      expect(putCalls[putCalls.length - 1].url).toContain(
        'override_columns=false',
      );
    });
  });
});

describe('buildExtraJsonObject', () => {
  test('returns "{}" for an item with no warning and no certification', () => {
    expect(buildExtraJsonObject({} as any)).toBe('{}');
  });

  test('drops warning_markdown when its value is null', () => {
    expect(buildExtraJsonObject({ warning_markdown: null } as any)).toBe('{}');
  });

  test('drops warning_markdown when its value is an empty string', () => {
    expect(buildExtraJsonObject({ warning_markdown: '' } as any)).toBe('{}');
  });

  test('preserves a non-empty warning_markdown verbatim', () => {
    expect(buildExtraJsonObject({ warning_markdown: '⚠ caveat' } as any)).toBe(
      '{"warning_markdown":"⚠ caveat"}',
    );
  });

  test('preserves certification and drops null warning_markdown', () => {
    expect(
      buildExtraJsonObject({
        certified_by: 'data-team',
        certification_details: 'verified',
        warning_markdown: null,
      } as any),
    ).toBe(
      '{"certification":{"certified_by":"data-team","details":"verified"}}',
    );
  });
});

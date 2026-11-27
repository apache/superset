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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import CssTemplateImportModal from './CssTemplateImportModal';

const IMPORT_ENDPOINT = 'glob:*/api/v1/css_template/import/';

const setup = (
  props: Partial<Parameters<typeof CssTemplateImportModal>[0]> = {},
) =>
  render(
    <CssTemplateImportModal
      show
      onHide={jest.fn()}
      onCssTemplatesImport={jest.fn()}
      {...props}
    />,
    { useRedux: true, useTheme: true },
  );

const selectFiles = (files: File[]) =>
  fireEvent.change(screen.getByTestId('css-template-file-input'), {
    target: { files },
  });

const importButton = () => screen.getByRole('button', { name: 'Import' });

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('renders the import modal', () => {
  setup();

  expect(screen.getByText('Import CSS templates')).toBeInTheDocument();
  expect(screen.getByTestId('css-template-file-input')).toHaveAttribute(
    'accept',
    '.css',
  );
  expect(screen.getByTestId('css-template-file-input')).toHaveAttribute(
    'multiple',
  );
});

test('disables the import button until a file is selected', async () => {
  setup();

  expect(importButton()).toBeDisabled();

  selectFiles([new File(['h1 { color: red; }'], 'theme.css')]);

  await waitFor(() => expect(importButton()).toBeEnabled());
});

test('uploads every selected file and reports success', async () => {
  fetchMock.post(IMPORT_ENDPOINT, { message: 'Imported 2 CSS templates' });
  const onCssTemplatesImport = jest.fn();
  setup({ onCssTemplatesImport });

  selectFiles([
    new File(['h1 { color: red; }'], 'first.css'),
    new File(['h2 { color: blue; }'], 'second.css'),
  ]);
  expect(await screen.findByText('first.css')).toBeInTheDocument();
  expect(screen.getByText('second.css')).toBeInTheDocument();

  await waitFor(() => expect(importButton()).toBeEnabled());
  fireEvent.click(importButton());

  await waitFor(() =>
    expect(onCssTemplatesImport).toHaveBeenCalledWith(
      'Imported 2 CSS templates',
    ),
  );
  const [call] = fetchMock.callHistory.calls(IMPORT_ENDPOINT);
  const body = call.options.body as FormData;
  expect(body.getAll('formData').map(file => (file as File).name)).toEqual([
    'first.css',
    'second.css',
  ]);
});

test('shows the server error when the import fails', async () => {
  fetchMock.post(IMPORT_ENDPOINT, {
    status: 422,
    body: {
      errors: [
        {
          message: 'File theme.txt is not a CSS file',
          error_type: 'GENERIC_COMMAND_ERROR',
          level: 'warning',
        },
      ],
    },
  });
  const onCssTemplatesImport = jest.fn();
  setup({ onCssTemplatesImport });

  selectFiles([new File(['h1 { color: red; }'], 'theme.txt')]);
  await waitFor(() => expect(importButton()).toBeEnabled());
  fireEvent.click(importButton());

  expect(
    await screen.findByText(
      'An error occurred while importing CSS templates: File theme.txt is not a CSS file',
    ),
  ).toBeInTheDocument();
  expect(onCssTemplatesImport).not.toHaveBeenCalled();
  await waitFor(() => expect(importButton()).toBeEnabled());
});

test('clears the selection when the modal is closed', async () => {
  const onHide = jest.fn();
  setup({ onHide });

  selectFiles([new File(['h1 { color: red; }'], 'theme.css')]);
  expect(await screen.findByText('theme.css')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onHide).toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.queryByText('theme.css')).not.toBeInTheDocument(),
  );
});

test('ignores the response of an import started before the modal was closed', async () => {
  let respond: (response: object) => void = () => {};
  fetchMock.post(
    IMPORT_ENDPOINT,
    new Promise(resolve => {
      respond = resolve;
    }),
  );
  const onCssTemplatesImport = jest.fn();
  setup({ onCssTemplatesImport });

  selectFiles([new File(['h1 { color: red; }'], 'old.css')]);
  await waitFor(() => expect(importButton()).toBeEnabled());
  fireEvent.click(importButton());
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(IMPORT_ENDPOINT)).toHaveLength(1),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  selectFiles([new File(['h2 { color: blue; }'], 'new.css')]);
  expect(await screen.findByText('new.css')).toBeInTheDocument();

  respond({ status: 200, body: { message: 'Imported 1 CSS template' } });

  await waitFor(() =>
    expect(fetchMock.callHistory.done(IMPORT_ENDPOINT)).toBe(true),
  );
  expect(onCssTemplatesImport).not.toHaveBeenCalled();
  expect(screen.getByText('new.css')).toBeInTheDocument();
  expect(importButton()).toBeEnabled();
});

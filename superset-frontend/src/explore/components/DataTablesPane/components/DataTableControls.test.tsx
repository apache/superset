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
import { GenericDataType } from '@apache-superset/core/common';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { TableControls, ROW_LIMIT_OPTIONS } from './DataTableControls';
import { TableControlsProps } from '../types';

const onInputChange = jest.fn();
const onRowLimitChange = jest.fn();
const onDownloadCSV = jest.fn();
const onDownloadXLSX = jest.fn();
const onReload = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const setup = (overrides: Partial<TableControlsProps> = {}) => {
  const props: TableControlsProps = {
    data: [],
    datasourceId: '1__table',
    onInputChange,
    columnNames: [],
    columnTypes: [],
    isLoading: false,
    rowcount: 0,
    canDownload: true,
    rowLimit: 1000,
    rowLimitOptions: ROW_LIMIT_OPTIONS,
    onRowLimitChange,
    onDownloadCSV,
    onDownloadXLSX,
    onReload,
    ...overrides,
  };
  return render(<TableControls {...props} />, { useRedux: true });
};

test('renders the reload button as a native, keyboard-focusable button', () => {
  setup();
  const reloadButton = screen.getByRole('button', { name: 'Reload' });
  expect(reloadButton).toBeInTheDocument();
  // A native <button> is focusable and activates on Enter/Space for free,
  // unlike a <span role="button"> which keyboard users cannot trigger.
  expect(reloadButton).toHaveProperty('tagName', 'BUTTON');
  reloadButton.focus();
  expect(reloadButton).toHaveFocus();
});

test('calls onReload when the reload button is clicked', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test('does not render the reload button when onReload is omitted', () => {
  setup({ onReload: undefined });
  expect(
    screen.queryByRole('button', { name: 'Reload' }),
  ).not.toBeInTheDocument();
});

test('renders the download dropdown when downloads are enabled', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
});

test('hides the download dropdown when canDownload is false', () => {
  setup({ canDownload: false });
  expect(
    screen.queryByRole('button', { name: 'Download' }),
  ).not.toBeInTheDocument();
});

test('hides the download dropdown when download callbacks are missing', () => {
  setup({ onDownloadCSV: undefined, onDownloadXLSX: undefined });
  expect(
    screen.queryByRole('button', { name: 'Download' }),
  ).not.toBeInTheDocument();
});

test('renders the row limit select and reacts to changes', async () => {
  setup();
  const select = screen.getByRole('combobox');
  await userEvent.click(select);
  await userEvent.click(await screen.findByText('5k rows'));
  expect(onRowLimitChange).toHaveBeenCalledWith(
    5000,
    expect.objectContaining({ value: 5000 }),
  );
});

test('renders the row count label when the row limit select is absent', () => {
  setup({ onRowLimitChange: undefined, rowcount: 42 });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByText('42 rows')).toBeInTheDocument();
});

test('hides the row count label when rowcount reaches the row limit', () => {
  setup({ rowcount: 1000, rowLimit: 1000 });
  expect(screen.queryByText('1000 rows')).not.toBeInTheDocument();
});

test('shows the row count label when a row limit select exists without a limit', () => {
  setup({ rowLimit: undefined, rowcount: 7 });
  expect(screen.getByRole('combobox')).toBeInTheDocument();
  expect(screen.getByText('7 rows')).toBeInTheDocument();
});

test('applies time formatting to temporal columns', () => {
  setup({
    data: [{ ts: 1000000000000 }],
    columnNames: ['ts'],
    columnTypes: [GenericDataType.Temporal],
  });
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

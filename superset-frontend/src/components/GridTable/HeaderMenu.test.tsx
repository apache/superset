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
import type { Column, GridApi } from 'ag-grid-community';
import {
  render,
  waitFor,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { HeaderMenu, type HeaderMenuProps } from './HeaderMenu';

vi.mock('src/utils/copy', () => vi.fn().mockImplementation(f => f()));

const mockInvisibleColumn = {
  getColId: vi.fn().mockReturnValue('column2'),
  getColDef: vi.fn().mockReturnValue({ headerName: 'column2' }),
  getDataAsCsv: vi.fn().mockReturnValue('csv'),
} as any as Column;

const mockInvisibleColumn3 = {
  getColId: vi.fn().mockReturnValue('column3'),
  getColDef: vi.fn().mockReturnValue({ headerName: 'column3' }),
  getDataAsCsv: vi.fn().mockReturnValue('csv'),
} as any as Column;

const mockGridApi = {
  autoSizeColumns: vi.fn(),
  autoSizeAllColumns: vi.fn(),
  getColumn: vi.fn().mockReturnValue({
    getColDef: vi.fn().mockReturnValue({}),
  }),
  getColumns: vi.fn().mockReturnValue([]),
  getDataAsCsv: vi.fn().mockReturnValue('csv'),
  exportDataAsCsv: vi.fn().mockReturnValue('csv'),
  getAllDisplayedColumns: vi.fn().mockReturnValue([]),
  setColumnsPinned: vi.fn(),
  setColumnsVisible: vi.fn(),
  setColumnVisible: vi.fn(),
  moveColumns: vi.fn(),
} as any as GridApi;

const mockedProps = {
  colId: 'column1',
  invisibleColumns: [],
  api: mockGridApi,
  onVisibleChange: vi.fn(),
};

afterEach(() => {
  (mockGridApi.getDataAsCsv as vi.Mock).mockClear();
  (mockGridApi.setColumnsPinned as vi.Mock).mockClear();
  (mockGridApi.setColumnsVisible as vi.Mock).mockClear();
  (mockGridApi.setColumnsVisible as vi.Mock).mockClear();
  (mockGridApi.setColumnsPinned as vi.Mock).mockClear();
  (mockGridApi.autoSizeColumns as vi.Mock).mockClear();
  (mockGridApi.autoSizeAllColumns as vi.Mock).mockClear();
  (mockGridApi.moveColumns as vi.Mock).mockClear();
});

const setup = (props: HeaderMenuProps = mockedProps) => {
  const wrapper = render(<HeaderMenu {...props} />);
  const dropdownTrigger = wrapper.getByTestId('dropdown-trigger');
  userEvent.click(dropdownTrigger);

  return wrapper;
};

test('renders copy data', async () => {
  const { getByText } = setup();
  userEvent.click(getByText('Copy'));
  await waitFor(() =>
    expect(mockGridApi.getDataAsCsv).toHaveBeenCalledTimes(1),
  );
  expect(mockGridApi.getDataAsCsv).toHaveBeenCalledWith({
    columnKeys: [mockedProps.colId],
    suppressQuotes: true,
  });
});

test('renders buttons pinning both sides', () => {
  const { queryByText, getByText } = setup();
  expect(queryByText('Pin Left')).toBeInTheDocument();
  expect(queryByText('Pin Right')).toBeInTheDocument();
  userEvent.click(getByText('Pin Left'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledWith(
    [mockedProps.colId],
    'left',
  );
  userEvent.click(getByText('Pin Right'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenLastCalledWith(
    [mockedProps.colId],
    'right',
  );
});

test('renders unpin on pinned left', () => {
  const { queryByText, getByText } = setup({
    ...mockedProps,
    pinnedLeft: true,
  });
  expect(queryByText('Pin Left')).not.toBeInTheDocument();
  expect(queryByText('Unpin')).toBeInTheDocument();
  userEvent.click(getByText('Unpin'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledWith(
    [mockedProps.colId],
    null,
  );
});

test('renders unpin on pinned right', () => {
  const { queryByText } = setup({ ...mockedProps, pinnedRight: true });
  expect(queryByText('Pin Right')).not.toBeInTheDocument();
  expect(queryByText('Unpin')).toBeInTheDocument();
});

test('renders autosize column', async () => {
  const { getByText } = setup();
  userEvent.click(getByText('Autosize Column'));
  await waitFor(() =>
    expect(mockGridApi.autoSizeColumns).toHaveBeenCalledTimes(1),
  );
});

test('renders unhide when invisible column exists', async () => {
  const { queryByText, getByText } = setup({
    ...mockedProps,
    invisibleColumns: [mockInvisibleColumn],
  });
  expect(queryByText('Unhide')).toBeInTheDocument();
  userEvent.click(getByText('Unhide'));
  const unhideColumnsButton = await screen.findByText('column2');
  userEvent.click(unhideColumnsButton);
  expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(['column2'], true);
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('for main menu', () => {
  test('renders Copy to Clipboard', async () => {
    const { getByText } = setup({ ...mockedProps, isMain: true });
    userEvent.click(getByText('Copy the current data'));
    await waitFor(() =>
      expect(mockGridApi.getDataAsCsv).toHaveBeenCalledTimes(1),
    );
    expect(mockGridApi.getDataAsCsv).toHaveBeenCalledWith({
      columnKeys: [],
      columnSeparator: '\t',
      suppressQuotes: true,
    });
  });

  test('renders Download to CSV', async () => {
    const { getByText } = setup({ ...mockedProps, isMain: true });
    userEvent.click(getByText('Download to CSV'));
    await waitFor(() =>
      expect(mockGridApi.exportDataAsCsv).toHaveBeenCalledTimes(1),
    );
    expect(mockGridApi.exportDataAsCsv).toHaveBeenCalledWith({
      columnKeys: [],
    });
  });

  test('renders autosize column', async () => {
    const { getByText } = setup({ ...mockedProps, isMain: true });
    userEvent.click(getByText('Autosize all columns'));
    await waitFor(() =>
      expect(mockGridApi.autoSizeAllColumns).toHaveBeenCalledTimes(1),
    );
  });

  test('renders all unhide all hidden columns when multiple invisible columns exist', async () => {
    setup({
      ...mockedProps,
      isMain: true,
      invisibleColumns: [mockInvisibleColumn, mockInvisibleColumn3],
    });
    userEvent.click(screen.getByText('Unhide'));
    const unhideColumnsButton = await screen.findByText(`All 2 hidden columns`);
    userEvent.click(unhideColumnsButton);
    expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(1);
    expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(
      [mockInvisibleColumn, mockInvisibleColumn3],
      true,
    );
  });

  test('reset columns configuration', async () => {
    const { getByText } = setup({
      ...mockedProps,
      isMain: true,
      invisibleColumns: [mockInvisibleColumn],
    });
    userEvent.click(getByText('Reset columns'));
    await waitFor(() =>
      expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(1),
    );
    expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(
      [mockInvisibleColumn],
      true,
    );
    expect(mockGridApi.setColumnsPinned).toHaveBeenCalledTimes(1);
    expect(mockGridApi.setColumnsPinned).toHaveBeenCalledWith([], null);
    expect(mockGridApi.moveColumns).toHaveBeenCalledTimes(1);
  });
});

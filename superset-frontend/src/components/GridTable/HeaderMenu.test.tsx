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
  fireEvent,
  render,
  waitFor,
  screen,
} from 'spec/helpers/testing-library';
import HeaderMenu from './HeaderMenu';

jest.mock('src/components/Menu', () => {
  const Menu = ({ children }: { children: React.ReactChild }) => (
    <div data-test="mock-Menu">{children}</div>
  );
  Menu.Item = ({
    children,
    onClick,
  }: {
    children: React.ReactChild;
    onClick: () => void;
  }) => (
    <button type="button" data-test="mock-Item" onClick={onClick}>
      {children}
    </button>
  );
  Menu.SubMenu = ({
    title,
    children,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {title}
      <button type="button" data-test="mock-SubMenu">
        {children}
      </button>
    </div>
  );
  Menu.Divider = () => <div data-test="mock-Divider" />;
  return { Menu };
});

jest.mock('src/components/Icons', () => ({
  DownloadOutlined: () => <div data-test="mock-DownloadOutlined" />,
  CopyOutlined: () => <div data-test="mock-CopyOutlined" />,
  UnlockOutlined: () => <div data-test="mock-UnlockOutlined" />,
  VerticalRightOutlined: () => <div data-test="mock-VerticalRightOutlined" />,
  VerticalLeftOutlined: () => <div data-test="mock-VerticalLeftOutlined" />,
  EyeInvisibleOutlined: () => <div data-test="mock-EyeInvisibleOutlined" />,
  EyeOutlined: () => <div data-test="mock-EyeOutlined" />,
  ColumnWidthOutlined: () => <div data-test="mock-column-width" />,
}));

jest.mock('src/components/Dropdown', () => ({
  Dropdown: ({ overlay }: { overlay: React.ReactChild }) => (
    <div data-test="mock-Dropdown">{overlay}</div>
  ),
}));

jest.mock('src/utils/copy', () => jest.fn().mockImplementation(f => f()));

const mockInvisibleColumn = {
  getColId: jest.fn().mockReturnValue('column2'),
  getColDef: jest.fn().mockReturnValue({ headerName: 'column2' }),
  getDataAsCsv: jest.fn().mockReturnValue('csv'),
} as any as Column;

const mockInvisibleColumn3 = {
  getColId: jest.fn().mockReturnValue('column3'),
  getColDef: jest.fn().mockReturnValue({ headerName: 'column3' }),
  getDataAsCsv: jest.fn().mockReturnValue('csv'),
} as any as Column;

const mockGridApi = {
  autoSizeColumns: jest.fn(),
  autoSizeAllColumns: jest.fn(),
  getColumn: jest.fn().mockReturnValue({
    getColDef: jest.fn().mockReturnValue({}),
  }),
  getColumns: jest.fn().mockReturnValue([]),
  getDataAsCsv: jest.fn().mockReturnValue('csv'),
  exportDataAsCsv: jest.fn().mockReturnValue('csv'),
  getAllDisplayedColumns: jest.fn().mockReturnValue([]),
  setColumnsPinned: jest.fn(),
  setColumnsVisible: jest.fn(),
  setColumnVisible: jest.fn(),
  moveColumns: jest.fn(),
} as any as GridApi;

const mockedProps = {
  colId: 'column1',
  invisibleColumns: [],
  api: mockGridApi,
  onVisibleChange: jest.fn(),
};

afterEach(() => {
  (mockGridApi.getDataAsCsv as jest.Mock).mockClear();
  (mockGridApi.setColumnsPinned as jest.Mock).mockClear();
  (mockGridApi.setColumnsVisible as jest.Mock).mockClear();
  (mockGridApi.setColumnsVisible as jest.Mock).mockClear();
  (mockGridApi.setColumnsPinned as jest.Mock).mockClear();
  (mockGridApi.autoSizeColumns as jest.Mock).mockClear();
  (mockGridApi.autoSizeAllColumns as jest.Mock).mockClear();
  (mockGridApi.moveColumns as jest.Mock).mockClear();
});

test('renders copy data', async () => {
  const { getByText } = render(<HeaderMenu {...mockedProps} />);
  fireEvent.click(getByText('Copy'));
  await waitFor(() =>
    expect(mockGridApi.getDataAsCsv).toHaveBeenCalledTimes(1),
  );
  expect(mockGridApi.getDataAsCsv).toHaveBeenCalledWith({
    columnKeys: [mockedProps.colId],
    suppressQuotes: true,
  });
});

test('renders buttons pinning both sides', () => {
  const { queryByText, getByText } = render(<HeaderMenu {...mockedProps} />);
  expect(queryByText('Pin Left')).toBeInTheDocument();
  expect(queryByText('Pin Right')).toBeInTheDocument();
  fireEvent.click(getByText('Pin Left'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledWith(
    [mockedProps.colId],
    'left',
  );
  fireEvent.click(getByText('Pin Right'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenLastCalledWith(
    [mockedProps.colId],
    'right',
  );
});

test('renders unpin on pinned left', () => {
  const { queryByText, getByText } = render(
    <HeaderMenu {...mockedProps} pinnedLeft />,
  );
  expect(queryByText('Pin Left')).not.toBeInTheDocument();
  expect(queryByText('Unpin')).toBeInTheDocument();
  fireEvent.click(getByText('Unpin'));
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsPinned).toHaveBeenCalledWith(
    [mockedProps.colId],
    null,
  );
});

test('renders unpin on pinned right', () => {
  const { queryByText } = render(<HeaderMenu {...mockedProps} pinnedRight />);
  expect(queryByText('Pin Right')).not.toBeInTheDocument();
  expect(queryByText('Unpin')).toBeInTheDocument();
});

test('renders autosize column', async () => {
  const { getByText } = render(<HeaderMenu {...mockedProps} />);
  fireEvent.click(getByText('Autosize Column'));
  await waitFor(() =>
    expect(mockGridApi.autoSizeColumns).toHaveBeenCalledTimes(1),
  );
});

test('renders unhide when invisible column exists', async () => {
  const { queryByText } = render(
    <HeaderMenu {...mockedProps} invisibleColumns={[mockInvisibleColumn]} />,
  );
  expect(queryByText('Unhide')).toBeInTheDocument();
  const unhideColumnsButton = await screen.findByText('column2');
  fireEvent.click(unhideColumnsButton);
  expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(1);
  expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(['column2'], true);
});

describe('for main menu', () => {
  test('renders Copy to Clipboard', async () => {
    const { getByText } = render(<HeaderMenu {...mockedProps} isMain />);
    fireEvent.click(getByText('Copy the current data'));
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
    const { getByText } = render(<HeaderMenu {...mockedProps} isMain />);
    fireEvent.click(getByText('Download to CSV'));
    await waitFor(() =>
      expect(mockGridApi.exportDataAsCsv).toHaveBeenCalledTimes(1),
    );
    expect(mockGridApi.exportDataAsCsv).toHaveBeenCalledWith({
      columnKeys: [],
    });
  });

  test('renders autosize column', async () => {
    const { getByText } = render(<HeaderMenu {...mockedProps} isMain />);
    fireEvent.click(getByText('Autosize all columns'));
    await waitFor(() =>
      expect(mockGridApi.autoSizeAllColumns).toHaveBeenCalledTimes(1),
    );
  });

  test('renders all unhide all hidden columns when multiple invisible columns exist', async () => {
    render(
      <HeaderMenu
        {...mockedProps}
        isMain
        invisibleColumns={[mockInvisibleColumn, mockInvisibleColumn3]}
      />,
    );
    const unhideColumnsButton = await screen.findByText(
      `All ${2} hidden columns`,
    );
    fireEvent.click(unhideColumnsButton);
    expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(1);
    expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(
      [mockInvisibleColumn, mockInvisibleColumn3],
      true,
    );
  });

  test('reset columns configuration', async () => {
    const { getByText } = render(
      <HeaderMenu
        {...mockedProps}
        isMain
        invisibleColumns={[mockInvisibleColumn]}
      />,
    );
    fireEvent.click(getByText('Reset columns'));
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

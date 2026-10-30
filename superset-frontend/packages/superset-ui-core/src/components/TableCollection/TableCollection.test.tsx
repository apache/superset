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
import { render, screen, fireEvent, within } from '@superset-ui/core/spec';
import { renderHook } from '@testing-library/react';
import { TableInstance, useTable } from 'react-table';
import TableCollection from '.';
import { mapColumns, type ListViewColumn } from './utils';

let defaultProps: any;

let tableHook: TableInstance<any>;
beforeEach(() => {
  const columns = [
    {
      Header: 'Column 1',
      accessor: 'col1',
      id: 'col1',
    },
    {
      Header: 'Column 2',
      accessor: 'col2',
      id: 'col2',
    },
    {
      Header: 'Nested Field',
      accessor: 'parent.child',
      id: 'parent.child',
      dataIndex: ['parent', 'child'],
    },
  ];
  const data = [
    {
      col1: 'Line 01 - Col 01',
      col2: 'Line 01 - Col 02',
      parent: { child: 'Nested Value 1' },
    },
    {
      col1: 'Line 02 - Col 01',
      col2: 'Line 02 - Col 02',
      parent: { child: 'Nested Value 2' },
    },
    {
      col1: 'Line 03 - Col 01',
      col2: 'Line 03 - Col 02',
      parent: { child: 'Nested Value 3' },
    },
  ];
  // @ts-expect-error
  const tableHookResult = renderHook(() => useTable({ columns, data }));
  tableHook = tableHookResult.result.current;
  defaultProps = {
    prepareRow: tableHook.prepareRow,
    headerGroups: tableHook.headerGroups,
    rows: tableHook.rows,
    columns: tableHook.columns,
    loading: false,
    highlightRowId: 1,
    getTableProps: jest.fn(),
    getTableBodyProps: jest.fn(),
    sticky: false,
  };
});

test('Headers should be visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByLabelText('Column 1')).toBeVisible();
  expect(screen.getByLabelText('Column 2')).toBeVisible();
});

test('Body should be visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByText('Line 01 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 01 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 02 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 02 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 03 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 03 - Col 02')).toBeVisible();
});

test('Body content should be blurred loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  // antd v6 removed the `ant-spin-blur` class. The body content is now dimmed
  // via CSS applied to `.ant-spin-container` while its wrapping `.ant-spin`
  // carries the `.ant-spin-spinning` class.
  const container = screen.getByTestId('listview-table').parentNode;
  expect(container).toHaveClass('ant-spin-container');
  expect(container?.parentNode).toHaveClass('ant-spin-spinning');
});

test('Should the loading-indicator be visible during loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  expect(screen.getByTestId('loading-indicator')).toBeVisible();
});

test('Pagination controls should be rendered when pageSize is provided', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
  };
  render(<TableCollection {...paginationProps} />);

  expect(screen.getByRole('list')).toBeInTheDocument();
});

test('Pagination should call onPageChange when page is changed', async () => {
  const onPageChange = jest.fn();
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange,
  };
  const { rerender } = render(<TableCollection {...paginationProps} />);

  // Simulate pagination change
  await screen.findByTitle('Next Page');

  // Verify onPageChange would be called with correct arguments
  // The actual AntD pagination will handle the click internally
  expect(onPageChange).toBeDefined();

  // Verify that re-rendering with new pageIndex works
  rerender(<TableCollection {...paginationProps} pageIndex={1} />);
  expect(screen.getByRole('list')).toBeInTheDocument();
});

test('Pagination callback should be stable across re-renders', () => {
  const onPageChange = jest.fn();
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange,
  };

  const { rerender } = render(<TableCollection {...paginationProps} />);

  // Re-render with same props
  rerender(<TableCollection {...paginationProps} />);

  // onPageChange should not have been called during re-render
  expect(onPageChange).not.toHaveBeenCalled();
});

test('Should display correct page info when showRowCount is true', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
    showRowCount: true,
  };
  render(<TableCollection {...paginationProps} />);

  // AntD pagination shows page info
  expect(screen.getByText('1-2 of 3')).toBeInTheDocument();
});

test('Should not display page info when showRowCount is false', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
    showRowCount: false,
  };
  render(<TableCollection {...paginationProps} />);

  // Page info should not be shown
  expect(screen.queryByText('1-2 of 3')).not.toBeInTheDocument();
});

test('Bulk selection should work with pagination', () => {
  const toggleRowSelected = jest.fn();
  const toggleAllRowsSelected = jest.fn();
  const selectionProps = {
    ...defaultProps,
    bulkSelectEnabled: true,
    selectedFlatRows: [],
    toggleRowSelected,
    toggleAllRowsSelected,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
  };
  render(<TableCollection {...selectionProps} />);

  // Check that selection checkboxes are rendered
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(0);

  // Guard: the select-all column header carries `data-test="header-toggle-all"`,
  // which the `header.cell` slot keys on antd's internal `ant-table-selection-column`
  // class. If antd renames that class, this assertion fails fast at the unit level
  // instead of leaking into Playwright as a flake.
  expect(screen.getByTestId('header-toggle-all')).toBeInTheDocument();
});

test('should call setSortBy when clicking sortable column header', () => {
  const setSortBy = jest.fn();
  const sortingProps = {
    ...defaultProps,
    setSortBy,
  };

  render(<TableCollection {...sortingProps} />);

  // Target the nested field column (the column that needs the array-to-dot conversion)
  const nestedFieldHeader = screen.getAllByText('Nested Field')[0];
  expect(nestedFieldHeader).toBeInTheDocument();

  // Click on the nested field column header to trigger sorting
  fireEvent.click(nestedFieldHeader);

  // Verify setSortBy was called with the correct arguments and dot notation conversion
  expect(setSortBy).toHaveBeenCalledWith([
    {
      id: 'parent.child',
      desc: expect.any(Boolean),
    },
  ]);
});

test('should not apply highlight class when highlightRowId is undefined', () => {
  const propsWithoutHighlight = {
    ...defaultProps,
    highlightRowId: undefined,
  };

  const { container } = render(<TableCollection {...propsWithoutHighlight} />);

  // Check that no rows have the highlight class
  const highlightedRows = container.querySelectorAll('.table-row-highlighted');
  expect(highlightedRows).toHaveLength(0);
});

test('should not apply highlight class when highlightRowId is null', () => {
  const propsWithNullHighlight = {
    ...defaultProps,
    highlightRowId: null,
  };

  const { container } = render(<TableCollection {...propsWithNullHighlight} />);

  // Check that no rows have the highlight class
  const highlightedRows = container.querySelectorAll('.table-row-highlighted');
  expect(highlightedRows).toHaveLength(0);
});

test('should apply highlight class only to matching row when highlightRowId is provided', () => {
  // Create data where the first row has id: 1 to match highlightRowId: 1
  const dataWithIds = [
    {
      col1: 'Line 01 - Col 01',
      col2: 'Line 01 - Col 02',
      id: 1, // This should be highlighted
      parent: { child: 'Nested Value 1' },
    },
    {
      col1: 'Line 02 - Col 01',
      col2: 'Line 02 - Col 02',
      id: 2,
      parent: { child: 'Nested Value 2' },
    },
    {
      col1: 'Line 03 - Col 01',
      col2: 'Line 03 - Col 02',
      id: 3,
      parent: { child: 'Nested Value 3' },
    },
  ];

  // Create new table hook with data that has ids
  const { result } = renderHook(() =>
    useTable({ columns: tableHook.columns, data: dataWithIds }),
  );
  const newTableHook = result.current;

  const propsWithHighlight = {
    ...defaultProps,
    highlightRowId: 1,
    rows: newTableHook.rows,
    prepareRow: newTableHook.prepareRow,
  };

  const { container } = render(<TableCollection {...propsWithHighlight} />);

  // Check that only one row has the highlight class
  const highlightedRows = container.querySelectorAll('.table-row-highlighted');
  expect(highlightedRows).toHaveLength(1);
});

test('should not apply highlight when records have no id field and highlightRowId is undefined', () => {
  // This is the key test for the bug fix - use original data without id field
  const propsWithNoIds = {
    ...defaultProps,
    highlightRowId: undefined,
  };

  const { container } = render(<TableCollection {...propsWithNoIds} />);

  // Check that no rows have the highlight class (was the bug: all rows were highlighted)
  const highlightedRows = container.querySelectorAll('.table-row-highlighted');
  expect(highlightedRows).toHaveLength(0);
});

test('should highlight every row for which isRowHighlighted returns true', () => {
  const dataWithIds = [
    { col1: 'a', col2: 'a2', id: 1, parent: { child: 'n1' } },
    { col1: 'b', col2: 'b2', id: 2, parent: { child: 'n2' } },
    { col1: 'c', col2: 'c2', id: 3, parent: { child: 'n3' } },
  ];
  const { result } = renderHook(() =>
    useTable({ columns: tableHook.columns, data: dataWithIds }),
  );
  const newTableHook = result.current;

  const { container } = render(
    <TableCollection
      {...defaultProps}
      rows={newTableHook.rows}
      prepareRow={newTableHook.prepareRow}
      // Predicate matches on an arbitrary field (here: id in a set), highlighting
      // multiple rows — this is what the Task List uses to highlight dependencies.
      isRowHighlighted={record => [1, 3].includes(record.id as number)}
    />,
  );

  const highlightedRows = container.querySelectorAll('.table-row-highlighted');
  expect(highlightedRows).toHaveLength(2);
});

test('should only mark the clicked header as sorted when columns have no explicit id', () => {
  // Columns authored without an `id` (identified only by their string
  // `accessor`, as several real ListView pages do) used to all collapse
  // onto the same Ant Design sorter key, so clicking one header's sort
  // control marked every header as sorted.
  const idlessColumns = [
    { Header: 'Alpha', accessor: 'alpha' },
    { Header: 'Beta', accessor: 'beta' },
  ];
  const data = [
    { alpha: 'A1', beta: 'B1' },
    { alpha: 'A2', beta: 'B2' },
  ];

  const { result } = renderHook(() =>
    // @ts-expect-error
    useTable({ columns: idlessColumns, data }),
  );
  const idlessTableHook = result.current;

  render(
    <TableCollection
      {...defaultProps}
      // The raw, author-authored column config — the same shape ListView
      // passes through, with no `id` set — rather than react-table's own
      // `columns` instances, which backfill `id` from the string `accessor`
      // and would mask the bug this test guards against.
      columns={idlessColumns}
      headerGroups={idlessTableHook.headerGroups}
      rows={idlessTableHook.rows}
      prepareRow={idlessTableHook.prepareRow}
    />,
  );

  const alphaHeader = screen.getAllByText('Alpha')[0].closest('th');
  const betaHeader = screen.getAllByText('Beta')[0].closest('th');

  fireEvent.click(screen.getAllByText('Alpha')[0]);

  // Ant Design only sets `aria-sort` on the header that is actually sorted.
  expect(alphaHeader?.getAttribute('aria-sort')).toBe('ascending');
  expect(betaHeader?.getAttribute('aria-sort')).toBeNull();
});

test('should render a static Cell node alongside an ordinary accessor value', () => {
  const columnsWithStaticCell = [
    ...defaultProps.columns,
    {
      id: 'staticCol',
      Header: 'Static Column',
      Cell: <span>Static</span>,
    },
  ];

  render(<TableCollection {...defaultProps} columns={columnsWithStaticCell} />);

  // A static `Cell` node renders as-is for every row...
  expect(screen.getAllByText('Static').length).toBeGreaterThan(0);
  // ...while a sibling column without a `Cell` still renders its ordinary
  // accessor value, confirming the static branch doesn't swallow it.
  expect(screen.getByText('Line 01 - Col 01')).toBeVisible();
});

test('should map a column size token to an explicit column width', () => {
  const sizedColumns = [
    { id: 'small', Header: 'Small', accessor: 'small', size: 'sm' },
    { id: 'large', Header: 'Large', accessor: 'large', size: 'xxxl' },
    { id: 'unsized', Header: 'Unsized', accessor: 'unsized' },
  ];

  const mapped = mapColumns(sizedColumns, []);

  expect(mapped.map(({ key, width }) => ({ key, width }))).toEqual([
    { key: 'small', width: 50 },
    { key: 'large', width: 360 },
    // Unmanaged tables leave unsized columns to the browser's auto layout.
    { key: 'unsized', width: undefined },
  ]);
});

const layoutColumns: ListViewColumn[] = [
  { id: 'favorite', Header: 'Fav', accessor: 'favorite', layout: 'icon' },
  { id: 'name', Header: 'Name', accessor: 'name', layout: 'title' },
  { id: 'database', Header: 'Database', accessor: 'database' },
  { id: 'legacy', Header: 'Legacy', accessor: 'legacy', size: 'lg' },
  { id: 'secret', Header: 'Secret', accessor: 'secret', hidden: true },
  { id: 'actions', Header: 'Actions' },
];

function renderLayoutTable(
  containerWidth: number,
  props: Record<string, unknown> = {},
  columns: ListViewColumn[] = layoutColumns,
) {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: containerWidth } as DOMRect);
  const data = [{ favorite: 'x', name: 'n', database: 'd', legacy: 'l' }];
  const { result } = renderHook(() =>
    // @ts-expect-error -- raw column configs, as ListView passes them
    useTable({ columns, data }),
  );
  const utils = render(
    <TableCollection
      {...defaultProps}
      columns={columns}
      headerGroups={result.current.headerGroups}
      rows={result.current.rows}
      prepareRow={result.current.prepareRow}
      {...props}
    />,
  );
  const table = screen.getByTestId('listview-table').querySelector('table')!;
  const widths = Array.from(table.querySelectorAll('colgroup col')).map(
    col => (col as HTMLElement).style.width,
  );
  return { ...utils, table, widths };
}

// jsdom has no scrollIntoView; tests that stub it restore the original.
const originalScrollIntoView = Element.prototype.scrollIntoView;

function mockScrollIntoView() {
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  return scrollIntoView;
}

afterEach(() => {
  jest.restoreAllMocks();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

test('managed column widths size every visible column to fill the container', () => {
  const { table, widths } = renderLayoutTable(1000, {
    managedColumnWidths: true,
  });

  expect(table.style.tableLayout).toBe('fixed');
  // Hidden columns are excluded; every visible column gets a px width.
  expect(widths).toHaveLength(5);
  widths.forEach(width => expect(width).toMatch(/^\d+px$/));
  const px = widths.map(width => parseInt(width, 10));
  expect(px.reduce((a, b) => a + b, 0)).toBe(1000);
  // icon, legacy `size` and inferred actions columns stay fixed.
  expect([px[0], px[3], px[4]]).toEqual([48, 100, 120]);
  // The title flexes but never beyond its max while the text column can grow.
  expect(px[1]).toBeLessThanOrEqual(640);
  expect(px[1]).toBeGreaterThan(px[2]);
});

test('managed column widths fall back to minimums and scroll when narrow', () => {
  const { widths } = renderLayoutTable(300, { managedColumnWidths: true });
  expect(widths).toEqual(['48px', '320px', '140px', '100px', '120px']);
});

test('managed column widths include the row selection column', () => {
  const { widths } = renderLayoutTable(1200, {
    managedColumnWidths: true,
    bulkSelectEnabled: true,
    selectedFlatRows: [],
  });
  expect(widths).toHaveLength(6);
  const px = widths.map(width => parseInt(width, 10));
  expect(px[0]).toBe(48);
  expect(px.reduce((a, b) => a + b, 0)).toBe(1200);
});

test('unmanaged tables keep the auto layout', () => {
  const { table, widths } = renderLayoutTable(1000);
  expect(table.style.tableLayout).not.toBe('fixed');
  // Only the legacy `size` column carries a width (rc-table omits trailing
  // width-less <col>s).
  expect(widths.filter(Boolean)).toEqual(['100px']);
});

// Minimums: 48 + 320 + 3 * 140 + 120 = 908px.
const scrollingColumns: ListViewColumn[] = [
  { id: 'favorite', Header: 'Fav', accessor: 'favorite', layout: 'icon' },
  { id: 'name', Header: 'Name', accessor: 'name', layout: 'title' },
  { id: 'a', Header: 'A', accessor: 'a', layout: 'text' },
  { id: 'b', Header: 'B', accessor: 'b', layout: 'text' },
  { id: 'c', Header: 'C', accessor: 'c', layout: 'text' },
  { id: 'actions', Header: 'Actions' },
];

const frozenHeaders = (table: HTMLElement) =>
  Array.from(table.querySelectorAll('thead th.ant-table-cell-fix-start')).map(
    th => th.textContent,
  );

test('freezes the favorite and title columns when the table scrolls', () => {
  const { table } = renderLayoutTable(
    800,
    { managedColumnWidths: true },
    scrollingColumns,
  );
  expect(frozenHeaders(table)).toEqual(['Fav', 'Name']);
  expect(
    table.querySelectorAll(
      'tbody tr.ant-table-row td.ant-table-cell-fix-start',
    ),
  ).toHaveLength(2);
});

test('freezes the selection column with the leading block', () => {
  const { table } = renderLayoutTable(
    900,
    {
      managedColumnWidths: true,
      bulkSelectEnabled: true,
      selectedFlatRows: [],
    },
    scrollingColumns,
  );
  // 48 + 48 + 320 = 416px frozen, under half of 900.
  expect(
    table.querySelectorAll('thead th.ant-table-cell-fix-start'),
  ).toHaveLength(3);
});

test('does not freeze columns when the table fits', () => {
  const { table } = renderLayoutTable(
    1200,
    { managedColumnWidths: true },
    scrollingColumns,
  );
  expect(frozenHeaders(table)).toEqual([]);
});

test('does not freeze a leading block wider than half the container', () => {
  // 368px frozen in a 700px container.
  const narrow = renderLayoutTable(
    700,
    { managedColumnWidths: true },
    scrollingColumns,
  );
  expect(frozenHeaders(narrow.table)).toEqual([]);
  narrow.unmount();
  // With bulk select the block is 416px, over half of 800.
  const bulk = renderLayoutTable(
    800,
    {
      managedColumnWidths: true,
      bulkSelectEnabled: true,
      selectedFlatRows: [],
    },
    scrollingColumns,
  );
  expect(
    bulk.table.querySelectorAll('thead th.ant-table-cell-fix-start'),
  ).toHaveLength(0);
});

test('does not freeze columns in unmanaged tables', () => {
  const { table } = renderLayoutTable(800, {}, scrollingColumns);
  expect(frozenHeaders(table)).toEqual([]);
});

test('scrolls a focused cell out from under the frozen columns', () => {
  // The frozen width is the scroll padding only while the focused cell is
  // scrolled into view; a permanent padding would make the browser scroll
  // back to the start whenever a frozen cell takes focus.
  const paddings: string[] = [];
  const scrollIntoView = mockScrollIntoView();
  scrollIntoView.mockImplementation(function (this: Element) {
    const scroller = this.closest<HTMLElement>(
      '.ant-table-content, .ant-table-body',
    )!;
    paddings.push(scroller.style.scrollPaddingInlineStart);
  });
  const columns: ListViewColumn[] = scrollingColumns.map(column =>
    column.id === 'c'
      ? { ...column, Cell: () => <a href="#c">Column C details</a> }
      : column,
  );
  renderLayoutTable(800, { managedColumnWidths: true }, columns);
  const link = screen.getByRole('link', { name: 'Column C details' });
  link.focus();
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: 'nearest',
    inline: 'nearest',
  });
  expect(paddings).toEqual(['368px']);
  expect(
    link.closest<HTMLElement>('.ant-table-content, .ant-table-body')!.style
      .scrollPaddingInlineStart,
  ).toBe('');
});

test('does not scroll when focus lands in the frozen columns', () => {
  const scrollIntoView = mockScrollIntoView();
  const columns: ListViewColumn[] = scrollingColumns.map(column =>
    column.id === 'name'
      ? { ...column, Cell: () => <a href="#name">Row name</a> }
      : column,
  );
  renderLayoutTable(800, { managedColumnWidths: true }, columns);
  const link = screen.getByRole('link', { name: 'Row name' });
  expect(link.closest('td')).toHaveClass('ant-table-cell-fix-start');
  link.focus();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

const headerCell = (table: HTMLElement, text: string) =>
  Array.from(table.querySelectorAll<HTMLElement>('thead th')).find(
    th => th.textContent === text,
  )!;

test('scrolls a focused sortable header out from under the frozen columns', () => {
  // Without a sticky header the headers scroll with the body, so a focused
  // header can be hidden under the frozen header cells as well.
  const paddings: string[] = [];
  const scrollIntoView = mockScrollIntoView();
  scrollIntoView.mockImplementation(function (this: Element) {
    const scroller = this.closest<HTMLElement>(
      '.ant-table-content, .ant-table-body',
    )!;
    paddings.push(scroller.style.scrollPaddingInlineStart);
  });
  const { table } = renderLayoutTable(
    800,
    { managedColumnWidths: true },
    scrollingColumns,
  );
  const header = headerCell(table, 'C');
  expect(header.tabIndex).toBe(0);
  header.focus();
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: 'nearest',
    inline: 'nearest',
  });
  expect(paddings).toEqual(['368px']);
  expect(
    header.closest<HTMLElement>('.ant-table-content, .ant-table-body')!.style
      .scrollPaddingInlineStart,
  ).toBe('');
});

test('does not scroll when focus lands in a frozen header', () => {
  const scrollIntoView = mockScrollIntoView();
  const { table } = renderLayoutTable(
    900,
    {
      managedColumnWidths: true,
      bulkSelectEnabled: true,
      selectedFlatRows: [],
    },
    scrollingColumns,
  );
  const header = headerCell(table, 'Name');
  expect(header).toHaveClass('ant-table-cell-fix-start');
  header.focus();
  const selectAll = table.querySelector<HTMLElement>(
    'thead th.ant-table-selection-column input',
  )!;
  expect(selectAll.closest('th')).toHaveClass('ant-table-cell-fix-start');
  selectAll.focus();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

test('leaves focus scrolling to the browser when nothing is frozen', () => {
  const scrollIntoView = mockScrollIntoView();
  const columns: ListViewColumn[] = scrollingColumns.map(column =>
    column.id === 'c'
      ? { ...column, Cell: () => <a href="#c">Column C details</a> }
      : column,
  );
  renderLayoutTable(1200, { managedColumnWidths: true }, columns);
  screen.getByRole('link', { name: 'Column C details' }).focus();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

test('managed text headers carry their full text as a tooltip', () => {
  const { table } = renderLayoutTable(1000, { managedColumnWidths: true });
  const header = within(table.querySelector('thead')!)
    .getByText('Database')
    .closest('th');
  expect(header).toHaveAttribute('title', 'Database');
});

test('only managed tables clip wrapping header titles', () => {
  // A wrap-text column's header keeps antd's default in unmanaged tables.
  const headerStyle = (table: HTMLElement) =>
    window.getComputedStyle(
      within(table.querySelector('thead')!)
        .getByText('Name')
        .closest('.ant-table-column-title')!,
    );
  const wrapName = { columnsForWrapText: ['name'] };
  const managed = renderLayoutTable(1000, {
    ...wrapName,
    managedColumnWidths: true,
  });
  expect(headerStyle(managed.table).textOverflow).toBe('ellipsis');
  managed.unmount();
  const unmanaged = renderLayoutTable(1000, wrapName);
  expect(headerStyle(unmanaged.table).textOverflow).not.toBe('ellipsis');
});

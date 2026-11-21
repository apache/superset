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
  CSSProperties,
  FocusEvent,
  HTMLAttributes,
  memo,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  HeaderGroup,
  Row,
  SortingRule,
  TableBodyPropGetter,
  TablePropGetter,
} from 'react-table';
import { styled } from '@apache-superset/core/theme';
import { Table, TableSize } from '@superset-ui/core/components/Table';
import {
  ColumnsType,
  TableRowSelection,
  SorterResult,
} from 'antd/es/table/interface';
import type { TableProps } from 'antd/es/table';
import { getColumnId, mapColumns, mapRows, type ListViewColumn } from './utils';
import {
  CELL_PADDING_X,
  UTILITY_COLUMN_WIDTH,
  getColumnLayout,
  getColumnSpec,
  getFrozenColumnCount,
  getLeadingBlockLength,
  getPinnedEndColumnCount,
  getTrailingBlockLength,
  resolveColumnWidths,
} from './columnWidths';

export type { ListViewColumn };
export type { ColumnLayout, ColumnLayoutPreset } from './columnWidths';
export {
  COLUMN_LAYOUT_PRESETS,
  FREEZE_MAX_CONTAINER_SHARE,
  FREEZE_MIN_SCROLL_PX,
  getColumnSpec,
  getFrozenColumnCount,
  getLeadingBlockLength,
  getPinnedEndColumnCount,
  getTrailingBlockLength,
  resolveColumnWidths,
} from './columnWidths';

export interface TableCollectionProps<T extends object> {
  getTableProps: TablePropGetter<T>;
  getTableBodyProps: TableBodyPropGetter<T>;
  prepareRow: (row: Row<T>) => void;
  headerGroups: HeaderGroup<T>[];
  rows: Row<T>[];
  columns: ListViewColumn<T>[];
  loading: boolean;
  highlightRowId?: number;
  // Optional predicate to highlight arbitrary rows (in addition to
  // highlightRowId). Receives the mapped record (which spreads row.original), so
  // callers can match on any field, e.g. by uuid.
  isRowHighlighted?: (record: Record<string, unknown>) => boolean;
  columnsForWrapText?: string[];
  setSortBy?: (updater: SortingRule<T>[]) => void;
  sortBy?: SortingRule<T>[];
  bulkSelectEnabled?: boolean;
  selectedFlatRows?: Row<T>[];
  toggleRowSelected?: (rowId: string, value: boolean) => void;
  toggleAllRowsSelected?: (value?: boolean) => void;
  sticky?: boolean;
  size?: TableSize;
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  isPaginationSticky?: boolean;
  showRowCount?: boolean;
  expandable?: Record<string, unknown>;
  /**
   * Resolve every visible column's width from its `layout` against the
   * measured container width, with a fixed table layout, and while the table
   * scrolls horizontally freeze the leading block (selection, favorite star,
   * title) and pin the actions column to the end. Off by default so generic
   * tables keep the browser's auto layout.
   */
  managedColumnWidths?: boolean;
}

/**
 * Tracks the width of `ref`'s element. Measured before paint so managed
 * widths don't flash; 0 when the width can't be measured (e.g. in jsdom).
 */
function useContainerWidth(
  ref: { current: HTMLElement | null },
  enabled: boolean,
) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return undefined;
    const measure = () =>
      setWidth(Math.floor(element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return width;
}

/**
 * Tracks whether the table inside `ref`'s element can scroll further toward
 * its start or end edge. Re-measured on every scroll of antd's scroll
 * container (a capturing listener, since scroll events don't bubble) and
 * whenever `measureKey` changes, e.g. after the container or table resizes.
 */
function useScrollOverflow(
  ref: { current: HTMLElement | null },
  enabled: boolean,
  measureKey: unknown,
) {
  const [overflowStart, setOverflowStart] = useState(false);
  const [overflowEnd, setOverflowEnd] = useState(false);
  const measure = useCallback(() => {
    const scroller = ref.current?.querySelector<HTMLElement>(
      '.ant-table-content, .ant-table-body',
    );
    const maxScroll = scroller
      ? scroller.scrollWidth - scroller.clientWidth
      : 0;
    // scrollLeft is negative in right-to-left layouts.
    const scrolled = scroller ? Math.abs(scroller.scrollLeft) : 0;
    setOverflowStart(maxScroll > 1 && scrolled > 0);
    setOverflowEnd(maxScroll > 1 && scrolled < maxScroll - 1);
  }, [ref]);
  useLayoutEffect(() => {
    if (enabled) measure();
  }, [enabled, measure, measureKey]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return undefined;
    element.addEventListener('scroll', measure, {
      capture: true,
      passive: true,
    });
    return () =>
      element.removeEventListener('scroll', measure, { capture: true });
  }, [ref, enabled, measure]);
  return { overflowStart, overflowEnd };
}

// Width of the scroll fade at each edge of a managed table.
const SCROLL_FADE_WIDTH = 44;

// Mask over antd's scroll container: opaque except for a fade to transparent
// at each edge with more columns beyond it. The left fade starts after the
// frozen columns and the right fade ends before the pinned columns, which
// stay opaque. Only alpha matters in a mask, so the fade works with any theme
// and any row background.
const scrollFadeMask = `linear-gradient(
  to right,
  #000 var(--list-view-frozen-width, 0px),
  rgba(0, 0, 0, var(--list-view-fade-start)) var(--list-view-frozen-width, 0px),
  #000 calc(var(--list-view-frozen-width, 0px) + ${SCROLL_FADE_WIDTH}px),
  #000 calc(100% - var(--list-view-pinned-end-width, 0px) - ${SCROLL_FADE_WIDTH}px),
  rgba(0, 0, 0, var(--list-view-fade-end)) calc(100% - var(--list-view-pinned-end-width, 0px)),
  #000 calc(100% - var(--list-view-pinned-end-width, 0px))
)`;

/**
 * Wraps managed tables. When more columns are scrolled out of view on a side,
 * the table content fades out toward that edge. The fade is a CSS mask on the
 * scroll container, so it adds no DOM node or tab stop, keeps layout and
 * hit-testing unchanged, and browsers without mask support show no fade.
 * While keyboard focus is in the table the fades are dropped, so a focused
 * cell next to an edge is never faded.
 */
const ManagedTableWrapper = styled.div`
  --list-view-fade-start: 1;
  --list-view-fade-end: 1;

  &[data-overflow-start] {
    --list-view-fade-start: 0;
  }

  &[data-overflow-end] {
    --list-view-fade-end: 0;
  }

  &:has(:focus-visible) {
    --list-view-fade-start: 1;
    --list-view-fade-end: 1;
  }

  &[data-overflow-start] .ant-table-header,
  &[data-overflow-start] .ant-table-content,
  &[data-overflow-start] .ant-table-body,
  &[data-overflow-end] .ant-table-header,
  &[data-overflow-end] .ant-table-content,
  &[data-overflow-end] .ant-table-body {
    -webkit-mask-image: ${scrollFadeMask};
    mask-image: ${scrollFadeMask};
  }

  /* The fade replaces antd's edge shadows. */
  & .ant-table-wrapper .ant-table .ant-table-container::before,
  & .ant-table-wrapper .ant-table .ant-table-container::after {
    display: none;
  }
`;

const StyledTable = styled(Table)<{
  isPaginationSticky?: boolean;
  showRowCount?: boolean;
  managedColumnWidths?: boolean;
}>`
  ${({ theme, isPaginationSticky, showRowCount, managedColumnWidths }) => `
    .actions {
      opacity: 0;
      font-size: ${theme.fontSizeXL}px;
      display: flex;
      white-space: nowrap;
      // The content box of the actions layout preset.
      min-width: ${getColumnSpec('actions').min - CELL_PADDING_X}px;
      .action-button {
        margin-right: ${theme.sizeUnit * 2}px;
        cursor: pointer;
        &:hover {
          path {
            fill: ${theme.colorPrimary};
          }
        }
      }
    }

    .ant-table-column-title {
      line-height: initial;
    }

    ${
      managedColumnWidths
        ? `
        // Headers longer than a fixed column ellipsize; antd puts the full
        // text in the header cell's title.
        .ant-table-column-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `
        : ''
    }

    .ant-table-row:hover {
      .actions {
        opacity: 1;
        transition: opacity ease-in ${theme.motionDurationMid};
      }
    }

    .ant-table-row.table-row-highlighted > td.ant-table-cell,
    .ant-table-row.table-row-highlighted > td.ant-table-cell.ant-table-cell-row-hover {
      background-color: ${theme.colorPrimaryBg};
    }

    ${
      managedColumnWidths
        ? ''
        : `
        .ant-table-cell {
          max-width: 320px;
        }
      `
    }

    .ant-table-cell {
      font-feature-settings: 'tnum' 1;
      text-overflow: ellipsis;
      overflow: hidden;
      line-height: 1;
      vertical-align: middle;
      padding-left: ${theme.sizeUnit * 4}px;
      white-space: nowrap;
    }

    .ant-table-tbody > tr > td {
      height: ${theme.sizeUnit * 12}px;
    }

    .ant-table-tbody > tr > td.ant-table-cell:has(.ant-avatar-group) {
      padding-top: ${theme.sizeUnit}px;
      padding-bottom: ${theme.sizeUnit}px;
    }

    .ant-table-placeholder .ant-table-cell {
      border-bottom: 0;
    }

    &.ant-table-wrapper .ant-table-pagination.ant-pagination {
      display: flex;
      justify-content: center;
      margin: ${showRowCount ? theme.sizeUnit * 4 : 0}px 0 ${showRowCount ? theme.sizeUnit * 14 : 0}px 0;
      position: relative;

      .ant-pagination-total-text {
        color: ${theme.colorTextBase};
        margin-inline-end: 0;
        position: absolute;
        top: ${theme.sizeUnit * 12}px;
      }

      ${
        isPaginationSticky &&
        `
        position: sticky;
        bottom: 0;
        left: 0;
        z-index: 1;
        background-color: ${theme.colorBgElevated};
        padding: ${theme.sizeUnit * 2}px 0;
      `
      }
    }

    // Hotfix - antd doesn't apply background color to overflowing cells
    & table {
      background-color: ${theme.colorBgContainer};
    }
  `}
`;

function TableCollection<T extends object>({
  columns,
  rows,
  loading,
  highlightRowId,
  isRowHighlighted,
  setSortBy,
  sortBy,
  headerGroups,
  columnsForWrapText,
  bulkSelectEnabled = false,
  selectedFlatRows = [],
  toggleRowSelected,
  toggleAllRowsSelected,
  prepareRow,
  sticky,
  size = TableSize.Middle,
  pageIndex = 0,
  pageSize = 25,
  totalCount = 0,
  onPageChange,
  isPaginationSticky = false,
  showRowCount = true,
  expandable,
  managedColumnWidths = false,
}: TableCollectionProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef, managedColumnWidths);

  const columnLayout = useMemo(() => {
    if (!managedColumnWidths) return undefined;
    const visibleColumns = columns.filter(column => !column.hidden);
    const utilityColumns = (bulkSelectEnabled ? 1 : 0) + (expandable ? 1 : 0);
    const layouts = visibleColumns.map(column => getColumnLayout(column));
    const specs = [
      ...Array(utilityColumns).fill(
        getColumnSpec({ fixed: UTILITY_COLUMN_WIDTH }),
      ),
      ...layouts.map(getColumnSpec),
    ];
    const { widths, totalWidth, scrolls } = resolveColumnWidths(
      specs,
      containerWidth,
    );
    const pinnedEndCount = getPinnedEndColumnCount({
      widths,
      trailingCount: getTrailingBlockLength(layouts),
      containerWidth,
      scrolls,
    });
    const pinnedEndWidth = widths
      .slice(widths.length - pinnedEndCount)
      .reduce((total, width) => total + width, 0);
    const leadingBlock = getLeadingBlockLength(layouts);
    const frozenCount = getFrozenColumnCount({
      widths,
      leadingCount: leadingBlock ? utilityColumns + leadingBlock : 0,
      containerWidth,
      scrolls,
      pinnedEndWidth,
    });
    const columnWidths = widths.slice(utilityColumns);
    const frozenColumns = visibleColumns.slice(
      0,
      Math.max(0, frozenCount - utilityColumns),
    );
    const pinnedEndColumns = visibleColumns.slice(
      visibleColumns.length - pinnedEndCount,
    );
    return {
      totalWidth,
      // An unmeasured container (width 0) falls back to the minimums but is
      // not known to scroll.
      scrolls: scrolls && containerWidth > 0,
      widths: Object.fromEntries(
        visibleColumns.map((column, index) => [
          getColumnId(column),
          columnWidths[index],
        ]),
      ),
      fixedColumns: Object.fromEntries([
        ...frozenColumns.map(column => [getColumnId(column), 'left' as const]),
        ...pinnedEndColumns.map(column => [
          getColumnId(column),
          'right' as const,
        ]),
      ]),
      frozenWidth: widths
        .slice(0, frozenCount)
        .reduce((total, width) => total + width, 0),
      pinnedEndWidth,
    };
  }, [
    managedColumnWidths,
    columns,
    bulkSelectEnabled,
    expandable,
    containerWidth,
  ]);

  const frozenWidth = columnLayout?.frozenWidth ?? 0;
  const pinnedEndWidth = columnLayout?.pinnedEndWidth ?? 0;
  const scrolls = columnLayout?.scrolls ?? false;
  const { overflowStart, overflowEnd } = useScrollOverflow(
    containerRef,
    managedColumnWidths,
    columnLayout,
  );

  const mappedColumns = useMemo(
    () =>
      mapColumns<T>(
        columns,
        headerGroups,
        columnsForWrapText,
        columnLayout?.widths,
        columnLayout?.fixedColumns,
        sortBy,
      ),
    [columns, headerGroups, columnsForWrapText, columnLayout, sortBy],
  );

  const mappedRows = useMemo(
    () => mapRows(rows, prepareRow),
    [rows, prepareRow],
  );

  const selectedRowKeys = useMemo(
    () => selectedFlatRows?.map(row => row.id) || [],
    [selectedFlatRows],
  );

  const rowSelection: TableRowSelection | undefined = useMemo(() => {
    if (!bulkSelectEnabled) return undefined;

    // antd Table's `rowSelection` API renders its own checkbox column.
    // The select-all `data-test` lives on the `<th>` via `header.cell`
    // below (keyed on antd's `ant-table-selection-column` className), NOT
    // via `columnTitle` — rc-table's MeasureCell renders the column
    // `title` verbatim inside `<tbody>`, so a `columnTitle` wrapper leaks
    // any `data-test` attr into the measure row and breaks Playwright
    // strict-mode selectors. `renderCell` only renders in real body rows,
    // so wrapping per-row checkboxes there is safe.
    return {
      selectedRowKeys,
      ...(managedColumnWidths && { columnWidth: UTILITY_COLUMN_WIDTH }),
      ...(frozenWidth > 0 && { fixed: 'left' as const }),
      onSelect: (record, selected) => {
        toggleRowSelected?.(record.rowId, selected);
      },
      onSelectAll: (selected: boolean) => {
        toggleAllRowsSelected?.(selected);
      },
      renderCell: (_value, _record, _index, originNode) => (
        <span data-test="row-select-checkbox">{originNode}</span>
      ),
    };
  }, [
    bulkSelectEnabled,
    selectedRowKeys,
    toggleRowSelected,
    toggleAllRowsSelected,
    managedColumnWidths,
    frozenWidth,
  ]);

  const tableExpandable = useMemo(
    () =>
      expandable && managedColumnWidths
        ? {
            columnWidth: UTILITY_COLUMN_WIDTH,
            ...(frozenWidth > 0 && { fixed: 'left' as const }),
            ...expandable,
          }
        : expandable,
    [expandable, managedColumnWidths, frozenWidth],
  );

  // While the table scrolls horizontally, a focused body cell or sortable
  // header cell (antd makes those focusable) is scrolled fully into view,
  // clear of the frozen columns and the pinned actions, which are the scroll
  // padding. The padding is only set for that scroll, since a permanent one
  // makes the browser scroll back whenever a frozen or pinned cell takes
  // focus.
  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const cell = event.target.closest('td, th');
      const scroller = cell?.closest<HTMLElement>(
        '.ant-table-content, .ant-table-body',
      );
      if (
        scrolls &&
        cell &&
        scroller &&
        !cell.classList.contains('ant-table-cell-fix-start') &&
        !cell.classList.contains('ant-table-cell-fix-end')
      ) {
        if (frozenWidth > 0) {
          scroller.style.scrollPaddingInlineStart = `${frozenWidth}px`;
        }
        if (pinnedEndWidth > 0) {
          scroller.style.scrollPaddingInlineEnd = `${pinnedEndWidth}px`;
        }
        event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        scroller.style.scrollPaddingInlineStart = '';
        scroller.style.scrollPaddingInlineEnd = '';
      }
    },
    [scrolls, frozenWidth, pinnedEndWidth],
  );

  const handlePaginationChange = useCallback(
    (page: number, size: number) => {
      const validPage = Math.max(0, (page || 1) - 1);
      const validSize = size || pageSize;
      onPageChange?.(validPage, validSize);
    },
    [pageSize, onPageChange],
  );

  const showTotalFunc = useCallback(
    (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} of ${total}`,
    [],
  );

  const handleTableChange = useCallback(
    (_pagination: any, _filters: any, sorter: SorterResult) => {
      if (sorter && sorter.field) {
        // Convert array field back to dot notation for nested fields
        const fieldId = Array.isArray(sorter.field)
          ? sorter.field.join('.')
          : sorter.field;

        setSortBy?.([
          {
            id: fieldId,
            desc: sorter.order === 'descend',
          },
        ] as SortingRule<T>[]);
      }
    },
    [setSortBy],
  );

  const paginationConfig = useMemo(() => {
    if (totalCount === 0) return false;

    const config: any = {
      pageSize,
      size: 'default' as const,
      showSizeChanger: false,
      showQuickJumper: false,
      align: 'center' as const,
      showTotal: showRowCount ? showTotalFunc : undefined,
    };

    if (onPageChange) {
      config.current = pageIndex + 1;
      config.total = totalCount;
      config.onChange = handlePaginationChange;
    } else {
      if (pageIndex > 0) config.defaultCurrent = pageIndex + 1;
      config.total = totalCount;
    }

    return config;
  }, [
    pageSize,
    totalCount,
    showRowCount,
    showTotalFunc,
    pageIndex,
    handlePaginationChange,
    onPageChange,
  ]);

  const getRowClassName = useCallback(
    (record: Record<string, unknown>) =>
      (highlightRowId !== undefined && record?.id === highlightRowId) ||
      isRowHighlighted?.(record)
        ? 'table-row-highlighted'
        : '',
    [highlightRowId, isRowHighlighted],
  );

  // Memoize the custom cell/row components. A fresh `components` object (with
  // new inner function identities) makes antd treat them as new component types
  // and remount every row and cell on each render — which would, for example,
  // tear down an open hover popover inside a cell whenever the table re-renders
  // (e.g. when rowClassName changes for row highlighting).
  const tableComponents = useMemo(
    () => ({
      header: {
        cell: (props: HTMLAttributes<HTMLTableCellElement>) => {
          const isSelectionColumn =
            props.className?.includes('ant-table-selection-column') ?? false;
          return (
            <th
              {...props}
              data-test={
                isSelectionColumn ? 'header-toggle-all' : 'sort-header'
              }
            />
          );
        },
      },
      body: {
        row: (props: HTMLAttributes<HTMLTableRowElement>) => (
          <tr {...props} data-test="table-row" />
        ),
        cell: (props: HTMLAttributes<HTMLTableCellElement>) => (
          <td {...props} data-test="table-row-cell" />
        ),
      },
    }),
    [],
  );

  const table = (
    <StyledTable
      loading={loading}
      sticky={sticky ?? false}
      // Forward-compat: TS 6.0 tightens antd Table's generic inference so our
      // typed-against-react-table mapped columns must be widened to the antd
      // ColumnsType<object> surface the Table expects here.
      columns={mappedColumns as unknown as ColumnsType<object>}
      data={mappedRows}
      size={size}
      data-test="listview-table"
      pagination={paginationConfig}
      scroll={{ x: columnLayout ? columnLayout.totalWidth : 'max-content' }}
      tableLayout={columnLayout ? 'fixed' : 'auto'}
      rowKey="rowId"
      rowSelection={rowSelection}
      locale={{ emptyText: null }}
      sortDirections={['ascend', 'descend', 'ascend']}
      isPaginationSticky={isPaginationSticky}
      showRowCount={showRowCount}
      managedColumnWidths={managedColumnWidths}
      rowClassName={
        getRowClassName as unknown as TableProps<object>['rowClassName']
      }
      expandable={tableExpandable}
      components={tableComponents}
      onChange={handleTableChange as unknown as TableProps<object>['onChange']}
    />
  );

  if (!managedColumnWidths) return table;
  return (
    <ManagedTableWrapper
      ref={containerRef}
      onFocus={handleFocus}
      data-overflow-start={overflowStart || undefined}
      data-overflow-end={overflowEnd || undefined}
      style={
        {
          '--list-view-frozen-width': `${frozenWidth}px`,
          '--list-view-pinned-end-width': `${pinnedEndWidth}px`,
        } as CSSProperties
      }
    >
      {table}
    </ManagedTableWrapper>
  );
}

// React.memo erases the wrapped component's generic type parameter; cast
// back to the original generic signature so callers can still instantiate
// TableCollection<T> explicitly.
export default memo(TableCollection) as typeof TableCollection;

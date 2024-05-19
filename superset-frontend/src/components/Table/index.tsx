/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * License); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState, useEffect, useRef, ReactElement, Key } from 'react';

import AntTable, {
  ColumnsType,
  TableProps as AntTableProps,
} from 'antd/lib/table';
import ConfigProvider from 'antd/lib/config-provider';
import { PaginationProps } from 'antd/lib/pagination';
import { t, useTheme, logging, styled } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import InteractiveTableUtils from './utils/InteractiveTableUtils';
import VirtualTable from './VirtualTable';

export const SUPERSET_TABLE_COLUMN = 'superset/table-column';

export enum SelectionType {
  Disabled = 'disabled',
  Single = 'single',
  Multi = 'multi',
}

export type SortOrder = 'descend' | 'ascend' | null;

export enum ETableAction {
  Paginate = 'paginate',
  Sort = 'sort',
  Filter = 'filter',
}

export type { ColumnsType };
export type OnChangeFunction<RecordType> =
  AntTableProps<RecordType>['onChange'];

export enum TableSize {
  Small = 'small',
  Middle = 'middle',
}

export interface TableProps<RecordType> {
  /**
   * Data that will populate the each row and map to the column key.
   */
  data: RecordType[];
  /**
   * Whether to show all table borders
   */
  bordered?: boolean;
  /**
   * Table column definitions.
   */
  columns: ColumnsType<RecordType>;
  /**
   * Array of row keys to represent list of selected rows.
   */
  selectedRows?: Key[];
  /**
   * Callback function invoked when a row is selected by user.
   */
  handleRowSelection?: (newSelectedRowKeys: Key[]) => void;
  /**
   * Controls the size of the table.
   */
  size: TableSize;
  /**
   * Controls if table rows are selectable and if multiple select is supported.
   */
  selectionType?: SelectionType;
  /*
   * Places table in visual loading state.  Use while waiting to retrieve data or perform an async operation that will update the table.
   */
  loading?: boolean;
  /**
   * Uses a sticky header which always displays when vertically scrolling the table.  Default: true
   */
  sticky?: boolean;
  /**
   * Controls if columns are resizable by user.
   */
  resizable?: boolean;
  /**
   * EXPERIMENTAL: Controls if columns are re-orderable by user drag drop.
   */
  reorderable?: boolean;
  /**
   * Controls if pagination is active or disabled.
   */
  usePagination?: boolean;
  /**
   * Default number of rows table will display per page of data.
   */
  defaultPageSize?: number;
  /**
   * Array of numeric options for the number of rows table will display per page of data.
   * The user can select from these options in the page size drop down menu.
   */
  pageSizeOptions?: string[];
  /**
   * Set table to display no data even if data has been provided
   */
  hideData?: boolean;
  /**
   * emptyComponent
   */
  emptyComponent?: ReactElement;
  /**
   * Enables setting the text displayed in various components and tooltips within the Table UI.
   */
  locale?: Partial<AntTableProps<RecordType>['locale']>;
  /**
   * Restricts the visible height of the table and allows for internal scrolling within the table
   * when the number of rows exceeds the visible space.
   */
  height?: number;
  /**
   * Sets the table to use react-window for scroll virtualization in cases where
   * there are unknown amount of columns, or many, many rows
   */
  virtualize?: boolean;
  /**
   * Used to override page controls total record count when using server-side paging.
   */
  recordCount?: number;
  /**
   * Invoked when the tables sorting, paging, or filtering is changed.
   */
  onChange?: OnChangeFunction<RecordType>;
  /**
   * Returns props that should be applied to each row component.
   */
  onRow?: AntTableProps<RecordType>['onRow'];
  /**
   * Will render html safely if set to true, anchor tags and such. Currently
   * only supported for virtualize == true
   */
  allowHTML?: boolean;

  /**
   * The column that contains children to display.
   * Check https://ant.design/components/table#table for more details.
   */
  childrenColumnName?: string;
}

const defaultRowSelection: Key[] = [];

const PAGINATION_HEIGHT = 40;
const HEADER_HEIGHT = 68;

const StyledTable = styled(AntTable)<{ height?: number }>(
  ({ theme, height }) => `
    .ant-table-body {
      overflow: auto;
      height: ${height ? `${height}px` : undefined};
    }

    th.ant-table-cell {
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.grayscale.dark1};
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ant-table-tbody > tr > td {
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 1px solid ${theme.colors.grayscale.light3};
    }

    .ant-pagination-item-active {
      border-color: ${theme.colors.primary.base};
    }

    .ant-table.ant-table-small {
      font-size: ${theme.typography.sizes.s}px;
    }
  `,
);
const StyledVirtualTable = styled(VirtualTable)(
  ({ theme }) => `
  .virtual-table .ant-table-container:before,
  .virtual-table .ant-table-container:after {
    display: none;
  }
  .virtual-table-cell {
    box-sizing: border-box;
    padding: ${theme.gridUnit * 4}px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`,
);

const defaultLocale = {
  filterTitle: t('Filter menu'),
  filterConfirm: t('OK'),
  filterReset: t('Reset'),
  filterEmptyText: t('No filters'),
  filterCheckall: t('Select all items'),
  filterSearchPlaceholder: t('Search in filters'),
  emptyText: t('No data'),
  selectAll: t('Select current page'),
  selectInvert: t('Invert current page'),
  selectNone: t('Clear all data'),
  selectionAll: t('Select all data'),
  sortTitle: t('Sort'),
  expand: t('Expand row'),
  collapse: t('Collapse row'),
  triggerDesc: t('Click to sort descending'),
  triggerAsc: t('Click to sort ascending'),
  cancelSort: t('Click to cancel sorting'),
};

const selectionMap = {};
const noop = () => {};
selectionMap[SelectionType.Multi] = 'checkbox';
selectionMap[SelectionType.Single] = 'radio';
selectionMap[SelectionType.Disabled] = null;

export function Table<RecordType extends object>(
  props: TableProps<RecordType>,
) {
  const {
    data,
    bordered,
    columns,
    selectedRows = defaultRowSelection,
    handleRowSelection,
    size = TableSize.Small,
    selectionType = SelectionType.Disabled,
    sticky = true,
    loading = false,
    resizable = false,
    reorderable = false,
    usePagination = true,
    defaultPageSize = 15,
    pageSizeOptions = ['5', '15', '25', '50', '100'],
    hideData = false,
    emptyComponent,
    locale,
    height,
    virtualize = false,
    onChange = noop,
    recordCount,
    onRow,
    allowHTML = false,
    childrenColumnName,
  } = props;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [derivedColumns, setDerivedColumns] = useState(columns);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [mergedLocale, setMergedLocale] = useState<
    Required<AntTableProps<RecordType>>['locale']
  >({ ...defaultLocale });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>(selectedRows);
  const interactiveTableUtils = useRef<InteractiveTableUtils | null>(null);

  const onSelectChange = (newSelectedRowKeys: Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    handleRowSelection?.(newSelectedRowKeys);
  };

  const selectionTypeValue = selectionMap[selectionType];
  const rowSelection = {
    type: selectionTypeValue,
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const renderEmpty = () =>
    emptyComponent ?? <div>{mergedLocale.emptyText}</div>;

  // Log use of experimental features
  useEffect(() => {
    if (reorderable === true) {
      logging.warn(
        'EXPERIMENTAL FEATURE ENABLED: The "reorderable" prop of Table is experimental and NOT recommended for use in production deployments.',
      );
    }
    if (resizable === true) {
      logging.warn(
        'EXPERIMENTAL FEATURE ENABLED: The "resizable" prop of Table is experimental and NOT recommended for use in production deployments.',
      );
    }
  }, [reorderable, resizable]);

  useEffect(() => {
    let updatedLocale;
    if (locale) {
      // This spread allows for locale to only contain a subset of locale overrides on props
      updatedLocale = { ...defaultLocale, ...locale };
    } else {
      updatedLocale = { ...defaultLocale };
    }
    setMergedLocale(updatedLocale);
  }, [locale]);

  useEffect(() => setDerivedColumns(columns), [columns]);

  useEffect(() => {
    if (interactiveTableUtils.current) {
      interactiveTableUtils.current?.clearListeners();
    }
    const table = wrapperRef.current?.getElementsByTagName('table')[0];
    if (table) {
      interactiveTableUtils.current = new InteractiveTableUtils(
        table,
        derivedColumns,
        setDerivedColumns,
      );
      if (reorderable) {
        interactiveTableUtils?.current?.initializeDragDropColumns(
          reorderable,
          table,
        );
      }
      if (resizable) {
        interactiveTableUtils?.current?.initializeResizableColumns(
          resizable,
          table,
        );
      }
    }
    return () => {
      interactiveTableUtils?.current?.clearListeners?.();
    };
    /**
     * We DO NOT want this effect to trigger when derivedColumns changes as it will break functionality
     * The exclusion from the effect dependencies is intentional and should not be modified
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapperRef, reorderable, resizable, virtualize, interactiveTableUtils]);

  const theme = useTheme();

  const paginationSettings: PaginationProps | false = usePagination
    ? {
        hideOnSinglePage: true,
        pageSize,
        pageSizeOptions,
        onShowSizeChange: (page: number, size: number) => setPageSize(size),
      }
    : false;

  /**
   * When recordCount is provided it lets the user of Table control total number of pages
   * independent from data.length.  This allows the parent component do things like server side paging
   * where the user can be shown the total mount of data they can page through, but the component can provide
   * data one page at a time, and respond to the onPageChange event to fetch and set new data
   */
  if (paginationSettings && recordCount) {
    paginationSettings.total = recordCount;
  }

  let bodyHeight = height;
  if (bodyHeight) {
    bodyHeight -= HEADER_HEIGHT;
    const hasPagination =
      usePagination && recordCount && recordCount > pageSize;
    if (hasPagination) {
      bodyHeight -= PAGINATION_HEIGHT;
    }
  }

  const sharedProps = {
    loading: { spinning: loading ?? false, indicator: <Loading /> },
    hasData: hideData ? false : data,
    columns: derivedColumns,
    dataSource: hideData ? undefined : data,
    size,
    pagination: paginationSettings,
    locale: mergedLocale,
    showSorterTooltip: false,
    onChange,
    onRow,
    theme,
    height: bodyHeight,
    bordered,
    expandable: {
      childrenColumnName,
    },
  };

  return (
    <ConfigProvider renderEmpty={renderEmpty}>
      <div ref={wrapperRef}>
        {!virtualize && (
          <StyledTable
            {...sharedProps}
            rowSelection={selectionTypeValue ? rowSelection : undefined}
            sticky={sticky}
          />
        )}
        {virtualize && (
          <StyledVirtualTable
            {...sharedProps}
            scroll={{
              y: 300,
              x: '100vw',
              // To avoid jest failure by scrollTo
              ...(process.env.WEBPACK_MODE === 'test' && {
                scrollToFirstRowOnChange: false,
              }),
            }}
            allowHTML={allowHTML}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

export default Table;

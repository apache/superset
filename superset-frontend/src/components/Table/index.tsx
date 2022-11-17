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
import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { Table as AntTable, ConfigProvider } from 'antd';
import type {
  ColumnType,
  ColumnGroupType,
  TableProps as AntTableProps,
} from 'antd/es/table';
import { t, useTheme, logging } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import styled, { StyledComponent } from '@emotion/styled';
import InteractiveTableUtils from './utils/InteractiveTableUtils';

export const SUPERSET_TABLE_COLUMN = 'superset/table-column';
export interface TableDataType {
  key: React.Key;
}

export declare type ColumnsType<RecordType = unknown> = (
  | ColumnGroupType<RecordType>
  | ColumnType<RecordType>
)[];

export enum SelectionType {
  'DISABLED' = 'disabled',
  'SINGLE' = 'single',
  'MULTI' = 'multi',
}

export interface Locale {
  /**
   * Text contained within the Table UI.
   */
  filterTitle: string;
  filterConfirm: string;
  filterReset: string;
  filterEmptyText: string;
  filterCheckall: string;
  filterSearchPlaceholder: string;
  emptyText: string;
  selectAll: string;
  selectInvert: string;
  selectNone: string;
  selectionAll: string;
  sortTitle: string;
  expand: string;
  collapse: string;
  triggerDesc: string;
  triggerAsc: string;
  cancelSort: string;
}

export interface TableProps extends AntTableProps<TableProps> {
  /**
   * Data that will populate the each row and map to the column key.
   */
  data: object[];
  /**
   * Table column definitions.
   */
  columns: ColumnsType<any>;
  /**
   * Array of row keys to represent list of selected rows.
   */
  selectedRows?: React.Key[];
  /**
   * Callback function invoked when a row is selected by user.
   */
  handleRowSelection?: Function;
  /**
   * Controls the size of the table.
   */
  size: TableSize;
  /**
   * Adjusts the padding around elements for different amounts of spacing between elements.
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
  locale?: Locale;
  /**
   * Restricts the visible height of the table and allows for internal scrolling within the table
   * when the number of rows exceeds the visible space.
   */
  height?: number;
}

export enum TableSize {
  SMALL = 'small',
  MIDDLE = 'middle',
}

const defaultRowSelection: React.Key[] = [];
// This accounts for the tables header and pagination if user gives table instance a height. this is a temp solution
const HEIGHT_OFFSET = 108;

const StyledTable: StyledComponent<any> = styled(AntTable)<any>`
  ${({ theme, height }) => `
    .ant-table-body {
      overflow: scroll;
      height: ${height ? `${height - HEIGHT_OFFSET}px` : undefined};
    }

    th.ant-table-cell {
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.grayscale.dark1};
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ant-pagination-item-active {
      border-color: ${theme.colors.primary.base};
    }
  `}
`;

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
selectionMap[SelectionType.MULTI] = 'checkbox';
selectionMap[SelectionType.SINGLE] = 'radio';
selectionMap[SelectionType.DISABLED] = null;

export function Table(props: TableProps) {
  const {
    data,
    columns,
    selectedRows = defaultRowSelection,
    handleRowSelection,
    size,
    selectionType = SelectionType.DISABLED,
    sticky = true,
    loading = false,
    resizable = false,
    reorderable = false,
    defaultPageSize = 15,
    pageSizeOptions = ['5', '15', '25', '50', '100'],
    hideData = false,
    emptyComponent,
    locale,
    ...rest
  } = props;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [derivedColumns, setDerivedColumns] = useState(columns);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [mergedLocale, setMergedLocale] = useState({ ...defaultLocale });
  const [selectedRowKeys, setSelectedRowKeys] =
    useState<React.Key[]>(selectedRows);
  const interactiveTableUtils = useRef<InteractiveTableUtils | null>(null);

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
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
  }, [wrapperRef, reorderable, resizable, interactiveTableUtils]);

  const theme = useTheme();

  return (
    <ConfigProvider renderEmpty={renderEmpty}>
      <div ref={wrapperRef}>
        <StyledTable
          {...rest}
          loading={{ spinning: loading ?? false, indicator: <Loading /> }}
          hasData={hideData ? false : data}
          rowSelection={selectionTypeValue ? rowSelection : undefined}
          columns={derivedColumns}
          dataSource={hideData ? [undefined] : data}
          size={size}
          sticky={sticky}
          pagination={{
            hideOnSinglePage: true,
            pageSize,
            pageSizeOptions,
            onShowSizeChange: (page: number, size: number) => setPageSize(size),
          }}
          showSorterTooltip={false}
          locale={mergedLocale}
          theme={theme}
        />
      </div>
    </ConfigProvider>
  );
}

export default Table;

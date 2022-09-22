import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { Table as AntTable, ConfigProvider } from 'antd';
import type { ColumnsType, TableProps as AntTableProps } from 'antd/es/table';
import Loading from 'src/components/Loading';
// import { css } from '@emotion/react';
import { useTheme, styled, t } from '@superset-ui/core';

import InteractiveTableUtils from './InteractiveTableUtils';

export const SUPERSET_TABLE_COLUMN = 'superset/table-column';
export interface TableDataType {
  key: React.Key;
}

export enum SelectionType {
  'DISABLED' = 'disabled',
  'SINGLE' = 'single',
  'MULTI' = 'multi',
}

export interface Column extends ColumnsType {
  title: string | JSX.Element;
  tooltip?: string;
  dataIndex: string;
  key: string;
}

export interface TableProps extends AntTableProps<TableProps> {
  /**
   * Data that will populate the each row and map to the column key
   */
  data: TableDataType[];
  /**
   * Table column definitions
   */
  columns: Column[];
  /**
   * Array of row keys to represent list of selected rows
   */
  selectedRows?: React.Key[];
  /**
   * Callback function invoked when a row is selected by user
   */
  handleRowSelection?: Function;
  /**
   * Controls the size of the table
   */
  size: TableSize;
  /**
   * Adjusts the padding around elements for different amounts of spacing between elements
   */
  selectionType?: SelectionType;
  /*
   * Places table in visual loading state.  Use while waiting to retrieve data or perform an async operation that will update the table
   */
  loading?: boolean;
  /**
   * Uses a sticky header which always displays when vertically scrolling the table.  Default: true
   */
  sticky?: boolean;
  /**
   * Controls if columns are re-sizeable by user
   */
  resizable?: boolean;
  /**
   * EXPERIMENTAL: Controls if columns are re-orderable by user drag drop
   */
  reorderable?: boolean;
  /**
   * Default number of rows table will display per page of data
   */
  defaultPageSize?: number;
  /**
   * Array of numeric options for the number of rows table will display per page of data.
   * The user can select from these options in the page size drop down menu
   */
  pageSizeOptions?: number[];
  /**
   * Set table to display no data even if data has been provided
   */
  hideData?: boolean;
  /**
   * emptyComponent
   */
  emptyComponent?: ReactElement;
  /**
   * Enables setting the text displayed in various components and tooltips within the Table UI
   */
  locale?: object;
}

export interface StyledTableProps extends TableProps {
  theme: object;
}

export enum TableSize {
  SMALL = 'small',
  MIDDLE = 'middle',
}

const defaultRowSelection: React.Key[] = [];

export const StyledTable = styled(AntTable)<StyledTableProps>`
  ${({ theme }) => `
  .ant-table-body {
    overflow: scroll;
  }

  th.ant-table-cell {
    font-weight: 600;
    color: ${theme.colors.grayscale.dark1};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
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
    pageSizeOptions = [5, 15, 25, 50, 100],
    hideData = false,
    emptyComponent,
    locale,
    ...rest
  } = props;

  const theme = useTheme();
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

  const intializeInteractiveTable = () => {
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
        interactiveTableUtils?.current?.initializeResizeableColumns(
          resizable,
          table,
        );
      }
    }
  };

  // Log use of experimental features
  useEffect(() => {
    if (reorderable === true) {
      // eslint-disable-next-line no-console
      console.warn(
        'EXPERIMENTAL FEATURE ENABLED: The "reorderable" prop of Table is experimental and NOT recommended for use in production deployments.',
      );
    }
    if (resizable === true) {
      // eslint-disable-next-line no-console
      console.warn(
        'EXPERIMENTAL FEATURE ENABLED: The "resizeable" prop of Table is experimental and NOT recommended for use in production deployments.',
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
    intializeInteractiveTable();
    return () => {
      interactiveTableUtils?.current?.clearListeners?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapperRef, reorderable, resizable]);

  return (
    <ConfigProvider renderEmpty={renderEmpty}>
      <div ref={wrapperRef}>
        <StyledTable
          {...rest}
          loading={{ spinning: loading, indicator: <Loading /> }}
          hasData={hideData ? false : data}
          theme={theme}
          rowSelection={selectionTypeValue ? rowSelection : undefined}
          columns={derivedColumns}
          dataSource={hideData ? null : data}
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
        />
      </div>
    </ConfigProvider>
  );
}

export default Table;

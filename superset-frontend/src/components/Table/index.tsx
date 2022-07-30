import React, { useState } from 'react';
import { Table as AntTable } from 'antd';
import type { ColumnsType } from 'antd/es/table';
// import { css } from '@emotion/react';
import { useTheme, styled } from '@superset-ui/core';

export interface TableDataType {
  key: React.Key;
}

export enum SelectionType {
  'DISABLED' = 'disabled',
  'SINGLE' = 'single',
  'MULTI' = 'multi',
}

export interface TableProps {
  /**
   * Data that will populate the each row and map to the column key
   */
  data: TableDataType[];
  columns: ColumnsType[];
  selectedRows?: React.Key[];
  handleRowSelection?: Function;
  /**
   * Controls the size of the table
   */
  size: TableSize;
  selectionType?: SelectionType;
  sticky?: boolean;
}

export interface StyledTableProps extends TableProps {
  /**
   * Data that will populate the each row and map to the column key
   */
  height?: number;
  theme: object;
}

export enum TableSize {
  SMALL = 'small',
  MIDDLE = 'middle',
}

// This accounts for the tables header and pagnication, this is a temp solution
const HEIGHT_OFFSET = 108;

const defaultRowSelection: React.Key[] = [];
/*
  thead > tr > th {
    border-bottom: 1px solid ${theme?.colors?.error};
    color: ${theme?.colors?.error?.base};
  }

  tbody > tr > td  {
    color: #3366ff;
  }
*/
export const StyledTable = styled(AntTable)<StyledTableProps>`
  ${({ theme, height }) => `
  .ant-table-body {
    overflow: scroll;
    height: ${height ? `${height - HEIGHT_OFFSET}px` : undefined};
  }
  th.ant-table-cell {
    font-weight: 600;
    color: ${theme.colors.grayscale.dark1};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th > .anticon {
    color: red;
  }

  .ant-pagination-item-active {

    border-color: #20a7c9;
}
  `}
`;

export function Table(props: TableProps) {
  const {
    data,
    columns,
    selectedRows = defaultRowSelection,
    handleRowSelection,
    size,
    selectionType = SelectionType.DISABLED,
    sticky = true,
    ...rest
  } = props;

  const theme = useTheme();
  const [selectedRowKeys, setSelectedRowKeys] =
    useState<React.Key[]>(selectedRows);

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    console.log('selectedRowKeys changed: ', newSelectedRowKeys);
    setSelectedRowKeys(newSelectedRowKeys);
    handleRowSelection?.(newSelectedRowKeys);
  };

  const selectionMap = {};
  selectionMap[SelectionType.MULTI] = 'checkbox';
  selectionMap[SelectionType.SINGLE] = 'radio';
  selectionMap[SelectionType.DISABLED] = null;

  const selectionTypeValue = selectionMap[selectionType];
  const rowSelection = {
    type: selectionTypeValue,
    selectedRowKeys,
    onChange: onSelectChange,
  };

  return (
    <StyledTable
      {...rest}
      theme={theme}
      rowSelection={selectionTypeValue ? rowSelection : undefined}
      columns={columns}
      dataSource={data}
      size={size}
      sticky={sticky}
      pagination={{
        hideOnSinglePage: true,
      }}
    />
  );
}

export default Table;

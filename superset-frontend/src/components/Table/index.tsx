import React, { useState, useEffect, useRef } from 'react';
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
  /**
   * Controls if columns are resizeable by user
   */
  resizeable?: boolean;
  /**
   * Controls if columns are reorderable by user
   */
  reorderable?: boolean;
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
    user-select: none;
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
    resizeable = true,
    ...rest
  } = props;

  const theme = useTheme();
  const wrapperRef: HTMLDivElement = useRef<HTMLDivElement>(null);
  const tableRef: HTMLTableElement = useRef<HTMLTableElement>(null);
  const columnRef: HTMLTableRowElement = useRef<HTMLTableRowElement>(null);
  const [derivedColumns, setDerivedColumns] = useState(columns);

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

  const getColumnIndex = () => {
    const parent = columnRef.current.parentNode;
    const index = Array.prototype.indexOf.call(
      parent.children,
      columnRef.current,
    );
    return index;
  };

  const handleColumnDragStart = (e: DragEvent) => {
    console.log('handleColumnDragStart');
    const index = getColumnIndex();
    const columnnData = derivedColumns[index];
    // const dragData = { index, columnnData };
    e.dataTransfer.setData('text', e.target.id);
    // e?.dataTransfer?.setData('string/json', JSON.stringify(dragData));
    console.log('drag start');
  };

  const handleDragDrop = (ev: DragEvent) => {
    ev.preventDefault();
    console.log('handle drop');
    const data = ev.dataTransfer.getData('text', ev.target.id);
    alert(data);
  };

  const allowDrop = ev => {
    console.log('allow drop');
    ev.preventDefault();
  };

  const handleMousedown = event => {
    const target = event.currentTarget;
    if (target) {
      columnRef.current = target;
      if (event && event.offsetX > target.offsetWidth - 16) {
        target.mouseDown = true;
        target.oldX = event.x;
        target.oldWidth = target?.offsetWidth;
      } else {
        target.draggable = true;
      }
    }
  };

  const handleMousemove = event => {
    if (resizeable === true) {
      const target = event.currentTarget;

      if (event.offsetX > target.offsetWidth - 16) {
        target.style.cursor = 'col-resize';
      } else {
        target.style.cursor = 'default';
      }

      const column = columnRef.current;
      if (column && column.mouseDown) {
        let width = column.oldWidth;
        const diff = event.x - column.oldX;
        if (column.oldWidth + (event.x - column.oldX) > 0) {
          width = column.oldWidth + diff;
        }
        const colIndex = getColumnIndex();

        const columnDef = { ...derivedColumns[colIndex] };
        console.log(columnDef.width);
        columnDef.width = width;
        console.log(columnDef.width);
        derivedColumns[colIndex] = columnDef;
        setDerivedColumns([...derivedColumns]);
      }
    }
  };

  const handleMouseup = event => {
    if (columnRef.current) {
      columnRef.current.mouseDown = false;
      columnRef.current.style.cursor = 'default';
      columnRef.current.draggable = false;
    }
  };

  const initializeResizeable = () => {
    const header = tableRef.current.rows[0];
    const { cells } = header;
    const len = cells.length;

    for (let i = 0; i < len; i += 1) {
      const cell = cells[i];
      cell.addEventListener('mousedown', handleMousedown);
      cell.addEventListener('mousemove', handleMousemove, true);
      cell.addEventListener('dragstart', handleColumnDragStart);
      cell.addEventListener('ondrop', handleDragDrop);
      cell.addEventListener('ondragover', allowDrop);
      cell.id = `column_${i}`;
    }
    tableRef.current.addEventListener('mouseup', handleMouseup);
  };

  useEffect(() => {
    if (
      resizeable === true &&
      wrapperRef &&
      wrapperRef.current &&
      !tableRef?.current
    ) {
      tableRef.current = wrapperRef.current.getElementsByTagName('table')[0];
      tableRef.current.setAttribute('data-table-resizable', 'true');
      const id = 'rs_tb';
      tableRef.current.id = id;
      initializeResizeable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return (
    <div ref={wrapperRef}>
      <StyledTable
        id=""
        {...rest}
        theme={theme}
        rowSelection={selectionTypeValue ? rowSelection : undefined}
        columns={derivedColumns}
        dataSource={data}
        size={size}
        sticky={sticky}
        pagination={{
          hideOnSinglePage: true,
        }}
      />
    </div>
  );
}

export default Table;

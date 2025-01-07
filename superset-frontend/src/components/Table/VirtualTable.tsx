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

import AntTable, {
  TablePaginationConfig,
  TableProps as AntTableProps,
} from 'antd/lib/table';
import classNames from 'classnames';
import { useResizeDetector } from 'react-resize-detector';
import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import { useTheme, styled, safeHtmlSpan } from '@superset-ui/core';

import { TableSize, ETableAction } from './index';

interface VirtualTableProps<RecordType> extends AntTableProps<RecordType> {
  height?: number;
  allowHTML?: boolean;
}

const StyledCell = styled('div')<{ height?: number }>(
  ({ theme, height }) => `
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: ${theme.gridUnit * 2}px;
  padding-right: ${theme.gridUnit}px;
  border-bottom: 1px solid ${theme.colors.grayscale.light3};
  transition: background 0.3s;
  line-height: ${height}px;
  box-sizing: border-box;
`,
);

const StyledTable = styled(AntTable)<{ height?: number }>(
  ({ theme }) => `
    th.ant-table-cell {
      font-weight: ${theme.typography.weights.bold};
      color: ${theme.colors.grayscale.dark1};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ant-pagination-item-active {
      border-color: ${theme.colors.primary.base};
      }
    }
    .ant-table.ant-table-small {
      font-size: ${theme.typography.sizes.s}px;
    }
`,
);

const SMALL = 39;
const MIDDLE = 47;

const VirtualTable = <RecordType extends object>(
  props: VirtualTableProps<RecordType>,
) => {
  const {
    columns,
    pagination,
    onChange,
    height,
    scroll,
    size,
    allowHTML = false,
  } = props;
  const [tableWidth, setTableWidth] = useState<number>(0);
  const onResize = useCallback((width: number) => {
    setTableWidth(width);
  }, []);
  const { ref } = useResizeDetector({ onResize });
  const theme = useTheme();

  // If a column definition has no width, react-window will use this as the default column width
  const DEFAULT_COL_WIDTH = theme?.gridUnit * 37 || 150;
  const widthColumnCount = columns!.filter(({ width }) => !width).length;
  let staticColWidthTotal = 0;
  columns?.forEach(column => {
    if (column.width) {
      staticColWidthTotal += column.width as number;
    }
  });

  let totalWidth = 0;
  const defaultWidth = Math.max(
    Math.floor((tableWidth - staticColWidthTotal) / widthColumnCount),
    50,
  );

  const mergedColumns =
    columns?.map?.(column => {
      const modifiedColumn = { ...column };
      if (!column.width) {
        modifiedColumn.width = defaultWidth;
      }
      totalWidth += modifiedColumn.width as number;
      return modifiedColumn;
    }) ?? [];

  /*
   * There are cases where a user could set the width of each column and the total width is less than width of
   * the table.  In this case we will stretch the last column to use the extra space
   */
  if (totalWidth < tableWidth) {
    const lastColumn = mergedColumns[mergedColumns.length - 1];
    lastColumn.width =
      (lastColumn.width as number) + Math.floor(tableWidth - totalWidth);
  }

  const gridRef = useRef<any>();
  const [connectObject] = useState<any>(() => {
    const obj = {};
    Object.defineProperty(obj, 'scrollLeft', {
      get: () => {
        if (gridRef.current) {
          return gridRef.current?.state?.scrollLeft;
        }
        return null;
      },
      set: (scrollLeft: number) => {
        if (gridRef.current) {
          gridRef.current.scrollTo({ scrollLeft });
        }
      },
    });

    return obj;
  });

  const resetVirtualGrid = () => {
    gridRef.current?.resetAfterIndices({
      columnIndex: 0,
      shouldForceUpdate: true,
    });
  };

  useEffect(() => resetVirtualGrid, [tableWidth, columns, size]);

  /*
   * antd Table has a runtime error when it tries to fire the onChange event triggered from a pageChange
   * when the table body is overridden with the virtualized table.  This function capture the page change event
   * from within the pagination controls and proxies the onChange event payload
   */
  const onPageChange = (page: number, size: number) => {
    /**
     * This resets vertical scroll position to 0 (top) when page changes
     * We intentionally leave horizontal scroll where it was so user can focus on
     * specific range of columns as they page through data
     */
    gridRef.current?.scrollTo?.({ scrollTop: 0 });

    onChange?.(
      {
        ...pagination,
        current: page,
        pageSize: size,
      } as TablePaginationConfig,
      {},
      {},
      {
        action: ETableAction.Paginate,
        currentDataSource: [],
      },
    );
  };

  const renderVirtualList = (rawData: object[], { ref, onScroll }: any) => {
    // eslint-disable-next-line no-param-reassign
    ref.current = connectObject;
    const cellSize = size === TableSize.Middle ? MIDDLE : SMALL;
    return (
      <Grid
        ref={gridRef}
        className="virtual-grid"
        columnCount={mergedColumns.length}
        columnWidth={(index: number) => {
          const { width = DEFAULT_COL_WIDTH } = mergedColumns[index];
          return width as number;
        }}
        height={height || (scroll!.y as number)}
        rowCount={rawData.length}
        rowHeight={() => cellSize}
        width={tableWidth}
        onScroll={({ scrollLeft }: { scrollLeft: number }) => {
          onScroll({ scrollLeft });
        }}
      >
        {({
          columnIndex,
          rowIndex,
          style,
        }: {
          columnIndex: number;
          rowIndex: number;
          style: CSSProperties;
        }) => {
          const data: any = rawData?.[rowIndex];
          // Set default content
          let content =
            data?.[(mergedColumns as any)?.[columnIndex]?.dataIndex];
          // Check if the column has a render function
          const render = mergedColumns[columnIndex]?.render;
          if (typeof render === 'function') {
            // Use render function to generate formatted content using column's render function
            content = render(content, data, rowIndex);
          }

          if (allowHTML && typeof content === 'string') {
            content = safeHtmlSpan(content);
          }

          return (
            <StyledCell
              className={classNames('virtual-table-cell', {
                'virtual-table-cell-last':
                  columnIndex === mergedColumns.length - 1,
              })}
              style={style}
              title={typeof content === 'string' ? content : undefined}
              theme={theme}
              height={cellSize}
            >
              {content}
            </StyledCell>
          );
        }}
      </Grid>
    );
  };

  const modifiedPagination = {
    ...pagination,
    onChange: onPageChange,
  };

  return (
    <div ref={ref}>
      <StyledTable
        {...props}
        sticky={false}
        className="virtual-table"
        columns={mergedColumns}
        components={{
          body: renderVirtualList,
        }}
        pagination={pagination ? modifiedPagination : false}
      />
    </div>
  );
};

export default VirtualTable;

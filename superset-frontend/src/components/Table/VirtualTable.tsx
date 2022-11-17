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
import { Table } from 'antd';
import type { TableProps } from 'antd/es/table';
import classNames from 'classnames';
import { useResizeDetector } from 'react-resize-detector';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import { useTheme, styled } from '@superset-ui/core';

const StyledCell = styled('div')(
  ({ theme }) => `
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: ${theme.gridUnit * 2}px;
  padding-right: ${theme.gridUnit}px;
`,
);

const VirtualTable = <RecordType extends object>(
  props: TableProps<RecordType>,
) => {
  const { columns, scroll, pagination } = props;
  const [tableWidth, setTableWidth] = useState<number>(0);
  const onResize = useCallback((width: number) => {
    setTableWidth(width);
  }, []);
  const theme = useTheme();

  // If a column definition has no width, react-window will use this as the default column width
  const DEFAULT_COL_WIDTH = theme?.gridUnit * 37 || 150;

  const { ref } = useResizeDetector({ onResize });
  const mergedColumns =
    columns?.map?.(column => {
      if (column.width) {
        return { ...column };
      }

      return {
        ...column,
        width: DEFAULT_COL_WIDTH,
      };
    }) ?? [];

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

  useEffect(() => resetVirtualGrid, [tableWidth, columns]);

  const renderVirtualList = (rawData: object[], { ref, onScroll }: any) => {
    // eslint-disable-next-line no-param-reassign
    ref.current = connectObject;
    return (
      <Grid
        ref={gridRef}
        className="virtual-grid"
        columnCount={mergedColumns.length}
        columnWidth={(index: number) => {
          const { width = DEFAULT_COL_WIDTH } = mergedColumns[index];
          return width as number;
        }}
        height={scroll!.y as number}
        rowCount={rawData.length}
        rowHeight={() => 54}
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
          style: React.CSSProperties;
        }) => {
          const content = (rawData[rowIndex] as any)[
            (mergedColumns as any)[columnIndex].dataIndex
          ];
          return (
            <StyledCell
              className={classNames('virtual-table-cell', {
                'virtual-table-cell-last':
                  columnIndex === mergedColumns.length - 1,
              })}
              style={style}
              title={content}
              theme={theme}
            >
              {content}
            </StyledCell>
          );
        }}
      </Grid>
    );
  };

  return (
    <div ref={ref}>
      <Table
        {...props}
        sticky={false}
        className="virtual-table"
        columns={mergedColumns}
        components={{
          body: renderVirtualList,
        }}
        pagination={pagination}
      />
    </div>
  );
};

export default VirtualTable;

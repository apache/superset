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
import ResizeObserver from 'rc-resize-observer';
import React, { useEffect, useRef, useState } from 'react';
import { VariableSizeGrid as Grid } from 'react-window';
import styled from '@emotion/styled';

// If a column definition has no width, react-window will use this as the default column width
const DEFAULT_COL_WIDTH = 150;

const StyledCell = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 8px;
  padding-right: 4px;
`;

const VirtualTable = <RecordType extends object>(
  props: TableProps<RecordType>,
) => {
  const { columns, scroll, pagination } = props;
  const [tableWidth, setTableWidth] = useState(0);

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
            >
              {content}
            </StyledCell>
          );
        }}
      </Grid>
    );
  };

  return (
    <ResizeObserver
      onResize={({ width }) => {
        setTableWidth(width);
      }}
    >
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
    </ResizeObserver>
  );
};

export default VirtualTable;

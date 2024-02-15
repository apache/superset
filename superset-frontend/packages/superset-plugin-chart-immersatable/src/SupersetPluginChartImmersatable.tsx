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
import React, { useEffect, createRef, useMemo, useState } from 'react';
import { styled } from '@superset-ui/core';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ChartData, DataType, SupersetPluginChartImmersatableProps, SupersetPluginChartImmersatableStylesProps } from './types';
import { TimeSeriesCell } from './TimeSeries';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts


const Styles = styled.div<SupersetPluginChartImmersatableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;
  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  pre {
    height: ${({ theme, headerFontSize, height }) =>
      height - theme.gridUnit * 12 - theme.typography.sizes[headerFontSize]}px;
  }
`;

const ContainerStyle = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 1rem;
  margin: 10px;
  width: fit-content;
  overflow: hidden;
`;

const HeaderText = styled.div`
  padding: 17px 24px;
  border: 1px solid #d1d5db;
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
  background: #f3f4f6;
  font-size: 1.4rem;
  font-weight: bold !important;
  color: rgb(107, 114, 128);
`;

const TableHeaderGroup = styled.div`
  display: flex;
  background: #f9fafb;
`;

const TableHeader = styled.div`
  width: 220px;
  display: flex;
  position: relative;
  border: 1px solid #d1d5db;
  text-transform: capitalize;
`;

const TableColumn = styled.div`
  font-size: 0.875rem;
  line-height: 1.25rem;
  padding: 0.875rem 1rem;
  text-align: left;
  display: flex;
`;

const TableColumnText = styled.div`
  overflow-wrap: break-word;
  width: 180px;
  font-weight: bold;
`;

const TableRow = styled.div`
 display: flex;
`;

const TableCell = styled.div`
  width: 220px;
  display: flex;
  position: relative;
  border: 1px solid #d1d5db;
  font-size: 0.875rem;
  line-height: 1.25rem;
  max-height: 3rem;
  padding: 0.875rem 1rem;
  text-align: left;
`;


/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function SupersetPluginChartImmersatable(props: SupersetPluginChartImmersatableProps) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const { data, height, width } = props;
  const [sorting, setSorting] = useState<SortingState>([]);

  const rootElem = createRef<HTMLDivElement>();

  // Often, you just want to access the DOM and do whatever you want.
  // Here, you can do that with createRef, and the useEffect hook.
  useEffect(() => {
    const root = rootElem.current as HTMLElement;
    console.log('Plugin element', root);
  });

  console.log('Plugin props', props);

  const DEFAULT_COLUMN_MIN_WIDTH = 160;

  const columnNames = Object.keys(data[0])
  
  console.log("columnNames",columnNames)

  const columnsMetadata = useMemo(()=>{
    return   columnNames.map((metadata)=>{
      return { width: DEFAULT_COLUMN_MIN_WIDTH,
        name:metadata,
        label:metadata,
        minWidth: null,
        maxWidth: null,
        sortable: true,
        sortDescFirst: true,
      }
    })
  },columnNames)

  const columns = useMemo<ColumnDef<DataType>[]>(() => {
    return columnsMetadata.map((columnMetadata) => {
        return {
          id: columnMetadata.name,
          header: columnMetadata.label,
          accessorKey: columnMetadata.name,
          minSize: columnMetadata.minWidth || DEFAULT_COLUMN_MIN_WIDTH,
          maxSize: columnMetadata.maxWidth || undefined,
          size: columnMetadata.width,
          enableSorting: columnMetadata.sortable,
          sortDescFirst: true,
          cell: (info: any) => {
            const value = info.getValue();
            console.log("Value?: ", typeof(value));
            if (value && value.toString().includes("[") && Array.isArray(JSON.parse(value as string))) {
                const chartData = JSON.parse(value).map((row: any) => {
                return {
                  xAxis: row[0], 
                  yAxis: row[1]
                }
              })
              return <TimeSeriesCell value="" chartData={chartData as ChartData} />;
            }
            else {
              return value;
            }
          }
        };
      }) as ColumnDef<DataType>[]
  }, [columnsMetadata]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder: columnsMetadata.map((column) => column.name) || [],
      sorting,
    },
    onSortingChange: setSorting, 
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Styles
      ref={rootElem}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <ContainerStyle>
      <HeaderText>{props.headerText}</HeaderText>

      {table.getHeaderGroups().map((headerGroup) => (
        <TableHeaderGroup
          key={headerGroup.id}
        >
          {headerGroup.headers.map((header) => {
           const { column } = header;
              const columnSorting = column.getIsSorted();
              const canSort = column.getCanSort();
            return (
            <TableHeader
              key={header.id}
            >
                <TableColumn>
                  <TableColumnText
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableColumnText>
                    {canSort && (
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (!["Enter", " "].includes(e.key)) return;
                            column.getToggleSortingHandler()?.(e);
                          }}
                          onClick={column.getToggleSortingHandler()}
                          title="Sorting"
                        >
                          <div
                            style={{
                              display: "flex",
                              position: "relative",
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              style={{
                                height: "1.35rem",
                                width: "1.35rem",
                                color:
                                  columnSorting === "asc" ? "orange" : "gray",
                              }}
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 15a.75.75 0 01-.75-.75V7.612L7.29 9.77a.75.75 0 01-1.08-1.04l3.25-3.5a.75.75 0 011.08 0l3.25 3.5a.75.75 0 11-1.08 1.04l-1.96-2.158v6.638A.75.75 0 0110 15z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              style={{
                                height: "1.35rem",
                                width: "1.35rem",
                                color:
                                  columnSorting === "desc" ? "orange" : "gray",
                                marginLeft: "0.4rem",
                                marginTop: "0.25rem",
                                position: "absolute",
                              }}
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 5a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V5.75A.75.75 0 0110 5z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                  
                </TableColumn>
            </TableHeader>
            )
})}
        </TableHeaderGroup>
      ))}
      {table.getRowModel().rows.map((row) => (
        <TableRow
          key={row.id}  
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell
              key={cell.id}
            >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
     
    </ContainerStyle>
    </Styles>
  );
}



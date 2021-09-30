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
import React from 'react';

import cx from 'classnames';
import { TableInstance } from 'react-table';
import { styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

interface TableCollectionProps {
  getTableProps: (userProps?: any) => any;
  getTableBodyProps: (userProps?: any) => any;
  prepareRow: TableInstance['prepareRow'];
  headerGroups: TableInstance['headerGroups'];
  rows: TableInstance['rows'];
  columns: TableInstance['column'][];
  loading: boolean;
  highlightRowId?: number;
}

export const Table = styled.table`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-collapse: separate;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({theme})=> theme.gridUnit * 1}px;

    overflow:auto;
    display:block;
    
  {/*thead > tr > th {
    border: 0;
  }*/}

  
`;

Table.displayName = 'table';

const TableDisplay =({
    getTableProps,
    getTableBodyProps,
    prepareRow,
    headerGroups,
    columns,
    rows,
    loading,
    highlightRowId,
  }: TableCollectionProps) => (
    <Table
      {...getTableProps()}
      className="table table-hover"
      data-test="listview-table"
    >
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => {
              let sortIcon = <Icons.Sort />;
              if (column.isSorted && column.isSortedDesc) {
                sortIcon = <Icons.SortDesc />;
              } else if (column.isSorted && !column.isSortedDesc) {
                sortIcon = <Icons.SortAsc />;
              }
              return column.hidden ? null : (
                <th
                  {...column.getHeaderProps(
                    column.canSort ? column.getSortByToggleProps() : {},
                  )}
                  data-test="sort-header"
                  className={cx({
                    [column.size || '']: column.size,
                  })}
                >
                  <span>
                    {column.render('Header')}
                    {column.canSort && sortIcon}
                  </span>
                    <div
                        {...column.getResizerProps()}
                        className={`resizer ${
                            column.isResizing ? 'isResizing' : ''
                        }`}
                    />
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {loading &&
          rows.length === 0 &&
          [...new Array(25)].map((_, i) => (
            <tr key={i}>
              {columns.map((column, i2) => {
                if (column.hidden) return null;
                  
                return (
                  <td
                    key={i2}
                    className={cx('table-cell', {
                      'table-cell-loader': loading,
                      [column.size || '']: column.size,
                    })}
                  >
                      {column.accessor('id')}
                    <span className="loading-bar" role="progressbar">
                      <span>LOADING</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        {rows.length > 0 &&
          rows.map(row => {
            prepareRow(row);
            // @ts-ignore
            const rowId = row.original.id;
            return (
              <tr
                data-test="table-row"
                {...row.getRowProps()}
                className={cx('table-row', {
                  'table-row-selected':
                    row.isSelected ||
                    (typeof rowId !== 'undefined' && rowId === highlightRowId),
                })}
              >
                {row.cells.map(cell => {
                  if (cell.column.hidden) return null;

                  const columnCellProps = cell.column.cellProps || {};
                  return (
                    <td
                      data-test="table-row-cell"
                      className={cx('table-cell', {
                        'table-cell-loader': loading,
                        [cell.column.size || '']: cell.column.size,
                      })}
                      {...cell.getCellProps()}
                      {...columnCellProps}
                    >
                      <span
                        className={cx({ 'loading-bar': loading })}
                        role={loading ? 'progressbar' : undefined}
                      >
                        <span data-test="cell-text">{cell.render('Cell')}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
      </tbody>
    </Table>
  )
export default React.memo(TableDisplay)

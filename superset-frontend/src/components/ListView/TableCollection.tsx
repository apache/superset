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
import styled from '@superset-ui/style';
import Icon from 'src/components/Icon';

interface Props {
  getTableProps: (userProps?: any) => any;
  getTableBodyProps: (userProps?: any) => any;
  prepareRow: TableInstance['prepareRow'];
  headerGroups: TableInstance['headerGroups'];
  rows: TableInstance['rows'];
  loading: boolean;
}

const Table = styled.table`
  th {
    &.xs {
      min-width: 25px;
    }
    &.sm {
      min-width: 50px;
    }
    &.md {
      min-width: 75px;
    }
    &.lg {
      min-width: 100px;
    }
    &.xl {
      min-width: 150px;
    }
    &.xxl {
      min-width: 200px;
    }

    svg {
      display: inline-block;
      top: 6px;
      position: relative;
    }
  }
  td {
    &.xs {
      width: 25px;
    }
    &.sm {
      width: 50px;
    }
    &.md {
      width: 75px;
    }
    &.lg {
      width: 100px;
    }
    &.xl {
      width: 150px;
    }
    &.xxl {
      width: 200px;
    }
  }
`;

export default function TableCollection({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  rows,
  loading,
}: Props) {
  return (
    <Table {...getTableProps()} className="table table-hover">
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => {
              let sortIcon = <Icon name="sort" />;
              if (column.isSorted && column.isSortedDesc) {
                sortIcon = <Icon name="sort-desc" />;
              } else if (column.isSorted && !column.isSortedDesc) {
                sortIcon = <Icon name="sort-asc" />;
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
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row);
          return (
            <tr
              {...row.getRowProps()}
              className={cx({
                'table-row-selected': row.isSelected,
              })}
              onMouseEnter={() => row.setState && row.setState({ hover: true })}
              onMouseLeave={() =>
                row.setState && row.setState({ hover: false })
              }
            >
              {row.cells.map(cell => {
                if (cell.column.hidden) return null;

                const columnCellProps = cell.column.cellProps || {};
                return (
                  <td
                    className={cx('table-cell', {
                      'table-cell-loader': loading,
                      [cell.column.size || '']: cell.column.size,
                    })}
                    {...cell.getCellProps()}
                    {...columnCellProps}
                  >
                    <span className={cx({ 'loading-bar': loading })}>
                      <span>{cell.render('Cell')}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

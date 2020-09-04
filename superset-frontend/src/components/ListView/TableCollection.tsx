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
import Icon from 'src/components/Icon';

interface TableCollectionProps {
  getTableProps: (userProps?: any) => any;
  getTableBodyProps: (userProps?: any) => any;
  prepareRow: TableInstance['prepareRow'];
  headerGroups: TableInstance['headerGroups'];
  rows: TableInstance['rows'];
  columns: TableInstance['column'][];
  loading: boolean;
}

const Table = styled.table`
  border-collapse: separate;

  th {
    background: ${({ theme }) => theme.colors.grayscale.light5};
    position: sticky;
    top: 0;

    &:first-of-type {
      padding-left: ${({ theme }) => theme.gridUnit * 4}px;
    }

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

  .table-cell-loader {
    position: relative;

    .loading-bar {
      background-color: ${({ theme }) => theme.colors.secondary.light4};
      border-radius: 7px;

      span {
        visibility: hidden;
      }
    }

    &:after {
      position: absolute;
      transform: translateY(-50%);
      top: 50%;
      left: 0;
      content: '';
      display: block;
      width: 100%;
      height: 48px;
      background-image: linear-gradient(
        100deg,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 0.5) 60%,
        rgba(255, 255, 255, 0) 80%
      );
      background-size: 200px 48px;
      background-position: -100px 0;
      background-repeat: no-repeat;
      animation: loading-shimmer 1s infinite;
    }
  }

  .actions {
    white-space: nowrap;
    min-width: 100px;

    svg,
    i {
      margin-right: 8px;

      &:hover {
        path {
          fill: ${({ theme }) => theme.colors.primary.base};
        }
      }
    }
  }

  .table-row {
    .actions {
      opacity: 0;
    }

    &:hover {
      background-color: ${({ theme }) => theme.colors.secondary.light5};

      .actions {
        opacity: 1;
        transition: opacity ease-in ${({ theme }) => theme.transitionTiming}s;
      }
    }
  }

  .table-row-selected {
    background-color: ${({ theme }) => theme.colors.secondary.light4};

    &:hover {
      background-color: ${({ theme }) => theme.colors.secondary.light4};
    }
  }

  .table-cell {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 300px;
    line-height: 1;
    vertical-align: middle;
    &:first-of-type {
      padding-left: ${({ theme }) => theme.gridUnit * 4}px;
    }
  }

  .sort-icon {
    position: absolute;
  }

  @keyframes loading-shimmer {
    40% {
      background-position: 100% 0;
    }

    100% {
      background-position: 100% 0;
    }
  }
`;

export default function TableCollection({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  columns,
  rows,
  loading,
}: TableCollectionProps) {
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
                    <span className="loading-bar">
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
            return (
              <tr
                {...row.getRowProps()}
                className={cx('table-row', {
                  'table-row-selected': row.isSelected,
                })}
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

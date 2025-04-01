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
import { memo } from 'react';
import cx from 'classnames';
import { TableInstance } from 'react-table';
import { Table, TableSize, ColumnsType } from 'src/components/Table';
import { Icons } from 'src/components/Icons';

interface TableCollectionProps {
  getTableProps: (userProps?: any) => any;
  getTableBodyProps: (userProps?: any) => any;
  prepareRow: TableInstance['prepareRow'];
  headerGroups: TableInstance['headerGroups'];
  rows: TableInstance['rows'];
  columns: TableInstance['column'][];
  loading: boolean;
  highlightRowId?: number;
  columnsForWrapText?: string[];
}

const mapColumns = (columns: TableInstance['columns']): ColumnsType => {
  console.log({ columns });
  return columns.map((column: any) => ({
    title: column.Header,
    dataIndex: column.accessor,
    key: column.accessor,
    hidden: column.hidden,
    render: (val, record, index) => {
      if (column.Cell) {
        return column.Cell({ row: { original: record, id: index } });
      }
      return val;
    },
  }));
};

const mapRows = (rows: TableInstance['rows']): any[] => {
  console.log({ rows });
  return rows.map(row => ({
    ...row.values,
  }));
};

export default memo(
  ({
    getTableProps,
    getTableBodyProps,
    prepareRow,
    headerGroups,
    columns,
    rows,
    loading,
    highlightRowId,
    columnsForWrapText,
  }: TableCollectionProps) => {
    console.log({
      mappedColumns: mapColumns(columns),
    });

    return (
      <Table
        columns={mapColumns(columns)}
        data={mapRows(rows)}
        size={TableSize.Large}
      />
    );
    return (
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
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {loading &&
            rows.length === 0 &&
            [...new Array(12)].map((_, i) => (
              <tr key={i}>
                {columns.map((column, i2) => {
                  if (column.hidden) return null;
                  return (
                    <td
                      key={i2}
                      className={cx('table-cell', {
                        'table-cell-loader': loading,
                      })}
                    >
                      <span
                        className="loading-bar empty-loading-bar"
                        role="progressbar"
                        aria-label="loading"
                      />
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
                      (typeof rowId !== 'undefined' &&
                        rowId === highlightRowId),
                  })}
                >
                  {row.cells.map(cell => {
                    if (cell.column.hidden) return null;
                    const columnCellProps = cell.column.cellProps || {};
                    const isWrapText = columnsForWrapText?.includes(
                      cell.column.Header as string,
                    );
                    return (
                      <td
                        data-test="table-row-cell"
                        className={cx(
                          `table-cell table-cell__${
                            isWrapText ? 'wrap' : 'nowrap'
                          }`,
                          {
                            'table-cell-loader': loading,
                            [cell.column.size || '']: cell.column.size,
                          },
                        )}
                        {...cell.getCellProps()}
                        {...columnCellProps}
                      >
                        <span
                          className={cx({ 'loading-bar': loading })}
                          role={loading ? 'progressbar' : undefined}
                        >
                          <span data-test="cell-text">
                            {cell.render('Cell')}
                          </span>
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
  },
);

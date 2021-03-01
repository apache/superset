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
import { TableInstance, Row } from 'react-table';
import { TableCollectionCell } from './TableCollectionCell';

interface TableCollectionBodyContentProps {
  prepareRow: TableInstance<any>['prepareRow'];
  rows: Row<{ id: string | number }>[];
  loading: boolean;
  highlightRowId?: number;
}

export const TableCollectionBodyContent: React.FC<TableCollectionBodyContentProps> = ({
  prepareRow,
  rows,
  loading,
  highlightRowId,
}) => {
  if (rows.length <= 0) return null;
  return (
    <>
      {rows.map(row => {
        prepareRow(row);
        const rowId: string | number = row.original.id;
        const trProps = { ...row.getRowProps() };
        const key = rowId || trProps.key;
        return (
          <tr
            data-test="table-row"
            {...trProps}
            key={key}
            className={cx('table-row', {
              'table-row-selected':
                row.isSelected ||
                (typeof rowId !== 'undefined' && rowId === highlightRowId),
            })}
          >
            {row.cells.map(cell => {
              if (cell.column.hidden) return null;
              const cellProps = cell.getCellProps();
              const columnCellProps = cell.column.cellProps || {};
              const tdProps = {
                ...cellProps,
                ...columnCellProps,
                'data-test': 'table-row-cell',
              };
              return (
                <TableCollectionCell
                  loading={loading}
                  column={cell.column}
                  {...tdProps}
                  key={cellProps.key}
                >
                  <span className={cx({ 'loading-bar': loading })}>
                    <span data-test="cell-text">{cell.render('Cell')}</span>
                  </span>
                </TableCollectionCell>
              );
            })}
          </tr>
        );
      })}
    </>
  );
};

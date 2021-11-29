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
import { boolean } from '@storybook/addon-knobs';

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

export const TableDiv = styled.div<{
  scrollTable?: boolean;
  small?: boolean;
}>`
border: 2px solid red;
    ${'' /* These styles are suggested for the table fill all available space in its containing element */}
      display: block;
        ${'' /* These styles are required for a horizontaly scrollable table overflow */}
          overflow: auto;
table{
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-collapse: separate;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.gridUnit * 1}px;
  {/*overflow: auto;*/}
  border-spacing: 0;
  border: ${({ theme }) => theme.colors.grayscale.light1};

    .thread {
        overflow-y: auto;
        overflow-x: hidden;
    }
    .tbody {
        overflow-y: scroll;
        overflow-x: hidden;
        height: 250px;
    }
    .th[role='columnheader'] {
        z-index: 1;
        border-bottom: ${({ theme }) =>
          `${theme.gridUnit - 2}px solid ${theme.colors.grayscale.light2}`};
        ${({ small }) => small && `padding-bottom: 0;`}
        border-right: 1px solid black;
        text-overflow: elipsis; 
        overflow: hidden;
        cursor: pointer;
      }
   .tr[role='row'] {
   min-width: 100%;
   :last-child{
   min-width: 100%
   background: red
   }
   } 

      .tr.table-row:nth-child(odd) {
    background-color: ${({ theme }) => `${theme.colors.grayscale.light2}`};
    
  }

    .th,
    .td {
    margin; 0;
    padding: ${({ theme }) => theme.gridUnit * 1}px;
    border-right: 1px solid orange
    position: relative;

    last-child {
    border-right: 0
    
    }
    .resizer {
      display: inline-block;
      width: 10px;
      height: 100%;
      position: absolute;
      right: 0;
      top: 0;
      transform: translateX(50%);
      z-index: 1;
      ${'' /* prevents from scrolling while dragging on touch devices */}
      touch-action:none;


      &.isResizing {
        background: red;
      }
    }
  }
  .tr.resizer:last-of-type{
      display: none
      }
  .tr,
  .td {
    margin: 0;
    border-bottom: 1px solid green;
    border-right: 1px solid blue;
   :last-of-type{
   border-right: none;
   border-bottom: none;
   } 
    
  }

  }
`;

TableDiv.displayName = 'table';
const headerProps = (props, { column }) => getStyles(props, column.align);
const cellProps = (props, { cell }) => getStyles(props, cell.column.align);
const getStyles = (props, align = 'left') => [
  props,
  {
    style: {
      justifyContent: align == 'right' ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
      display: 'flex',
    },
  },
];
const TableDisplay = ({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  columns,
  rows,
  loading,
  highlightRowId,
}: TableCollectionProps) => (
    <TableDiv>
  <table
    {...getTableProps()}
    className="table table-hover"
    data-test="listview-table"
  >
    <div className="thread">
      {headerGroups.map(headerGroup => (
        <div className="tr" {...headerGroup.getHeaderGroupProps()}>
          {headerGroup.headers.map(column => {
            {
              /*let sortIcon = <Icons.Sort />;
            if (column.isSorted && column.isSortedDesc) {
              sortIcon = <Icons.SortDesc />;
            } else if (column.isSorted && !column.isSortedDesc) {
              sortIcon = <Icons.SortAsc />;
            }*/
            }
            return column.hidden ? null : (
              <div
                {...column.getHeaderProps(
                  column.canSort ? column.getSortByToggleProps() : {},
                )}
                {...column.getHeaderProps(headerProps)}
                data-test="sort-header"
                className="th"
              >
                <span>
                  {column.render('Header')}
                  {/*{column.isSorted && sortIcon}*/}
                </span>
                <div
                  {...column.getResizerProps()}
                  className={`resizer ${column.isResizing ? 'isResizing' : ''}`}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
    <div className="tbody" {...getTableBodyProps()}>
      {loading &&
        rows.length === 0 &&
        [...new Array(25)].map((_, i) => (
          <div className="tr" key={i}>
            {columns.map((column, i2) => {
              if (column.hidden) return null;

              return (
                <div className="td" key={i2}>
                  {column.accessor('id')}
                  <span className="loading-bar" role="progressbar">
                    <span>LOADING</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      {rows.length > 0 &&
        rows.map(row => {
          prepareRow(row);
          // @ts-ignore
          const rowId = row.original.id;
          return (
            <div
              className="tr table-row"
              data-test="table-row"
              {...row.getRowProps()}
            >
              {row.cells.map(cell => {
                if (cell.column.hidden) return null;

                const columnCellProps = cell.column.cellProps || {};
                return (
                  <div
                    className="td"
                    data-test="table-row-cell"
                    {...cell.getCellProps(cellProps)}
                    {...columnCellProps}
                  >
                    <span
                      className={cx({ 'loading-bar': loading })}
                      role={loading ? 'progressbar' : undefined}
                    >
                      <span data-test="cell-text">{cell.render('Cell')}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  </table>
      </TableDiv>
);
export default React.memo(TableDisplay);

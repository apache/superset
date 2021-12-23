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
{/*border: 2px solid red; */}
    ${
      '' /* These styles are suggested for the table fill all available space in its containing element */
    }
      {/*display: inline-block;*/}
        ${
          '' /* These styles are required for a horizontaly scrollable table overflow */
        }
          {/*overflow: auto;*/}
.table{
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-collapse: separate;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  overflow: auto;
  border-spacing: 0;
  border: ${({ theme }) =>
          `${theme.gridUnit * 0.25}px solid ${theme.colors.grayscale.light2}`};
};
    .thread {
        {/*overflow-y: auto;*/}
        {/*overflow-x: auto;*/}
    }
    .tbody {
        {/*overflow-y: scroll;*/}
        {/*overflow-x: scroll;*/}
        height: ${({ theme }) => `${theme.gridUnit * 100}px `};
        border-top: ${({ theme }) =>
          `${theme.gridUnit * 0.5}px solid ${theme.colors.grayscale.light2}`};

    }

    .th[role='columnheader'] {
        z-index: 1;
        border-right: ${({ theme }) =>
          `${theme.gridUnit * 0.25}px solid ${theme.colors.grayscale.light2}`};
        font-weight: 700;
        cursor: pointer;
                :last-of-type{
        border-right: none;
        }
      }
      
   .tr[role='row'] {
   min-width: 100%;
    height: ${({ theme }) => `${theme.gridUnit * 8}px`};        
   } 

      .tr.table-row:nth-child(odd) {
    background-color: ${({ theme }) => `${theme.colors.grayscale.light3}`};
    
  }


    .th,
    .td {
    margin; 0;
    padding: ${({ theme }) => theme.gridUnit * 0.125}px;
    position: relative;
    white-space: nowrap;
    font-size: ${({ theme }) => `${theme.gridUnit * 3}px`};        
    padding: ${({ theme }) => `${theme.gridUnit * 3}px`};
    align-self: center;


    span{
    overflow: hidden;
    text-overflow: ellipsis;
    }

    :last-child {
    border-right: 0
    color:red;
    
    }
    .resizer {
      display: inline-block;
      width: ${({ theme }) => theme.gridUnit * 2.5}px;
      height: 100%;
      position: absolute;
      right: 0;
      top: 0;
      transform: translateX(50%);
      z-index: 1;
      ${'' /* prevents from scrolling while dragging on touch devices */}
      touch-action:none;
      


      &.isResizing {
        background: ${({ theme }) => `${theme.colors.grayscale.light3}`};
      }
    }
  }
  .tr.resizer:last-of-type{
      display: none
      }
  .tr,
  .td {
    margin: 0;
    border-right:  ${({ theme }) =>
      `${theme.gridUnit * 0.25}px solid ${theme.colors.grayscale.light2}`};
      empty-cells: show;

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
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
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
    <div
      {...getTableProps()}
      className="table table-hover"
      data-test="listview-table"
    >
      <div className="thread">
        {headerGroups.map(headerGroup => (
          <div className="tr" {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => {
              let sortIcon = <Icons.Sort />;
              if (column.isSorted && column.isSortedDesc) {
                sortIcon = <Icons.SortDesc />;
              } else if (column.isSorted && !column.isSortedDesc) {
                sortIcon = <Icons.SortAsc />;
              }

              return column.hidden ? null : (
                <div
                  {...column.getHeaderProps(headerProps)}
                  data-test="sort-header"
                  className="th"
                >
                  <span
                    {...column.getHeaderProps(
                      column.canSort ? column.getSortByToggleProps() : {},
                    )}
                    className="header-text"
                  >
                    {column.render('Header')}
                    {column.isSorted && sortIcon}
                  </span>
                  <div
                    {...column.getResizerProps()}
                    className={`resizer ${
                      column.isResizing ? 'isResizing' : ''
                    }`}
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
    </div>
  </TableDiv>
);
export default React.memo(TableDisplay);

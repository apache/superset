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
import React, { useEffect, useState } from 'react';
import {
  useQueryParams,
  NumberParam,
  StringParam,
  JsonParam,
} from 'use-query-params';
// @ts-ignore
import { useTable, useSortBy, usePagination, useFilters } from 'react-table';
import {
  Pagination,
  DropdownButton,
  FormControl,
  MenuItem,
  Row,
  Col,
  // @ts-ignore
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import {
  FetchDataConfig,
  TableState,
  SortColumns,
  FilterToggles,
} from './types';
import Loading from 'src/components/Loading';

import './styles.less';

const DEFAULT_PAGE_SIZE = 10;

interface Props {
  title: string;
  columns: Array<any>;
  data: Array<any>;
  count: number;
  fetchData: (conf: FetchDataConfig) => any;
  loading: boolean;
  defaultSort: SortColumns;
  filterable: boolean;
}

function FilterTrigger({
  columns,
  onFilter,
}: {
  columns: FilterToggles;
  onFilter: (id: string) => any;
}) {
  return (
    <div className="filter-dropdown">
      <DropdownButton
        bsSize="small"
        bsStyle={'default'}
        noCaret
        title={
          <>
            <i className="fa fa-filter text-primary" />
            {'  '}Filter List
          </>
        }
        id={'filter-picker'}
      >
        {columns.map((col: typeof columns[0]) => (
          <MenuItem key={col.id} eventKey={col} onSelect={onFilter}>
            {col.Header}
          </MenuItem>
        ))}
      </DropdownButton>
    </div>
  );
}

// removes element from a list, returns new list
function removeFromList(list: Array<any>, index: number): Array<any> {
  return list.filter((_, i) => index !== i);
}

// apply update to elements of object list, returns new list
function updateInList(
  list: Array<any>,
  index: number,
  update: any,
): Array<any> {
  const element = list.find((_, i) => index === i);

  return [
    ...list.slice(0, index),
    { ...element, ...update },
    ...list.slice(index + 1),
  ];
}

// convert filters from UI objects to data objects
function convertFilters(fts: FilterToggles) {
  return fts.reduce((acc, elem) => {
    acc[elem.id] = {
      filterId: elem.filterId || 0,
      filterValue: elem.filterValue,
    };
    return acc;
  }, {});
}

function useListViewState({ fetchData, columns, data, count, defaultSort }) {
  const [query, setQuery] = useQueryParams({
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
    filters: JsonParam,
  });

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageCount,
    gotoPage,
    setAllFilters,
    state: { pageIndex, pageSize, sortBy, filters },
  }: TableState = useTable(
    {
      columns,
      data,
      count,
      initialState: {
        pageIndex: query.pageIndex || 0,
        pageSize: DEFAULT_PAGE_SIZE,
        sortBy:
          query.sortColumn && query.sortOrder
            ? [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }]
            : defaultSort,
        filters: convertFilters(query.filters || []),
      },
      manualSorting: true,
      disableSortRemove: true,
      manualPagination: true,
      manualFilters: true,
      pageCount: Math.ceil(count / DEFAULT_PAGE_SIZE),
    },
    useFilters,
    useSortBy,
    usePagination,
  );

  const [filterToggles, setFilterToggles] = useState<FilterToggles>(
    query.filters || [],
  );

  useEffect(() => {
    setQuery({
      pageIndex,
      sortColumn: sortBy[0].id,
      sortOrder: sortBy[0].desc ? 'desc' : 'asc',
      filters: filterToggles,
    });

    fetchData({ pageIndex, pageSize, sortBy, filters });
  }, [fetchData, pageIndex, pageSize, sortBy, filters]);

  return {
    setFilterToggles,
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageCount,
    gotoPage,
    setAllFilters,
    state: { pageIndex, pageSize, sortBy, filters, filterToggles },
    updateFilterToggle: (index: number, update: object) =>
      setFilterToggles(updateInList(filterToggles, index, update)),
    applyFilters: () => setAllFilters(convertFilters(filterToggles)),
  };
}

export default function ListView({
  title,
  columns,
  data,
  count,
  fetchData,
  loading,
  defaultSort,
  filterable,
}: Props) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageCount,
    gotoPage,
    setAllFilters,
    setFilterToggles,
    updateFilterToggle,
    applyFilters,
    state: { pageIndex, pageSize, filterToggles },
  } = useListViewState({
    fetchData,
    columns,
    data,
    count,
    defaultSort,
  });

  const removeFilterAndApply = (index: number) => {
    const updated = removeFromList(filterToggles, index);
    setFilterToggles(updated);
    setAllFilters(convertFilters(updated));
  };

  return (
    <>
      <div className="header">
        <Row>
          <Col md={10}>
            <h2>{t(title)}</h2>
          </Col>
          {filterable && (
            <Col md={2}>
              <FilterTrigger
                columns={columns.filter(c => c.filterable)}
                onFilter={toggle =>
                  setFilterToggles([...filterToggles, toggle])
                }
              />
            </Col>
          )}
        </Row>
        <hr />
        {filterToggles.map((ft, i) => (
          <div key={`${ft.Header}-${i}`}>
            <Row>
              <Col md={1}>
                <div role="button" onClick={() => removeFilterAndApply(i)}>
                  <i className="fa fa-close text-primary" />
                </div>
              </Col>
              <Col md={2}>
                <span>{ft.Header}</span>
              </Col>
              <Col md={2}>
                <FormControl
                  componentClass="select"
                  bsSize="small"
                  value={ft.filterId || 0}
                  placeholder="Starts With"
                  onChange={(e: React.MouseEvent<HTMLInputElement>) =>
                    updateFilterToggle(i, { filterId: e.currentTarget.value })
                  }
                >
                  {[
                    'Starts With',
                    'Ends With',
                    'Contains',
                    'Equal To',
                    'Not Starts With',
                    'Not Ends With',
                    'Not Contains',
                    'Not Equal To',
                  ].map((label, i) => (
                    <option key={label} value={i}>
                      {label}
                    </option>
                  ))}
                </FormControl>
              </Col>
              <Col md={1} />
              <Col md={4}>
                <FormControl
                  type="text"
                  bsSize="small"
                  placeholder={ft.Header}
                  value={ft.filterValue || ''}
                  onChange={(e: React.KeyboardEvent<HTMLInputElement>) =>
                    updateFilterToggle(i, {
                      filterValue: e.currentTarget.value,
                    })
                  }
                />
              </Col>
            </Row>
            <br />
          </div>
        ))}
        {filterToggles.length > 0 && (
          <>
            <Row>
              <Col md={4}>
                {filterToggles.length > 0 && (
                  <button onClick={applyFilters}>Apply</button>
                )}
              </Col>
            </Row>
            <br />{' '}
          </>
        )}
      </div>
      <div className="body">
        <TableCollection
          getTableProps={getTableProps}
          getTableBodyProps={getTableBodyProps}
          prepareRow={prepareRow}
          headerGroups={headerGroups}
          rows={rows}
          loading={loading}
        />
      </div>
      <div className="footer">
        <Pagination
          prev={canPreviousPage}
          first={pageIndex > 1}
          next={canNextPage}
          last={pageIndex < pageCount - 2}
          items={pageCount}
          activePage={pageIndex + 1}
          ellipsis
          boundaryLinks
          maxButtons={5}
          onSelect={(p: number) => gotoPage(p - 1)}
        />
        <span className="pull-right">
          showing{' '}
          <strong>
            {pageSize * pageIndex + 1}-{pageSize * pageIndex + rows.length}
          </strong>{' '}
          of <strong>{count}</strong>
        </span>
      </div>
    </>
  );
}

function TableCollection({
  getTableProps,
  getTableBodyProps,
  prepareRow,
  headerGroups,
  rows,
  loading,
}: any) {
  if (loading) {
    return <Loading />;
  }
  return (
    <table {...getTableProps()} className="table">
      <thead>
        {headerGroups.map((headerGroup: any) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column: any) => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {'  '}
                <i
                  className={`text-primary fa fa-${
                    column.isSorted
                      ? column.isSortedDesc
                        ? 'sort-down'
                        : 'sort-up'
                      : 'sort'
                  }`}
                />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row: any) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map((cell: any) => {
                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

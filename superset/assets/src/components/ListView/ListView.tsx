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
import {
  Pagination,
  DropdownButton,
  FormControl,
  MenuItem,
  Row,
  Col,
  Button,
  // @ts-ignore
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { FetchDataConfig, SortColumn, FilterToggle, FilterType } from './types';
import { removeFromList, useListViewState, convertFilters } from './utils';
import TableCollection from './TableCollection';
import './ListViewStyles.less';

interface Props {
  columns: any[];
  data: any[];
  count: number;
  pageSize: number;
  fetchData: (conf: FetchDataConfig) => any;
  loading: boolean;
  className: string;
  title?: string;
  initialSort?: SortColumn[];
  filterable?: boolean;
  filterTypes?: FilterType[];
}

export default function ListView({
  columns,
  data,
  count,
  pageSize: initialPageSize,
  fetchData,
  loading,
  initialSort,
  className = '',
  title = '',
  filterable = false,
  filterTypes = [],
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
    filtersApplied,
    state: { pageIndex, pageSize, filterToggles },
  } = useListViewState({
    fetchData,
    columns,
    data,
    count,
    initialPageSize,
    initialSort,
  });

  const removeFilterAndApply = (index: number) => {
    const updated = removeFromList(filterToggles, index);
    setFilterToggles(updated);
    setAllFilters(convertFilters(updated));
  };

  return (
    <div className={`superset-list-view ${className}`}>
      {title && filterable && (
        <div className="header">
          <Row>
            <Col md={10}>
              <h2>{t(title)}</h2>
            </Col>
            {filterable && (
              <Col md={2}>
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
                    {columns
                      .filter(c => c.filterable)
                      .map(({ id, accessor, Header }) => ({
                        id: id || accessor,
                        Header,
                      }))
                      .map((filter: FilterToggle) => (
                        <MenuItem
                          key={filter.id}
                          eventKey={filter}
                          onSelect={(filter: FilterToggle) =>
                            setFilterToggles([...filterToggles, filter])
                          }
                        >
                          {filter.Header}
                        </MenuItem>
                      ))}
                  </DropdownButton>
                </div>
              </Col>
            )}
          </Row>
          <hr />
          {filterToggles.map((ft, i) => (
            <div key={`${ft.Header}-${i}`}>
              <Row>
                <Col className="text-center filter-column" md={2}>
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
                    {filterTypes.map(
                      ({ label, value }: { label: string; value: any }) => (
                        <option key={label} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </FormControl>
                </Col>
                <Col md={1} />
                <Col md={4}>
                  <FormControl
                    type="text"
                    bsSize="small"
                    value={ft.filterValue || ''}
                    onChange={(e: React.KeyboardEvent<HTMLInputElement>) =>
                      updateFilterToggle(i, {
                        filterValue: e.currentTarget.value,
                      })
                    }
                  />
                </Col>
                <Col md={1}>
                  <div
                    className="filter-close"
                    role="button"
                    onClick={() => removeFilterAndApply(i)}
                  >
                    <i className="fa fa-close text-primary" />
                  </div>
                </Col>
              </Row>
              <br />
            </div>
          ))}
          {filterToggles.length > 0 && (
            <>
              <Row>
                <Col md={10} />
                <Col md={2}>
                  {filterToggles.length > 0 && (
                    <Button
                      disabled={filtersApplied ? true : false}
                      bsStyle="primary"
                      onClick={applyFilters}
                      bsSize="small"
                    >
                      Apply
                    </Button>
                  )}
                </Col>
              </Row>
              <br />{' '}
            </>
          )}
        </div>
      )}
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
            {pageSize * pageIndex + (rows.length && 1)}-
            {pageSize * pageIndex + rows.length}
          </strong>{' '}
          of <strong>{count}</strong>
        </span>
      </div>
    </div>
  );
}

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
import { t } from '@superset-ui/translation';
import React, { FunctionComponent } from 'react';
import { Col, DropdownButton, MenuItem, Row } from 'react-bootstrap';
import IndeterminateCheckbox from '../IndeterminateCheckbox';
import TableCollection from './TableCollection';
import Pagination from './Pagination';
import { FilterMenu, FilterInputs } from './LegacyFilters';
import FilterControls from './Filters';
import { FetchDataConfig, Filters, SortColumn } from './types';
import { ListViewError, useListViewState } from './utils';

import './ListViewStyles.less';

interface Props {
  columns: any[];
  data: any[];
  count: number;
  pageSize: number;
  fetchData: (conf: FetchDataConfig) => any;
  loading: boolean;
  className?: string;
  title?: string;
  initialSort?: SortColumn[];
  filters?: Filters;
  bulkActions?: Array<{
    key?: string;
    name: React.ReactNode;
    onSelect: (rows: any[]) => any;
  }>;
  useNewUIFilters?: boolean;
}

const bulkSelectColumnConfig = {
  Cell: ({ row }: any) => (
    <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} id={row.id} />
  ),
  Header: ({ getToggleAllRowsSelectedProps }: any) => (
    <IndeterminateCheckbox
      {...getToggleAllRowsSelectedProps()}
      id={'header-toggle-all'}
    />
  ),
  id: 'selection',
};

const ListView: FunctionComponent<Props> = ({
  columns,
  data,
  count,
  pageSize: initialPageSize,
  fetchData,
  loading,
  initialSort = [],
  className = '',
  title = '',
  filters = [],
  bulkActions = [],
  useNewUIFilters = false,
}) => {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    pageCount = 1,
    gotoPage,
    removeFilterAndApply,
    setInternalFilters,
    updateInternalFilter,
    applyFilterValue,
    applyFilters,
    filtersApplied,
    selectedFlatRows,
    state: { pageIndex, pageSize, internalFilters },
  } = useListViewState({
    bulkSelectColumnConfig,
    bulkSelectMode: Boolean(bulkActions.length),
    columns,
    count,
    data,
    fetchData,
    initialPageSize,
    initialSort,
    initialFilters: useNewUIFilters ? filters : [],
  });
  const filterable = Boolean(filters.length);
  if (filterable) {
    const columnAccessors = columns.reduce(
      (acc, col) => ({ ...acc, [col.accessor || col.id]: true }),
      {},
    );
    filters.forEach(f => {
      if (!columnAccessors[f.id]) {
        throw new ListViewError(
          `Invalid filter config, ${f.id} is not present in columns`,
        );
      }
    });
  }

  return (
    <div className={`superset-list-view ${className}`}>
      <div className="header">
        {!useNewUIFilters && (
          <>
            {title && filterable && (
              <>
                <Row>
                  <Col md={10}>
                    <h2>{t(title)}</h2>
                  </Col>
                  {filterable && (
                    <Col md={2}>
                      <FilterMenu
                        filters={filters}
                        internalFilters={internalFilters}
                        setInternalFilters={setInternalFilters}
                      />
                    </Col>
                  )}
                </Row>
                <hr />
                <FilterInputs
                  internalFilters={internalFilters}
                  filters={filters}
                  updateInternalFilter={updateInternalFilter}
                  removeFilterAndApply={removeFilterAndApply}
                  filtersApplied={filtersApplied}
                  applyFilters={applyFilters}
                />
              </>
            )}
          </>
        )}
        {useNewUIFilters && (
          <>
            <Row>
              <Col md={10}>
                <h2>{t(title)}</h2>
              </Col>
            </Row>
            <hr />
            <FilterControls
              filters={filters}
              internalFilters={internalFilters}
              updateFilterValue={applyFilterValue}
            />
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
        <Row>
          <Col md={2}>
            <div className="form-actions-container">
              <div className="btn-group">
                {bulkActions.length > 0 && (
                  <DropdownButton
                    id="bulk-actions"
                    bsSize="small"
                    bsStyle="default"
                    noCaret
                    title={
                      <>
                        {t('Actions')} <span className="caret" />
                      </>
                    }
                  >
                    {bulkActions.map(action => (
                      // @ts-ignore
                      <MenuItem
                        key={action.key}
                        eventKey={selectedFlatRows}
                        // @ts-ignore
                        onSelect={(selectedRows: typeof selectedFlatRows) => {
                          action.onSelect(
                            selectedRows.map((r: any) => r.original),
                          );
                        }}
                      >
                        {action.name}
                      </MenuItem>
                    ))}
                  </DropdownButton>
                )}
              </div>
            </div>
          </Col>
          <Col md={8} className="text-center">
            <Pagination
              totalPages={pageCount || 0}
              currentPage={pageCount ? pageIndex + 1 : 0}
              onChange={(p: number) => gotoPage(p - 1)}
              hideFirstAndLastPageLinks
            />
          </Col>
          <Col md={2}>
            <span className="pull-right">
              {t('showing')}{' '}
              <strong>
                {pageSize * pageIndex + (rows.length && 1)}-
                {pageSize * pageIndex + rows.length}
              </strong>{' '}
              {t('of')} <strong>{count}</strong>
            </span>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ListView;

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
import { Col, Row, Alert } from 'react-bootstrap';
import styled from '@superset-ui/style';
import cx from 'classnames';
import Button from 'src/components/Button';
import Loading from 'src/components/Loading';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import TableCollection from './TableCollection';
import Pagination from './Pagination';
import { FilterMenu, FilterInputs } from './LegacyFilters';
import FilterControls from './Filters';
import { FetchDataConfig, Filters, SortColumn } from './types';
import { ListViewError, useListViewState } from './utils';

import './ListViewStyles.less';

export interface ListViewProps {
  columns: any[];
  data: any[];
  count: number;
  pageSize: number;
  fetchData: (conf: FetchDataConfig) => any;
  loading: boolean;
  className?: string;
  initialSort?: SortColumn[];
  filters?: Filters;
  bulkActions?: Array<{
    key: string;
    name: React.ReactNode;
    onSelect: (rows: any[]) => any;
    type?: 'primary' | 'secondary' | 'danger';
  }>;
  isSIP34FilterUIEnabled?: boolean;
  bulkSelectEnabled?: boolean;
  disableBulkSelect?: () => void;
  renderBulkSelectCopy?: (selects: any[]) => React.ReactNode;
}

const BulkSelectWrapper = styled(Alert)`
  border-radius: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  padding-right: 36px;
  color: #3d3d3d;
  background-color: ${({ theme }) => theme.colors.primary.light4};

  .selectedCopy {
    display: inline-block;
    padding: 16px 0;
  }

  .deselect-all {
    color: #1985a0;
    margin-left: 16px;
  }

  .divider {
    margin: -8px 0 -8px 16px;
    width: 1px;
    height: 32px;
    box-shadow: inset -1px 0px 0px #dadada;
    display: inline-flex;
    vertical-align: middle;
    position: relative;
  }

  .close {
    margin: 16px 0;
  }
`;

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
  size: 'sm',
};

const ListView: FunctionComponent<ListViewProps> = ({
  columns,
  data,
  count,
  pageSize: initialPageSize,
  fetchData,
  loading,
  initialSort = [],
  className = '',
  filters = [],
  bulkActions = [],
  isSIP34FilterUIEnabled = false,
  bulkSelectEnabled = false,
  disableBulkSelect = () => {},
  renderBulkSelectCopy = selected => t('%s Selected', selected.length),
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
    toggleAllRowsSelected,
    state: { pageIndex, pageSize, internalFilters },
  } = useListViewState({
    bulkSelectColumnConfig,
    bulkSelectMode: bulkSelectEnabled && Boolean(bulkActions.length),
    columns,
    count,
    data,
    fetchData,
    initialPageSize,
    initialSort,
    initialFilters: isSIP34FilterUIEnabled ? filters : [],
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
  if (loading && !data.length) {
    return <Loading />;
  }
  return (
    <div className="superset-list-view-container">
      <div className={`superset-list-view ${className}`}>
        <div className="header">
          {!isSIP34FilterUIEnabled && filterable && (
            <>
              <Row>
                <Col md={10} />
                <Col md={2}>
                  <FilterMenu
                    filters={filters}
                    internalFilters={internalFilters}
                    setInternalFilters={setInternalFilters}
                  />
                </Col>
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
          {isSIP34FilterUIEnabled && filterable && (
            <FilterControls
              filters={filters}
              internalFilters={internalFilters}
              updateFilterValue={applyFilterValue}
            />
          )}
        </div>
        <div className="body">
          {bulkSelectEnabled && (
            <BulkSelectWrapper
              data-test="bulk-select-controls"
              bsStyle="info"
              onDismiss={disableBulkSelect}
            >
              <div className="selectedCopy" data-test="bulk-select-copy">
                {renderBulkSelectCopy(selectedFlatRows)}
              </div>
              {Boolean(selectedFlatRows.length) && (
                <>
                  <span
                    data-test="bulk-select-deselect-all"
                    role="button"
                    tabIndex={0}
                    className="deselect-all"
                    onClick={() => toggleAllRowsSelected(false)}
                  >
                    {t('Deselect All')}
                  </span>
                  <div className="divider" />
                  {bulkActions.map(action => (
                    <Button
                      data-test="bulk-select-action"
                      key={action.key}
                      className={cx('supersetButton', {
                        danger: action.type === 'danger',
                        primary: action.type === 'primary',
                        secondary: action.type === 'secondary',
                      })}
                      onClick={() =>
                        action.onSelect(selectedFlatRows.map(r => r.original))
                      }
                    >
                      {action.name}
                    </Button>
                  ))}
                </>
              )}
            </BulkSelectWrapper>
          )}
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
            <Col>
              <span className="row-count-container">
                showing{' '}
                <strong>
                  {pageSize * pageIndex + (rows.length && 1)}-
                  {pageSize * pageIndex + rows.length}
                </strong>{' '}
                of <strong>{count}</strong>
              </span>
            </Col>
          </Row>
        </div>
      </div>
      <Pagination
        totalPages={pageCount || 0}
        currentPage={pageCount ? pageIndex + 1 : 0}
        onChange={(p: number) => gotoPage(p - 1)}
        hideFirstAndLastPageLinks
      />
    </div>
  );
};

export default ListView;

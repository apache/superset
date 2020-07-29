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
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import TableCollection from './TableCollection';
import Pagination from './Pagination';
import FilterControls from './Filters';
import { FetchDataConfig, Filters, SortColumn } from './types';
import { ListViewError, useListViewState } from './utils';

const ListViewStyles = styled.div`
  text-align: center;

  .superset-list-view {
    text-align: left;
    background-color: white;
    border-radius: 4px 0;
    margin: 0 16px;
    padding-bottom: 48px;

    .body {
      overflow: scroll;
      max-height: 64vh;

      table {
        border-collapse: separate;

        th {
          background: white;
          position: sticky;
          top: 0;
        }
      }
    }

    .filter-dropdown {
      margin-top: 20px;
    }

    .filter-column {
      height: 30px;
      padding: 5px;
      font-size: 16px;
    }

    .filter-close {
      height: 30px;
      padding: 5px;

      i {
        font-size: 20px;
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
      font-size: 24px;
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
    }

    .sort-icon {
      position: absolute;
    }

    .form-actions-container {
      position: absolute;
      left: 28px;
    }

    .row-count-container {
      float: right;
      padding-right: 24px;
    }
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
    applyFilterValue,
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
    initialFilters: filters,
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
    <ListViewStyles>
      <div className={`superset-list-view ${className}`}>
        <div className="header">
          {filterable && (
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
    </ListViewStyles>
  );
};

export default ListView;

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
import { t, styled } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { Empty } from 'src/common/components';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import { TableCollection, Pagination } from 'src/components/dataViewCommon';
import CardCollection from './CardCollection';
import FilterControls from './Filters';
import { CardSortSelect } from './CardSortSelect';
import {
  FetchDataConfig,
  Filters,
  SortColumn,
  CardSortSelectOption,
} from './types';
import { ListViewError, useListViewState } from './utils';

const ListViewStyles = styled.div`
  text-align: center;

  .superset-list-view {
    text-align: left;
    border-radius: 4px 0;
    margin: 0 16px;

    .header {
      display: flex;

      .header-left {
        flex: 5;
      }
      .header-right {
        flex: 1;
        text-align: right;
      }
    }
    .body {
    }
  }

  .pagination-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .row-count-container {
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

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
      id="header-toggle-all"
    />
  ),
  id: 'selection',
  size: 'sm',
};

const ViewModeContainer = styled.div`
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px
    ${({ theme }) => theme.gridUnit * 8}px 0;
  display: inline-block;
  position: relative;
  top: 8px;

  .toggle-button {
    display: inline-block;
    border-radius: ${({ theme }) => theme.gridUnit / 2}px;
    padding: ${({ theme }) => theme.gridUnit}px;
    padding-bottom: 0;

    &:first-of-type {
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }

  .active {
    background-color: ${({ theme }) => theme.colors.grayscale.base};
    svg {
      color: ${({ theme }) => theme.colors.grayscale.light5};
    }
  }
`;

const EmptyWrapper = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 40}px 0;
`;

const ViewModeToggle = ({
  mode,
  setMode,
}: {
  mode: 'table' | 'card';
  setMode: (mode: 'table' | 'card') => void;
}) => {
  return (
    <ViewModeContainer>
      <div
        role="button"
        tabIndex={0}
        onClick={e => {
          e.currentTarget.blur();
          setMode('card');
        }}
        className={cx('toggle-button', { active: mode === 'card' })}
      >
        <Icon name="card-view" />
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={e => {
          e.currentTarget.blur();
          setMode('table');
        }}
        className={cx('toggle-button', { active: mode === 'table' })}
      >
        <Icon name="list-view" />
      </div>
    </ViewModeContainer>
  );
};

type ViewModeType = 'card' | 'table';
export interface ListViewProps<T extends object = any> {
  columns: any[];
  data: T[];
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
  renderCard?: (row: T & { loading: boolean }) => React.ReactNode;
  cardSortSelectOptions?: Array<CardSortSelectOption>;
  defaultViewMode?: ViewModeType;
  highlightRowId?: number;
}

function ListView<T extends object = any>({
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
  renderCard,
  cardSortSelectOptions,
  defaultViewMode = 'card',
  highlightRowId,
}: ListViewProps<T>) {
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
      (acc, col) => ({ ...acc, [col.id || col.accessor]: true }),
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

  const cardViewEnabled = Boolean(renderCard);
  const [viewingMode, setViewingMode] = useState<ViewModeType>(
    cardViewEnabled ? defaultViewMode : 'table',
  );

  useEffect(() => {
    // discard selections if bulk select is disabled
    if (!bulkSelectEnabled) toggleAllRowsSelected(false);
  }, [bulkSelectEnabled, toggleAllRowsSelected]);

  return (
    <ListViewStyles>
      <div data-test={className} className={`superset-list-view ${className}`}>
        <div className="header">
          <div className="header-left">
            {cardViewEnabled && (
              <ViewModeToggle mode={viewingMode} setMode={setViewingMode} />
            )}
            {filterable && (
              <FilterControls
                filters={filters}
                internalFilters={internalFilters}
                updateFilterValue={applyFilterValue}
              />
            )}
          </div>
          <div className="header-right">
            {viewingMode === 'card' && cardSortSelectOptions && (
              <CardSortSelect
                initialSort={initialSort}
                onChange={fetchData}
                options={cardSortSelectOptions}
                pageIndex={pageIndex}
                pageSize={pageSize}
              />
            )}
          </div>
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
                      className={cx({
                        'btn-danger': action.type === 'danger',
                        'btn-primary': action.type === 'primary',
                        'btn-secondary': action.type === 'secondary',
                      })}
                      cta
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
          {viewingMode === 'card' && (
            <CardCollection
              bulkSelectEnabled={bulkSelectEnabled}
              prepareRow={prepareRow}
              renderCard={renderCard}
              rows={rows}
              loading={loading}
            />
          )}
          {viewingMode === 'table' && (
            <TableCollection
              getTableProps={getTableProps}
              getTableBodyProps={getTableBodyProps}
              prepareRow={prepareRow}
              headerGroups={headerGroups}
              rows={rows}
              columns={columns}
              loading={loading}
              highlightRowId={highlightRowId}
            />
          )}
          {!loading && rows.length === 0 && (
            <EmptyWrapper>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </EmptyWrapper>
          )}
        </div>
      </div>

      <div className="pagination-container">
        <Pagination
          totalPages={pageCount || 0}
          currentPage={pageCount ? pageIndex + 1 : 0}
          onChange={(p: number) => gotoPage(p - 1)}
          hideFirstAndLastPageLinks
        />
        <div className="row-count-container">
          {!loading &&
            t(
              '%s-%s of %s',
              pageSize * pageIndex + (rows.length && 1),
              pageSize * pageIndex + rows.length,
              count,
            )}
        </div>
      </div>
    </ListViewStyles>
  );
}

export default ListView;

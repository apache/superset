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
import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import cx from 'classnames';
import TableCollection from '@superset-ui/core/components/TableCollection';
import BulkTagModal from 'src/features/tags/BulkTagModal';
import {
  Alert,
  Button,
  Checkbox,
  Icons,
  EmptyState,
  type EmptyStateProps,
} from '@superset-ui/core/components';
import CardCollection from './CardCollection';
import FilterControls from './Filters';
import { CardSortSelect } from './CardSortSelect';
import {
  ListViewFetchDataConfig as FetchDataConfig,
  ListViewFilters as Filters,
  SortColumn,
  CardSortSelectOption,
  ViewModeType,
} from './types';
import { ListViewError, useListViewState } from './utils';

const ListViewStyles = styled.div`
  ${({ theme }) => `
    text-align: center;
    background-color: ${theme.colorBgLayout};
    padding-top: ${theme.paddingXS}px;

    .superset-list-view {
      text-align: left;
      border-radius: 4px 0;
      margin: 0 ${theme.sizeUnit * 4}px;

      .header {
        display: flex;
        padding-bottom: ${theme.sizeUnit * 4}px;

        & .controls {
          display: flex;
          flex-wrap: wrap;
          column-gap: ${theme.sizeUnit * 7}px;
          row-gap: ${theme.sizeUnit * 4}px;
        }
      }

      .body.empty table {
        margin-bottom: 0;
      }

      .body {
        overflow-x: auto;
        overflow-y: hidden;
      }

      .ant-empty {
        .ant-empty-image {
          height: auto;
        }
      }
    }

    .pagination-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin-bottom: ${theme.sizeUnit * 4}px;
    }

    .row-count-container {
      margin-top: ${theme.sizeUnit * 2}px;
      color: ${theme.colorText};
    }
  `}
`;

const BulkSelectWrapper = styled(Alert)`
  ${({ theme }) => `
    border-radius: 0;
    margin-bottom: 0;
    color: ${theme.colorText};
    background-color: ${theme.colorPrimaryBg};

    .selectedCopy {
      display: inline-block;
      padding: ${theme.sizeUnit * 2}px 0;
    }

    .deselect-all, .tag-btn {
      color: ${theme.colorPrimary};
      margin-left: ${theme.sizeUnit * 4}px;
    }

    .divider {
      margin: ${`${-theme.sizeUnit * 2}px 0 ${-theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px`};
      width: 1px;
      height: ${theme.sizeUnit * 8}px;
      box-shadow: inset -1px 0px 0px ${theme.colorBorder};
      display: inline-flex;
      vertical-align: middle;
      position: relative;
    }

    .ant-alert-close-icon {
      margin-top: ${theme.sizeUnit * 1.5}px;
    }
  `}
`;

const bulkSelectColumnConfig = {
  Cell: ({ row }: any) => (
    <Checkbox {...row.getToggleRowSelectedProps()} id={row.id} />
  ),
  Header: ({ getToggleAllRowsSelectedProps }: any) => (
    <Checkbox
      {...getToggleAllRowsSelectedProps()}
      id="header-toggle-all"
      data-test="header-toggle-all"
    />
  ),
  id: 'selection',
  size: 'sm',
};

const ViewModeContainer = styled.div`
  ${({ theme }) => `
    padding-right: ${theme.sizeUnit * 4}px;
    margin-top: ${theme.sizeUnit * 5 + 1}px;
    white-space: nowrap;
    display: inline-block;

    .toggle-button {
      display: inline-block;
      border-radius: ${theme.borderRadius}px;
      padding: ${theme.sizeUnit}px;
      padding-bottom: ${theme.sizeUnit * 0.5}px;

      &:first-of-type {
        margin-right: ${theme.sizeUnit * 2}px;
      }
    }

    .active {
      background-color: ${theme.colorText};

      svg {
        color: ${theme.colorBgLayout};
      }
    }
  `}
`;

const EmptyWrapper = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 40}px 0;

    &.table {
      background: ${theme.colorBgContainer};
    }
  `}
`;

const ViewModeToggle = ({
  mode,
  setMode,
}: {
  mode: 'table' | 'card';
  setMode: (mode: 'table' | 'card') => void;
}) => (
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
      <Icons.AppstoreOutlined iconSize="xl" />
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
      <Icons.UnorderedListOutlined iconSize="xl" />
    </div>
  </ViewModeContainer>
);

export interface ListViewProps<T extends object = any> {
  columns: any[];
  data: T[];
  count: number;
  pageSize: number;
  fetchData: (conf: FetchDataConfig) => any;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  loading: boolean;
  className?: string;
  initialSort?: SortColumn[];
  filters?: Filters;
  bulkActions?: Array<{
    key: string;
    name: ReactNode;
    onSelect: (rows: any[]) => any;
    type?: 'primary' | 'secondary' | 'danger';
  }>;
  bulkSelectEnabled?: boolean;
  disableBulkSelect?: () => void;
  renderBulkSelectCopy?: (selects: any[]) => ReactNode;
  renderCard?: (row: T & { loading: boolean }) => ReactNode;
  cardSortSelectOptions?: Array<CardSortSelectOption>;
  defaultViewMode?: ViewModeType;
  highlightRowId?: number;
  showThumbnails?: boolean;
  emptyState?: EmptyStateProps;
  columnsForWrapText?: string[];
  enableBulkTag?: boolean;
  bulkTagResourceName?: string;
}

export function ListView<T extends object = any>({
  columns,
  data,
  count,
  pageSize: initialPageSize,
  fetchData,
  refreshData,
  loading,
  initialSort = [],
  className = '',
  filters = [],
  bulkActions = [],
  bulkSelectEnabled = false,
  disableBulkSelect = () => {},
  renderBulkSelectCopy = selected => t('%s Selected', selected.length),
  renderCard,
  showThumbnails,
  cardSortSelectOptions,
  defaultViewMode = 'card',
  highlightRowId,
  emptyState,
  columnsForWrapText,
  enableBulkTag = false,
  bulkTagResourceName,
  addSuccessToast,
  addDangerToast,
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
    setSortBy,
    selectedFlatRows,
    toggleAllRowsSelected,
    setViewMode,
    state: { pageIndex, pageSize, internalFilters, sortBy, viewMode },
    query,
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
    renderCard: Boolean(renderCard),
    defaultViewMode,
  });
  const allowBulkTagActions = bulkTagResourceName && enableBulkTag;
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

  const filterControlsRef = useRef<{ clearFilters: () => void }>(null);

  const handleClearFilterControls = useCallback(() => {
    if (query.filters) {
      filterControlsRef.current?.clearFilters();
    }
  }, [query.filters]);

  const cardViewEnabled = Boolean(renderCard);
  const [showBulkTagModal, setShowBulkTagModal] = useState<boolean>(false);

  useEffect(() => {
    // discard selections if bulk select is disabled
    if (!bulkSelectEnabled) toggleAllRowsSelected(false);
  }, [bulkSelectEnabled, toggleAllRowsSelected]);

  useEffect(() => {
    if (!loading && pageIndex > pageCount - 1 && pageCount > 0) {
      gotoPage(0);
    }
  }, [gotoPage, loading, pageCount, pageIndex]);

  return (
    <ListViewStyles>
      {allowBulkTagActions && (
        <BulkTagModal
          show={showBulkTagModal}
          selected={selectedFlatRows}
          refreshData={refreshData}
          resourceName={bulkTagResourceName}
          addSuccessToast={addSuccessToast}
          addDangerToast={addDangerToast}
          onHide={() => setShowBulkTagModal(false)}
        />
      )}
      <div data-test={className} className={`superset-list-view ${className} `}>
        <div className="header">
          {cardViewEnabled && (
            <ViewModeToggle mode={viewMode} setMode={setViewMode} />
          )}
          <div className="controls" data-test="filters-select">
            {filterable && (
              <FilterControls
                ref={filterControlsRef}
                filters={filters}
                internalFilters={internalFilters}
                updateFilterValue={applyFilterValue}
              />
            )}
            {viewMode === 'card' && cardSortSelectOptions && (
              <CardSortSelect
                initialSort={sortBy}
                onChange={(value: SortColumn[]) => setSortBy(value)}
                options={cardSortSelectOptions}
              />
            )}
          </div>
        </div>
        <div className={`body ${rows.length === 0 ? 'empty' : ''} `}>
          {bulkSelectEnabled && (
            <BulkSelectWrapper
              data-test="bulk-select-controls"
              type="info"
              closable
              showIcon={false}
              onClose={disableBulkSelect}
              message={
                <>
                  <div className="selectedCopy" data-test="bulk-select-copy">
                    {renderBulkSelectCopy(selectedFlatRows)}
                  </div>
                  {Boolean(selectedFlatRows.length) && (
                    <>
                      <span
                        data-test="bulk-select-deselect-all"
                        style={{ cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        className="deselect-all"
                        onClick={() => toggleAllRowsSelected(false)}
                      >
                        {t('Deselect all')}
                      </span>
                      <div className="divider" />
                      {bulkActions.map(action => (
                        <Button
                          data-test="bulk-select-action"
                          key={action.key}
                          buttonStyle={action.type}
                          cta
                          onClick={() =>
                            action.onSelect(
                              selectedFlatRows.map(r => r.original),
                            )
                          }
                        >
                          {action.name}
                        </Button>
                      ))}
                      {enableBulkTag && (
                        <span
                          data-test="bulk-select-tag-btn"
                          role="button"
                          style={{ cursor: 'pointer' }}
                          tabIndex={0}
                          className="tag-btn"
                          onClick={() => setShowBulkTagModal(true)}
                        >
                          {t('Add Tag')}
                        </span>
                      )}
                    </>
                  )}
                </>
              }
            />
          )}
          {viewMode === 'card' && (
            <CardCollection
              bulkSelectEnabled={bulkSelectEnabled}
              prepareRow={prepareRow}
              renderCard={renderCard}
              rows={rows}
              loading={loading}
              showThumbnails={showThumbnails}
            />
          )}
          {viewMode === 'table' && (
            <TableCollection
              getTableProps={getTableProps}
              getTableBodyProps={getTableBodyProps}
              prepareRow={prepareRow}
              headerGroups={headerGroups}
              setSortBy={setSortBy}
              rows={rows}
              columns={columns}
              loading={loading}
              highlightRowId={highlightRowId}
              columnsForWrapText={columnsForWrapText}
              bulkSelectEnabled={bulkSelectEnabled}
              selectedFlatRows={selectedFlatRows}
              toggleRowSelected={(rowId, value) => {
                const row = rows.find(r => r.id === rowId);
                if (row) {
                  prepareRow(row);
                  row.toggleRowSelected(value);
                }
              }}
              toggleAllRowsSelected={toggleAllRowsSelected}
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={count}
              onPageChange={newPageIndex => {
                gotoPage(newPageIndex);
              }}
            />
          )}
          {!loading && rows.length === 0 && (
            <EmptyWrapper className={viewMode} data-test="empty-state">
              {query.filters ? (
                <EmptyState
                  title={t('No results match your filter criteria')}
                  description={t('Try different criteria to display results.')}
                  size="large"
                  image="filter-results.svg"
                  buttonAction={() => handleClearFilterControls()}
                  buttonText={t('clear all filters')}
                />
              ) : (
                <EmptyState
                  {...emptyState}
                  title={emptyState?.title || t('No Data')}
                  size="large"
                  image={emptyState?.image || 'filter-results.svg'}
                />
              )}
            </EmptyWrapper>
          )}
        </div>
      </div>
    </ListViewStyles>
  );
}

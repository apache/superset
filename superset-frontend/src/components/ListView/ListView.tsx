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
import { handleKeyboardActivation } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { styled } from '@apache-superset/core/theme';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import cx from 'classnames';
import TableCollection from '@superset-ui/core/components/TableCollection';
import BulkTagModal from 'src/features/tags/BulkTagModal';
import {
  Button,
  Tooltip,
  Icons,
  EmptyState,
  Loading,
  Pagination,
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
        align-items: center;
        padding-bottom: ${theme.sizeUnit * 4}px;

        & .controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          column-gap: ${theme.sizeUnit * 2}px;
          row-gap: ${theme.sizeUnit * 2}px;

          /* Search input — fixed width/height matching pill height, label hidden */
          [data-test='search-filter-container'] {
            width: ${theme.sizeUnit * 44}px;
            flex-shrink: 0;
            height: ${theme.controlHeight}px;
            align-self: center;
            /* Hide the FormLabel Flex wrapper entirely so it doesn't affect
               the column's justify-content centering calculation. */
            > .ant-flex {
              display: none;
            }
            label {
              display: none;
            }
            .ant-input-affix-wrapper {
              width: 100%;
              height: 100%;
            }
          }

          /* Select filter pill wrappers — make them proper flex items so the
             inline-flex button inside doesn't introduce line-box quirks. */
          [data-test='select-filter-container'] {
            display: flex;
            align-items: center;
            align-self: center;
          }
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
      text-align: center;
    }
  `}
`;

const FullPageLoadingWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    padding: ${theme.sizeUnit * 16}px;
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
      display: inline-flex;
      vertical-align: middle;
      position: relative;
    }

    .ant-alert-close-icon {
      margin-top: ${theme.sizeUnit * 1.5}px;
    }
  `}
`;

const ViewModeContainer = styled.div`
  ${({ theme }) => `
    padding-right: ${theme.sizeUnit * 4}px;
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

const ClearAllButton = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    padding: 0 ${theme.sizeUnit}px;
    color: ${theme.colorPrimary};
    font-size: ${theme.fontSizeSM}px;
    cursor: pointer;
    white-space: nowrap;
    line-height: ${theme.controlHeight}px;

    &:hover:not(:disabled) {
      color: ${theme.colorPrimaryHover};
      text-decoration: underline;
    }

    &:disabled {
      color: ${theme.colorTextDisabled};
      cursor: not-allowed;
    }
  `}
`;

const EmptyWrapper = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 40}px 0;
    width: 100%;

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
    <Tooltip title={t('Grid view')}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={mode === 'card'}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.blur();
          setMode('card');
        }}
        onKeyDown={handleKeyboardActivation(() => setMode('card'))}
        className={cx('toggle-button', { active: mode === 'card' })}
      >
        <Icons.AppstoreOutlined iconSize="xl" />
      </div>
    </Tooltip>
    <Tooltip title={t('List view')}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={mode === 'table'}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.blur();
          setMode('table');
        }}
        onKeyDown={handleKeyboardActivation(() => setMode('table'))}
        className={cx('toggle-button', { active: mode === 'table' })}
      >
        <Icons.UnorderedListOutlined iconSize="xl" />
      </div>
    </Tooltip>
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
    hidden?: (rows: any[]) => boolean;
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
  /** Optional ref exposed to callers for programmatic filter control. */
  filtersRef?: React.RefObject<{
    clearFilters: () => void;
    clearFilterById: (id: string) => void;
  }>;
  /** Optional expandable row configuration, passed through to antd Table. */
  expandable?: Record<string, unknown>;
  /** Content rendered between the filter bar and the table/card body. */
  headerContent?: ReactNode;
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
  filtersRef,
  expandable,
  headerContent,
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

  const filterControlsRef = useRef<{
    clearFilters: () => void;
    clearFilterById: (id: string) => void;
  }>(null);

  const hasActiveFilters = internalFilters.some(f => {
    if (f.value === null || f.value === undefined || f.value === '')
      return false;
    if (Array.isArray(f.value))
      return f.value.some(v => v !== null && v !== undefined && v !== '');
    return true;
  });

  // Wire the optional external filtersRef to our internal filterControlsRef.
  // useLayoutEffect fires synchronously after DOM mutations, guaranteeing the
  // ref is populated before the first paint and after every update.
  useLayoutEffect(() => {
    if (filtersRef) {
      (
        filtersRef as React.MutableRefObject<typeof filterControlsRef.current>
      ).current = filterControlsRef.current;
    }
  });

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
            {filterable && (
              <Tooltip
                title={!hasActiveFilters ? t('No filters applied') : undefined}
              >
                <span>
                  <ClearAllButton
                    type="button"
                    disabled={!hasActiveFilters}
                    onClick={() => filterControlsRef.current?.clearFilters()}
                  >
                    {t('Clear all')}
                  </ClearAllButton>
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        {headerContent}
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
                        onKeyDown={handleKeyboardActivation(() =>
                          toggleAllRowsSelected(false),
                        )}
                      >
                        {t('Deselect all')}
                      </span>
                      <div className="divider" />
                      {bulkActions
                        .filter(
                          action =>
                            !action.hidden?.(
                              selectedFlatRows.map((r: any) => r.original),
                            ),
                        )
                        .map(action => (
                          <Button
                            data-test="bulk-select-action"
                            data-test-action-key={action.key}
                            key={action.key}
                            buttonStyle={action.type}
                            cta
                            onClick={() =>
                              action.onSelect(
                                selectedFlatRows.map((r: any) => r.original),
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
                          onKeyDown={handleKeyboardActivation(() =>
                            setShowBulkTagModal(true),
                          )}
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
            <>
              <CardCollection
                bulkSelectEnabled={bulkSelectEnabled}
                prepareRow={prepareRow}
                renderCard={renderCard}
                rows={rows}
                loading={loading}
                showThumbnails={showThumbnails}
              />
              {count > 0 && (
                <div className="pagination-container">
                  <Pagination
                    current={pageIndex + 1}
                    pageSize={pageSize}
                    total={count}
                    onChange={(page: number) => {
                      gotoPage(page - 1);
                    }}
                    showSizeChanger={false}
                    showQuickJumper={false}
                    hideOnSinglePage
                    align="center"
                  />
                  <div className="row-count-container">
                    {`${pageIndex * pageSize + 1}-${Math.min(
                      (pageIndex + 1) * pageSize,
                      count,
                    )} of ${count}`}
                  </div>
                </div>
              )}
            </>
          )}
          {viewMode === 'table' && (
            <>
              {loading && rows.length === 0 ? (
                <FullPageLoadingWrapper>
                  <Loading />
                </FullPageLoadingWrapper>
              ) : (
                <TableCollection
                  getTableProps={getTableProps}
                  getTableBodyProps={getTableBodyProps}
                  prepareRow={prepareRow}
                  headerGroups={headerGroups}
                  setSortBy={setSortBy}
                  rows={rows}
                  columns={columns}
                  loading={loading && rows.length > 0}
                  highlightRowId={highlightRowId}
                  columnsForWrapText={columnsForWrapText}
                  expandable={expandable}
                  bulkSelectEnabled={bulkSelectEnabled}
                  selectedFlatRows={selectedFlatRows}
                  toggleRowSelected={(rowId, value) => {
                    const row = rows.find((r: any) => r.id === rowId);
                    if (row) {
                      prepareRow(row);
                      (row as any).toggleRowSelected(value);
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
            </>
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
                  buttonText={t('Clear all filters')}
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

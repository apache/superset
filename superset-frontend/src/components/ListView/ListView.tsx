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
import { t } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { ActionType } from '@ant-design/pro-components';
import cx from 'classnames';
import BulkTagModal from 'src/features/tags/BulkTagModal';

import { ProTable, type ProColumns } from '@ant-design/pro-components';
/* eslint-disable no-restricted-imports */
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
/* eslint-enable no-restricted-imports */

import {
  Button,
  Icons,
  EmptyState,
  Loading,
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
import { ListViewError } from './utils';
import { useProTableState } from './useProTableState';

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

// Column size mapping for ProTable
const COLUMN_SIZE_MAP: Record<string, number> = {
  xs: 25,
  sm: 50,
  md: 75,
  lg: 100,
  xl: 150,
  xxl: 200,
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
  // Pro Table action ref for programmatic control
  const actionRef = useRef<ActionType>();

  // Use the simplified Pro Table state hook (no react-table dependency)
  const {
    pageIndex,
    pageSize,
    pageCount,
    gotoPage,
    sortBy,
    setSortBy,
    internalFilters,
    applyFilterValue,
    viewMode,
    setViewMode,
    selectedRowKeys,
    setSelectedRowKeys,
    selectedRows,
    toggleAllRowsSelected,
    query,
  } = useProTableState({
    fetchData,
    data,
    count,
    initialPageSize,
    initialSort,
    initialFilters: filters,
    renderCard: Boolean(renderCard),
    defaultViewMode,
  });

  const allowBulkTagActions = bulkTagResourceName && enableBulkTag;
  const filterable = Boolean(filters.length);

  // Convert columns directly to ProColumns format (no react-table mapping)
  const proColumns = useMemo<ProColumns<T & { _rowKey: string }>[]>(() => {
    const currentSort = sortBy[0];
    return columns.map(col => {
      const dataIndex = col.accessor || col.id;
      return {
        title: col.Header,
        dataIndex: dataIndex?.includes('.') ? dataIndex.split('.') : dataIndex,
        key: col.id,
        hidden: col.hidden,
        width: col.size ? COLUMN_SIZE_MAP[col.size] : undefined,
        ellipsis: !columnsForWrapText?.includes(col.id),
        sorter: !col.disableSortBy,
        defaultSortOrder:
          currentSort?.id === col.id
            ? currentSort.desc
              ? 'descend'
              : 'ascend'
            : undefined,
        className: col.className,
        render: col.Cell
          ? (_: unknown, record: T & { _rowKey: string }) =>
              col.Cell({
                value: dataIndex
                  ? (Array.isArray(dataIndex) ? dataIndex : dataIndex.split('.')).reduce(
                      (obj: any, key: string) => obj?.[key],
                      record,
                    )
                  : undefined,
                row: { original: record, id: record._rowKey },
              })
          : undefined,
      };
    });
  }, [columns, sortBy, columnsForWrapText]);

  // Add row keys to data for selection and identification
  // Use row.id if available for stable selection across pagination, fallback to index
  const dataWithKeys = useMemo(
    () =>
      data.map((row, index) => ({
        ...row,
        _rowKey: String((row as { id?: number | string }).id ?? index),
      })),
    [data],
  );

  // Validate filter config
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

  // Row selection config for Pro Table
  const rowSelection = useMemo(
    () =>
      bulkSelectEnabled
        ? {
            selectedRowKeys,
            onChange: (keys: React.Key[]) => {
              setSelectedRowKeys(keys as string[]);
            },
          }
        : undefined,
    [bulkSelectEnabled, selectedRowKeys, setSelectedRowKeys],
  );

  // Pro Table pagination config
  const paginationConfig = useMemo(() => {
    if (count === 0) return false;
    return {
      current: pageIndex + 1,
      pageSize,
      total: count,
      showSizeChanger: false,
      showQuickJumper: false,
      onChange: (page: number) => {
        gotoPage(Math.max(0, page - 1));
      },
    };
  }, [count, gotoPage, pageIndex, pageSize]);

  // Handle Pro Table sorting
  const handleTableChange = useCallback(
    (_pagination: unknown, _filters: unknown, sorter: unknown) => {
      const normalizedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const sorterObj = normalizedSorter as
        | { field?: string | string[] | number; order?: string }
        | undefined;
      if (sorterObj?.field) {
        const fieldId = Array.isArray(sorterObj.field)
          ? sorterObj.field.join('.')
          : String(sorterObj.field);
        setSortBy([
          {
            id: fieldId,
            desc: sorterObj.order === 'descend',
          },
        ]);
      }
    },
    [setSortBy],
  );

  // Clear selections when bulk select is disabled
  useEffect(() => {
    if (!bulkSelectEnabled) {
      setSelectedRowKeys([]);
    }
  }, [bulkSelectEnabled, setSelectedRowKeys]);

  // Reset to first page if current page is invalid
  useEffect(() => {
    if (!loading && pageIndex > pageCount - 1 && pageCount > 0) {
      gotoPage(0);
    }
  }, [gotoPage, loading, pageCount, pageIndex]);

  // For CardCollection compatibility - create row objects with selection methods
  // Uses row._rowKey which is based on row.id when available
  const cardRows = useMemo(
    () =>
      dataWithKeys.map(row => {
        const rowKey = row._rowKey;
        return {
          id: rowKey,
          original: row,
          isSelected: selectedRowKeys.includes(rowKey),
          toggleRowSelected: (value?: boolean) => {
            const newKeys =
              value ?? !selectedRowKeys.includes(rowKey)
                ? [...selectedRowKeys, rowKey]
                : selectedRowKeys.filter(k => k !== rowKey);
            setSelectedRowKeys(newKeys);
          },
        };
      }),
    [dataWithKeys, selectedRowKeys, setSelectedRowKeys],
  );

  return (
    <ListViewStyles>
      {allowBulkTagActions && (
        <BulkTagModal
          show={showBulkTagModal}
          selected={cardRows}
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
        <div className={`body ${dataWithKeys.length === 0 ? 'empty' : ''} `}>
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
                    {renderBulkSelectCopy(selectedRows)}
                  </div>
                  {Boolean(selectedRows.length) && (
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
                          onClick={() => action.onSelect(selectedRows)}
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
              prepareRow={() => {}}
              renderCard={renderCard}
              rows={cardRows as never}
              loading={loading}
              showThumbnails={showThumbnails}
            />
          )}
          {viewMode === 'table' && (
            <>
              {loading && dataWithKeys.length === 0 ? (
                <FullPageLoadingWrapper>
                  <Loading />
                </FullPageLoadingWrapper>
              ) : (
                <ConfigProvider locale={enUS}>
                  <ProTable
                    data-test="listview-table"
                    actionRef={actionRef}
                    columns={proColumns as ProColumns[]}
                    dataSource={dataWithKeys}
                    loading={loading && dataWithKeys.length > 0}
                    search={false}
                    options={false}
                    rowKey="_rowKey"
                    rowSelection={rowSelection}
                    pagination={paginationConfig}
                    locale={{ emptyText: null }}
                    onChange={handleTableChange}
                    tableAlertRender={false}
                    toolBarRender={false}
                    scroll={{ x: 'max-content' }}
                    sortDirections={['ascend', 'descend']}
                    rowClassName={record =>
                      (record as T & { id?: number }).id === highlightRowId
                        ? 'table-row-highlighted'
                        : ''
                    }
                    components={{
                      header: {
                        cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                          <th {...props} data-test="sort-header" role="columnheader" />
                        ),
                      },
                      body: {
                        row: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
                          <tr {...props} data-test="table-row" />
                        ),
                      },
                    }}
                  />
                </ConfigProvider>
              )}
            </>
          )}
          {!loading && dataWithKeys.length === 0 && (
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
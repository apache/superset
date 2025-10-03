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
import { useCallback, useMemo } from 'react';
import {
  DataRecord,
  DataRecordValue,
  getTimeFormatterForGranularity,
  t,
} from '@superset-ui/core';
import { isEmpty } from 'lodash';
import { DataColumnMeta, TableChartTransformedProps } from '../types';
import DataTable, { DataTableProps } from '../DataTable';
import Styles from '../Styles';
import {
  getHeaderColumns,
  getNoResultsMessage,
  getColumnAlignment,
} from './utils';
import {
  SearchInput,
  SelectPageSize,
  SortIcon,
  TimeComparisonDropdown,
  GroupingHeaders,
} from './components';
import {
  useCrossFilters,
  useTimeComparison,
  useTableResize,
  useColumnConfigs,
  useValueRanges,
  useContextMenu,
  useServerPaginationHandlers,
  useSearchOptions,
  usePageSizeOptions,
} from './hooks';

export default function TableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
  },
) {
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: columnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    sortDesc = false,
    filters,
    sticky = true,
    columnColorFormatters,
    allowRearrangeColumns = false,
    allowRenderHtml = true,
    onContextMenu,
    emitCrossFilters,
    isUsingTimeComparison,
    basicColorFormatters,
    basicColorColumnFormatters,
    hasServerPageLengthChanged,
    serverPageLength,
    slice_id,
  } = props;

  // Define comparison labels once to avoid duplication
  const comparisonLabels = useMemo(() => [t('Main'), '#', '△', '%'], []);

  const comparisonColumns = useMemo(
    () => [
      { key: 'all', label: t('Display all') },
      { key: '#', label: '#' },
      { key: '△', label: '△' },
      { key: '%', label: '%' },
    ],
    [],
  );

  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );

  const { tableSize } = useTableResize({ width, height });

  const {
    showComparisonDropdown,
    setShowComparisonDropdown,
    selectedComparisonColumns,
    setSelectedComparisonColumns,
    hideComparisonKeys,
    setHideComparisonKeys,
    filteredColumnsMeta,
  } = useTimeComparison({
    columnsMeta,
    isUsingTimeComparison,
    comparisonLabels,
    comparisonColumns,
  });

  const { isActiveFilterValue, getCrossFilterDataMask, toggleFilter } =
    useCrossFilters({
      filters,
      timestampFormatter,
      timeGrain,
    });

  const pageSizeOptions = usePageSizeOptions({
    serverPagination,
    dataLength: data.length,
    rowCount,
  });

  const { getValueRange } = useValueRanges(data, filteredColumnsMeta);

  const handleToggleFilter = useCallback(
    function handleToggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      toggleFilter(key, val, setDataMask);
    },
    [emitCrossFilters, toggleFilter, setDataMask],
  );

  const getSharedStyle = useCallback(
    (column: DataColumnMeta) =>
      getColumnAlignment(column, isUsingTimeComparison ?? false),
    [isUsingTimeComparison],
  );

  const handleContextMenu = useContextMenu<D>({
    onContextMenu,
    isRawRecords: isRawRecords ?? false,
    filteredColumnsMeta,
    getCrossFilterDataMask,
  });

  const groupHeaderColumns = useMemo(
    () =>
      getHeaderColumns(
        filteredColumnsMeta,
        comparisonLabels,
        isUsingTimeComparison,
      ),
    [filteredColumnsMeta, comparisonLabels, isUsingTimeComparison],
  );

  const getColumnConfigs = useColumnConfigs<D>({
    defaultAlignPN,
    defaultColorPN,
    emitCrossFilters,
    getValueRange,
    isActiveFilterValue,
    isRawRecords,
    showCellBars,
    sortDesc,
    totals,
    columnColorFormatters,
    allowRearrangeColumns,
    allowRenderHtml,
    basicColorColumnFormatters,
    basicColorFormatters,
    comparisonLabels,
    getSharedStyle,
    groupHeaderColumns,
    handleContextMenu,
    handleToggleFilter,
    isUsingTimeComparison,
    SortIcon,
  });

  const visibleColumnsMeta = useMemo(
    () => filteredColumnsMeta.filter(col => col.config?.visible !== false),
    [filteredColumnsMeta],
  );

  const columns = useMemo(
    () => visibleColumnsMeta.map(getColumnConfigs),
    [visibleColumnsMeta, getColumnConfigs],
  );

  const searchOptions = useSearchOptions(
    columns as any, // Type assertion needed due to react-table types
  );

  const {
    handleServerPaginationChange,
    handleSortByChange,
    debouncedSearch,
    handleChangeSearchCol,
  } = useServerPaginationHandlers({
    serverPagination,
    serverPaginationData,
    serverPageLength,
    hasServerPageLengthChanged,
    searchOptions,
    setDataMask,
  });

  const { width: widthFromState, height: heightFromState } = tableSize;

  const renderGroupingHeaders = useMemo(
    () =>
      !isEmpty(groupHeaderColumns)
        ? () => (
            <GroupingHeaders
              groupHeaderColumns={groupHeaderColumns}
              filteredColumnsMeta={filteredColumnsMeta}
              columnsMeta={columnsMeta}
              hideComparisonKeys={hideComparisonKeys}
              onHideComparisonKeysChange={setHideComparisonKeys}
            />
          )
        : undefined,
    [
      groupHeaderColumns,
      filteredColumnsMeta,
      columnsMeta,
      hideComparisonKeys,
      setHideComparisonKeys,
    ],
  );

  const renderTimeComparisonDropdown = useMemo(
    () =>
      isUsingTimeComparison
        ? () => (
            <TimeComparisonDropdown
              comparisonColumns={comparisonColumns}
              selectedComparisonColumns={selectedComparisonColumns}
              onSelectedColumnsChange={setSelectedComparisonColumns}
              isOpen={showComparisonDropdown}
              onOpenChange={setShowComparisonDropdown}
            />
          )
        : undefined,
    [
      isUsingTimeComparison,
      comparisonColumns,
      selectedComparisonColumns,
      setSelectedComparisonColumns,
      showComparisonDropdown,
      setShowComparisonDropdown,
    ],
  );

  const sortByFromParent = useMemo(
    () => serverPaginationData?.sortBy || [],
    [serverPaginationData?.sortBy],
  );

  const searchInputId = useMemo(() => `${slice_id}-search`, [slice_id]);

  return (
    <Styles>
      <DataTable<D>
        columns={columns}
        data={data}
        rowCount={rowCount}
        tableClassName="table table-striped table-condensed"
        pageSize={pageSize}
        serverPaginationData={serverPaginationData}
        pageSizeOptions={pageSizeOptions}
        width={widthFromState}
        height={heightFromState}
        serverPagination={serverPagination}
        onServerPaginationChange={handleServerPaginationChange}
        initialSearchText={serverPaginationData?.searchText || ''}
        sortByFromParent={sortByFromParent}
        searchInputId={searchInputId}
        maxPageItemCount={width > 340 ? 9 : 7}
        noResults={getNoResultsMessage}
        searchInput={includeSearch && SearchInput}
        selectPageSize={pageSize !== null && SelectPageSize}
        sticky={sticky}
        renderGroupingHeaders={renderGroupingHeaders}
        renderTimeComparisonDropdown={renderTimeComparisonDropdown}
        handleSortByChange={handleSortByChange}
        onSearchColChange={handleChangeSearchCol}
        manualSearch={serverPagination}
        onSearchChange={debouncedSearch}
        searchOptions={searchOptions}
      />
    </Styles>
  );
}

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
import { t } from '@apache-superset/core';
import {
  DataRecord,
  DataRecordValue,
  getTimeFormatterForGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { isEqual } from 'lodash';

import {
  CellClickedEvent,
  IMenuActionParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import {
  AgGridTableChartTransformedProps,
  InputColumn,
  SearchOption,
  SortByItem,
} from './types';
import AgGridDataTable from './AgGridTable';
import { updateTableOwnState } from './utils/externalAPIs';
import TimeComparisonVisibility from './AgGridTable/components/TimeComparisonVisibility';
import { useColDefs } from './utils/useColDefs';
import { getCrossFilterDataMask } from './utils/getCrossFilterDataMask';
import { StyledChartContainer } from './styles';
import type { FilterState } from './utils/filterStateManager';

const getGridHeight = (height: number, includeSearch: boolean | undefined) => {
  let calculatedGridHeight = height;
  if (includeSearch) {
    calculatedGridHeight -= 16;
  }
  return calculatedGridHeight - 80;
};

export default function TableChart<D extends DataRecord = DataRecord>(
  props: AgGridTableChartTransformedProps<D> & {},
) {
  const {
    height,
    columns,
    data,
    includeSearch,
    allowRearrangeColumns,
    pageSize,
    serverPagination,
    rowCount,
    setDataMask,
    serverPaginationData,
    slice_id,
    percentMetrics,
    hasServerPageLengthChanged,
    serverPageLength,
    emitCrossFilters,
    filters,
    timeGrain,
    isRawRecords,
    alignPositiveNegative,
    showCellBars,
    isUsingTimeComparison,
    colorPositiveNegative,
    totals,
    showTotals,
    columnColorFormatters,
    basicColorFormatters,
    width,
    onChartStateChange,
    chartState,
  } = props;

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);

  // Extract metric column names for SQL conversion
  const metricColumns = useMemo(
    () =>
      columns
        .filter(col => col.isMetric || col.isPercentMetric)
        .map(col => col.key),
    [columns],
  );

  useEffect(() => {
    const options = columns
      .filter(col => col?.dataType === GenericDataType.String)
      .map(column => ({
        value: column.key,
        label: column.label,
      }));

    if (!isEqual(options, searchOptions)) {
      setSearchOptions(options || []);
    }
  }, [columns]);

  useEffect(() => {
    if (!serverPagination || !serverPaginationData || !rowCount) return;

    const currentPage = serverPaginationData.currentPage ?? 0;
    const currentPageSize = serverPaginationData.pageSize ?? serverPageLength;
    const totalPages = Math.ceil(rowCount / currentPageSize);

    if (currentPage >= totalPages && totalPages > 0) {
      const validPage = Math.max(0, totalPages - 1);
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: validPage,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  }, [
    rowCount,
    serverPagination,
    serverPaginationData,
    serverPageLength,
    setDataMask,
  ]);

  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];

  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns?.[0]?.key,
  ]);

  const handleColumnStateChange = useCallback(
    agGridState => {
      if (onChartStateChange) {
        onChartStateChange(agGridState);
      }
    },
    [onChartStateChange],
  );

  const handleFilterChanged = useCallback(
    (completeFilterState: FilterState) => {
      if (!serverPagination) return;
      // Sync chartState immediately with the new filter model to prevent stale state
      // This ensures chartState and ownState are in sync
      if (onChartStateChange && chartState) {
        const filterModel =
          completeFilterState.originalFilterModel &&
          Object.keys(completeFilterState.originalFilterModel).length > 0
            ? completeFilterState.originalFilterModel
            : undefined;
        const updatedChartState = {
          ...chartState,
          filterModel,
          timestamp: Date.now(),
        };
        onChartStateChange(updatedChartState);
      }

      // Prepare modified own state for server pagination
      const modifiedOwnState = {
        ...serverPaginationData,
        agGridFilterModel:
          completeFilterState.originalFilterModel &&
          Object.keys(completeFilterState.originalFilterModel).length > 0
            ? completeFilterState.originalFilterModel
            : undefined,
        agGridSimpleFilters: completeFilterState.simpleFilters,
        agGridComplexWhere: completeFilterState.complexWhere,
        agGridHavingClause: completeFilterState.havingClause,
        lastFilteredColumn: completeFilterState.lastFilteredColumn,
        lastFilteredInputPosition: completeFilterState.inputPosition,
        currentPage: 0, // Reset to first page when filtering
      };

      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [
      setDataMask,
      serverPagination,
      serverPaginationData,
      onChartStateChange,
      chartState,
    ],
  );

  const filteredColumns = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columns;
    }
    if (
      selectedComparisonColumns.length === 0 ||
      selectedComparisonColumns.includes('all')
    ) {
      return columns?.filter(col => col?.config?.visible !== false);
    }

    return columns
      .filter(
        col =>
          !col.originalLabel ||
          (col?.label || '').includes('Main') ||
          selectedComparisonColumns.includes(col.label),
      )
      .filter(col => col?.config?.visible !== false);
  }, [columns, selectedComparisonColumns]);

  const colDefs = useColDefs({
    columns: isUsingTimeComparison
      ? (filteredColumns as InputColumn[])
      : (columns as InputColumn[]),
    data,
    serverPagination,
    isRawRecords,
    defaultAlignPN: alignPositiveNegative,
    showCellBars,
    colorPositiveNegative,
    totals,
    columnColorFormatters,
    allowRearrangeColumns,
    basicColorFormatters,
    isUsingTimeComparison,
    emitCrossFilters,
    alignPositiveNegative,
    slice_id,
  });

  const gridHeight = getGridHeight(height, includeSearch);

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const timestampFormatter = useCallback(
    (value: DataRecordValue) =>
      isRawRecords
        ? String(value ?? '')
        : getTimeFormatterForGranularity(timeGrain)(
            value as number | Date | null | undefined,
          ),
    [timeGrain, isRawRecords],
  );

  const toggleFilter = useCallback(
    (event: CellClickedEvent | IMenuActionParams) => {
      if (
        emitCrossFilters &&
        event.column &&
        !(
          event.column.getColDef().context?.isMetric ||
          event.column.getColDef().context?.isPercentMetric
        )
      ) {
        const crossFilterProps = {
          key: event.column.getColId(),
          value: event.value,
          filters,
          timeGrain,
          isActiveFilterValue,
          timestampFormatter,
        };
        setDataMask(getCrossFilterDataMask(crossFilterProps).dataMask);
      }
    },
    [
      emitCrossFilters,
      setDataMask,
      filters,
      timeGrain,
      isActiveFilterValue,
      timestampFormatter,
    ],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
        lastFilteredColumn: undefined,
        lastFilteredInputPosition: undefined,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize,
        lastFilteredColumn: undefined,
        lastFilteredInputPosition: undefined,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn: searchCol,
        searchText: '',
        lastFilteredColumn: undefined,
        lastFilteredInputPosition: undefined,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const handleSearch = useCallback(
    (searchText: string) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0, // Reset to first page when searching
        lastFilteredColumn: undefined,
        lastFilteredInputPosition: undefined,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, searchOptions],
  );

  const handleSortByChange = useCallback(
    (sortBy: SortByItem[]) => {
      if (!serverPagination) return;
      const modifiedOwnState = {
        ...serverPaginationData,
        sortBy,
        lastFilteredColumn: undefined,
        lastFilteredInputPosition: undefined,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPagination],
  );

  const renderTimeComparisonVisibility = (): JSX.Element => (
    <TimeComparisonVisibility
      comparisonColumns={comparisonColumns}
      selectedComparisonColumns={selectedComparisonColumns}
      onSelectionChange={setSelectedComparisonColumns}
    />
  );

  return (
    <StyledChartContainer height={height}>
      <AgGridDataTable
        gridHeight={gridHeight}
        data={data || []}
        colDefsFromProps={colDefs}
        includeSearch={!!includeSearch}
        allowRearrangeColumns={!!allowRearrangeColumns}
        pagination={!!pageSize && !serverPagination}
        pageSize={pageSize || 0}
        serverPagination={serverPagination}
        rowCount={rowCount}
        onServerPaginationChange={handleServerPaginationChange}
        onServerPageSizeChange={handlePageSizeChange}
        serverPaginationData={serverPaginationData}
        searchOptions={searchOptions}
        onSearchColChange={handleChangeSearchCol}
        onSearchChange={handleSearch}
        onSortChange={handleSortByChange}
        onFilterChanged={handleFilterChanged}
        metricColumns={metricColumns}
        id={slice_id}
        handleCrossFilter={toggleFilter}
        percentMetrics={percentMetrics}
        serverPageLength={serverPageLength}
        hasServerPageLengthChanged={hasServerPageLengthChanged}
        isActiveFilterValue={isActiveFilterValue}
        renderTimeComparisonDropdown={
          isUsingTimeComparison ? renderTimeComparisonVisibility : () => null
        }
        cleanedTotals={totals || {}}
        showTotals={showTotals}
        width={width}
        onColumnStateChange={handleColumnStateChange}
        chartState={chartState}
      />
    </StyledChartContainer>
  );
}

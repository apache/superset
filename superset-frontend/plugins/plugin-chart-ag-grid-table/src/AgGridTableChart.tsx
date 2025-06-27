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
import {
  css,
  DataRecord,
  DataRecordValue,
  GenericDataType,
  getTimeFormatterForGranularity,
  styled,
  t,
} from '@superset-ui/core';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { isEqual } from 'lodash';

import { CellClickedEvent, IMenuActionParams } from 'ag-grid-community';
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
import { useIsDark } from './utils/useTableTheme';

const getGridHeight = (height: number, includeSearch: boolean | undefined) => {
  let calculatedGridHeight = height;
  if (includeSearch) {
    calculatedGridHeight -= 16;
  }
  return calculatedGridHeight - 80;
};

const StyledChartContainer = styled.div<{
  height: number;
  inputTextColor: string;
}>`
  ${({ theme, height, inputTextColor }) => css`
    height: ${height}px;

    .dt-is-filter {
      cursor: pointer;
    }

    .dt-is-active-filter {
      background: ${theme.colors.primary.light3};
    }

    .dt-truncate-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dt-truncate-cell:hover {
      overflow: visible;
      white-space: normal;
      height: auto;
    }

    .ag-container {
      border-radius: 0px;
      border: var(--ag-wrapper-border);
    }

    .filter-popover {
      z-index: 1 !important;
    }

    .search-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${theme.sizeUnit * 4}px;
    }

    .dropdown-controls-container {
      display: flex;
      justify-content: flex-end;
    }

    .time-comparison-dropdown {
      display: flex;
      padding-right: ${theme.sizeUnit * 4}px;
      padding-top: ${theme.sizeUnit * 1.75}px;
    }

    .ag-header,
    .ag-row,
    .ag-spanned-row {
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
    }

    .ag-root-wrapper {
      border-radius: 0px;
    }
    .search-by-text-container {
      display: flex;
      align-items: center;
    }

    .search-by-text {
      margin-right: ${theme.sizeUnit * 2}px;
    }

    .ant-popover-inner {
      padding: 0px;
    }

    .input-container {
      margin-left: auto;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      overflow: visible;
    }

    .input-wrapper svg {
      pointer-events: none;
      transform: translate(${theme.sizeUnit * 7}px, ${theme.sizeUnit / 2}px);
      color: ${theme.colors.grayscale.base};
    }

    .input-wrapper input {
      color: ${inputTextColor};
      font-size: ${theme.fontSizeSM}px;
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 3}px
        ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 8}px;
      line-height: 1.8;
      border-radius: ${theme.borderRadius}px;
      border: 1px solid ${theme.colors.grayscale.light2};
      background-color: transparent;
      outline: none;

      &:focus {
        border-color: ${theme.colors.primary.base};
      }

      &::placeholder {
        color: ${theme.colors.grayscale.light1};
      }
    }
  `}
`;

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
  } = props;

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);
  const inputTextColor = useIsDark() ? '#FFFFFF' : '#000000';

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

  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];

  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns?.[0]?.key,
  ]);

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
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
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
    [emitCrossFilters, setDataMask, filters, timeGrain],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
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
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn: searchCol,
        searchText: '',
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const handleSearch = useCallback(
    (searchText: string) => {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0, // Reset to first page when searching
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
    <StyledChartContainer inputTextColor={inputTextColor} height={height}>
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
      />
    </StyledChartContainer>
  );
}

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
import React, { CSSProperties, useCallback, useMemo, useState } from 'react';
import { ColumnInstance, ColumnWithLooseAccessor, DefaultSortTypes } from 'react-table';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import { FaSort, FaSortDown as FaSortDesc, FaSortUp as FaSortAsc } from 'react-icons/fa';
import { DataRecord, DataRecordValue, GenericDataType, t, tn } from '@superset-ui/core';

import { DataColumnMeta, TableChartTransformedProps } from './types';
import DataTable, {
  DataTableProps,
  SearchInputProps,
  SelectPageSizeRendererProps,
  SizeOption,
} from './DataTable';

import Styles from './Styles';
import { formatColumnValue } from './utils/formatValue';
import { PAGE_SIZE_OPTIONS } from './consts';
import { updateExternalFormData } from './DataTable/utils/externalAPIs';

type ValueRange = [number, number];

/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType: GenericDataType): DefaultSortTypes {
  if (dataType === GenericDataType.TEMPORAL) {
    return 'datetime';
  }
  if (dataType === GenericDataType.STRING) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Cell background to render columns as horizontal bar chart
 */
function cellBar({
  value,
  valueRange,
  colorPositiveNegative = false,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  colorPositiveNegative: boolean;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    // The 0.01 to 0.001 is a workaround for what appears to be a
    // CSS rendering bug on flat, transparent colors
    return (
      `linear-gradient(to right, rgba(${r},0,0,0.2), rgba(${r},0,0,0.2) ${perc}%, ` +
      `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`
    );
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc1 = Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  // The 0.01 to 0.001 is a workaround for what appears to be a
  // CSS rendering bug on flat, transparent colors
  return (
    `linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.001) ${perc1}%, ` +
    `rgba(${r},0,0,0.2) ${perc1}%, rgba(${r},0,0,0.2) ${perc1 + perc2}%, ` +
    `rgba(0,0,0,0.01) ${perc1 + perc2}%, rgba(0,0,0,0.001) 100%)`
  );
}

function SortIcon<D extends object>({ column }: { column: ColumnInstance<D> }) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = <FaSort />;
  if (isSorted) {
    sortIcon = isSortedDesc ? <FaSortDesc /> : <FaSortAsc />;
  }
  return sortIcon;
}

function SearchInput({ count, value, onChange }: SearchInputProps) {
  return (
    <span className="dt-global-filter">
      {t('Search')}{' '}
      <input
        className="form-control input-sm"
        placeholder={tn('search.num_records', count)}
        value={value}
        onChange={onChange}
      />
    </span>
  );
}

function SelectPageSize({ options, current, onChange }: SelectPageSizeRendererProps) {
  return (
    <span className="dt-select-page-size form-inline">
      {t('page_size.show')}{' '}
      <select
        className="form-control input-sm"
        value={current}
        onBlur={() => {}}
        onChange={e => {
          onChange(Number((e.target as HTMLSelectElement).value));
        }}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option) ? option : [option, option];
          return (
            <option key={size} value={size}>
              {text}
            </option>
          );
        })}
      </select>{' '}
      {t('page_size.entries')}
    </span>
  );
}

export default function TableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
  },
) {
  const {
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
    emitFilter = false,
    sortDesc = false,
    filters: initialFilters = {},
    sticky = true, // whether to use sticky header
  } = props;

  const [filters, setFilters] = useState(initialFilters);

  const handleChange = useCallback(
    (filters: { [x: string]: DataRecordValue[] }) => {
      if (!emitFilter) {
        return;
      }

      const groupBy = Object.keys(filters);
      const groupByValues = Object.values(filters);
      setDataMask({
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                  const val = filters?.[col];
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value: groupByValues.length ? groupByValues : null,
        },
      });
    },
    [emitFilter, setDataMask],
  );

  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return PAGE_SIZE_OPTIONS.filter(([n]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * data.length,
    ) as SizeOption[];
  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      if (typeof data?.[0]?.[key] === 'number') {
        const nums = data.map(row => row[key]) as number[];
        return (alignPositiveNegative
          ? [0, d3Max(nums.map(Math.abs))]
          : d3Extent(nums)) as ValueRange;
      }
      return null;
    },
    [data],
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      const updatedFilters = { ...(filters || {}) };
      if (filters && isActiveFilterValue(key, val)) {
        updatedFilters[key] = filters[key].filter((x: DataRecordValue) => x !== val);
      } else {
        updatedFilters[key] = [...(filters?.[key] || []), val];
      }
      if (Array.isArray(updatedFilters[key]) && updatedFilters[key].length === 0) {
        delete updatedFilters[key];
      }
      setFilters(updatedFilters);
      handleChange(updatedFilters);
    },
    [filters, handleChange, isActiveFilterValue],
  );

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> => {
      const { key, label, dataType, isMetric, config = {} } = column;
      const isNumber = dataType === GenericDataType.NUMERIC;
      const isFilter = !isNumber && emitFilter;
      const textAlign = config.horizontalAlign
        ? config.horizontalAlign
        : isNumber
        ? 'right'
        : 'left';
      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = {
        textAlign,
      };

      const alignPositiveNegative =
        config.alignPositiveNegative === undefined ? defaultAlignPN : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined ? defaultColorPN : config.colorPositiveNegative;

      const valueRange =
        (config.showCellBars === undefined ? showCellBars : config.showCellBars) &&
        (isMetric || isRawRecords) &&
        getValueRange(key, alignPositiveNegative);

      let className = '';
      if (isFilter) {
        className += ' dt-is-filter';
      }

      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({ value }: { column: ColumnInstance<D>; value: DataRecordValue }) => {
          const [isHtml, text] = formatColumnValue(column, value);
          const html = isHtml ? { __html: text } : undefined;
          const cellProps = {
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick: emitFilter && !valueRange ? () => toggleFilter(key, value) : undefined,
            className: [
              className,
              value == null ? 'dt-is-null' : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
            style: {
              ...sharedStyle,
              background: valueRange
                ? cellBar({
                    value: value as number,
                    valueRange,
                    alignPositiveNegative,
                    colorPositiveNegative,
                  })
                : undefined,
            },
          };
          if (html) {
            // eslint-disable-next-line react/no-danger
            return <td {...cellProps} dangerouslySetInnerHTML={html} />;
          }
          // If cellProps renderes textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
          return <td {...cellProps}>{text}</td>;
        },
        Header: ({ column: col, onClick, style }) => (
          <th
            title="Shift + Click to sort by multiple columns"
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onClick={onClick}
          >
            {/* can't use `columnWidth &&` because it may also be zero */}
            {config.columnWidth ? (
              // column width hint
              <div
                style={{
                  width: columnWidth,
                  height: 0.01,
                }}
              />
            ) : null}
            {label}
            <SortIcon column={col} />
          </th>
        ),
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitFilter,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      toggleFilter,
    ],
  );

  const columns = useMemo(() => columnsMeta.map(getColumnConfigs), [columnsMeta, getColumnConfigs]);

  const handleServerPaginationChange = (pageNumber: number, pageSize: number) => {
    updateExternalFormData(setDataMask, pageNumber, pageSize);
  };

  const totalsFormatted =
    totals &&
    columnsMeta
      .filter(column => Object.keys(totals).includes(column.key))
      .reduce(
        (acc: { value: string; className: string }[], column) => [
          ...acc,
          {
            value: formatColumnValue(column, totals[column.key])[1],
            className: column.dataType === GenericDataType.NUMERIC ? 'dt-metric' : '',
          },
        ],
        [],
      );

  const totalsHeaderSpan =
    totalsFormatted &&
    columnsMeta.filter(column => !column.isPercentMetric).length - totalsFormatted.length;

  return (
    <Styles>
      <DataTable<D>
        columns={columns}
        totals={totalsFormatted}
        totalsHeaderSpan={totalsHeaderSpan}
        data={data}
        rowCount={rowCount}
        tableClassName="table table-striped table-condensed"
        pageSize={pageSize}
        serverPaginationData={serverPaginationData}
        pageSizeOptions={pageSizeOptions}
        height={height}
        serverPagination={serverPagination}
        onServerPaginationChange={handleServerPaginationChange}
        // 9 page items in > 340px works well even for 100+ pages
        maxPageItemCount={width > 340 ? 9 : 7}
        noResults={(filter: string) => t(filter ? 'No matching records found' : 'No records found')}
        searchInput={includeSearch && SearchInput}
        selectPageSize={pageSize !== null && SelectPageSize}
        // not in use in Superset, but needed for unit tests
        sticky={sticky}
      />
    </Styles>
  );
}

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
import React, {
  CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  MouseEvent,
} from 'react';
import {
  ColumnInstance,
  ColumnWithLooseAccessor,
  DefaultSortTypes,
  Row,
} from 'react-table';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';
import cx from 'classnames';
import {
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  GenericDataType,
  getSelectedText,
  getTimeFormatterForGranularity,
  BinaryQueryObjectFilterClause,
  styled,
  css,
  t,
  tn,
} from '@superset-ui/core';

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
import getScrollBarSize from './DataTable/utils/getScrollBarSize';

type ValueRange = [number, number];

interface TableSize {
  width: number;
  height: number;
}

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
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
  value,
  colorPositiveNegative = false,
}: {
  value: number;
  colorPositiveNegative: boolean;
}) {
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  return `rgba(${r},0,0,0.2)`;
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

function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
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
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
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

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

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
    sticky = true, // whether to use sticky header
    columnColorFormatters,
    allowRearrangeColumns = false,
    onContextMenu,
    emitCrossFilters,
  } = props;
  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );
  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });
  // keep track of whether column order changed, so that column widths can too
  const [columnOrderToggle, setColumnOrderToggle] = useState(false);

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
        return (
          alignPositiveNegative
            ? [0, d3Max(nums.map(Math.abs))]
            : d3Extent(nums)
        ) as ValueRange;
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

  const getCrossFilterDataMask = (key: string, value: DataRecordValue) => {
    let updatedFilters = { ...(filters || {}) };
    if (filters && isActiveFilterValue(key, value)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [value],
      };
    }
    if (
      Array.isArray(updatedFilters[key]) &&
      updatedFilters[key].length === 0
    ) {
      delete updatedFilters[key];
    }

    const groupBy = Object.keys(updatedFilters);
    const groupByValues = Object.values(updatedFilters);
    const labelElements: string[] = [];
    groupBy.forEach(col => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(updatedFilters?.[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map(value =>
          isTimestamp ? timestampFormatter(value) : value,
        );
        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });

    return {
      dataMask: {
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                  const val = ensureIsArray(updatedFilters?.[col]);
                  if (!val.length)
                    return {
                      col,
                      op: 'IS NULL' as const,
                    };
                  return {
                    col,
                    op: 'IN' as const,
                    val: val.map(el =>
                      el instanceof Date ? el.getTime() : el!,
                    ),
                    grain: col === DTTM_ALIAS ? timeGrain : undefined,
                  };
                }),
        },
        filterState: {
          label: labelElements.join(', '),
          value: groupByValues.length ? groupByValues : null,
          filters:
            updatedFilters && Object.keys(updatedFilters).length
              ? updatedFilters
              : null,
        },
      },
      isCurrentValueSelected: isActiveFilterValue(key, value),
    };
  };

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = (column: DataColumnMeta): CSSProperties => {
    const { isNumeric, config = {} } = column;
    const textAlign = config.horizontalAlign
      ? config.horizontalAlign
      : isNumeric
      ? 'right'
      : 'left';
    return {
      textAlign,
    };
  };

  const handleContextMenu =
    onContextMenu && !isRawRecords
      ? (
          value: D,
          cellPoint: {
            key: string;
            value: DataRecordValue;
            isMetric?: boolean;
          },
          clientX: number,
          clientY: number,
        ) => {
          const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
          columnsMeta.forEach(col => {
            if (!col.isMetric) {
              const dataRecordValue = value[col.key];
              drillToDetailFilters.push({
                col: col.key,
                op: '==',
                val: dataRecordValue as string | number | boolean,
                formattedVal: formatColumnValue(col, dataRecordValue)[1],
              });
            }
          });
          onContextMenu(clientX, clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter: cellPoint.isMetric
              ? undefined
              : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
            drillBy: cellPoint.isMetric
              ? undefined
              : {
                  filters: [
                    {
                      col: cellPoint.key,
                      op: '==',
                      val: cellPoint.value as string | number | boolean,
                    },
                  ],
                  groupbyFieldName: 'groupby',
                },
          });
        }
      : undefined;

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> => {
      const {
        key,
        label,
        isNumeric,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = getSharedStyle(column);

      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;

      const { truncateLongCells } = config;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const valueRange =
        !hasColumnColorFormatters &&
        (config.showCellBars === undefined
          ? showCellBars
          : config.showCellBars) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(key, alignPositiveNegative);

      let className = '';
      if (emitCrossFilters && !isMetric) {
        className += ' dt-is-filter';
      }

      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({ value, row }: { value: DataRecordValue; row: Row<D> }) => {
          const [isHtml, text] = formatColumnValue(column, value);
          const html = isHtml ? { __html: text } : undefined;

          let backgroundColor;
          if (hasColumnColorFormatters) {
            columnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value || value === 0
                    ? formatter.getColorFromValue(value as number)
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
          }

          const StyledCell = styled.td`
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            background: ${backgroundColor || undefined};
          `;

          const cellBarStyles = css`
            position: absolute;
            height: 100%;
            display: block;
            top: 0;
            ${valueRange &&
            `
                width: ${`${cellWidth({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                left: ${`${cellOffset({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                background-color: ${cellBackground({
                  value: value as number,
                  colorPositiveNegative,
                })};
              `}
          `;

          const cellProps = {
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                    // allow selecting text in a cell
                    if (!getSelectedText()) {
                      toggleFilter(key, value);
                    }
                  }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(
                  row.original,
                  { key, value, isMetric },
                  e.nativeEvent.clientX,
                  e.nativeEvent.clientY,
                );
              }
            },
            className: [
              className,
              value == null ? 'dt-is-null' : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
          };
          if (html) {
            if (truncateLongCells) {
              // eslint-disable-next-line react/no-danger
              return (
                <StyledCell {...cellProps}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? { width: columnWidth } : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </StyledCell>
              );
            }
            // eslint-disable-next-line react/no-danger
            return <StyledCell {...cellProps} dangerouslySetInnerHTML={html} />;
          }
          // If cellProps renders textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
          return (
            <StyledCell {...cellProps}>
              {valueRange && (
                <div
                  /* The following classes are added to support custom CSS styling */
                  className={cx(
                    'cell-bar',
                    value && value < 0 ? 'negative' : 'positive',
                  )}
                  css={cellBarStyles}
                />
              )}
              {truncateLongCells ? (
                <div
                  className="dt-truncate-cell"
                  style={columnWidth ? { width: columnWidth } : undefined}
                >
                  {text}
                </div>
              ) : (
                text
              )}
            </StyledCell>
          );
        },
        Header: ({ column: col, onClick, style, onDragStart, onDrop }) => (
          <th
            title={t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onClick={onClick}
            data-column-name={col.id}
            {...(allowRearrangeColumns && {
              draggable: 'true',
              onDragStart,
              onDragOver: e => e.preventDefault(),
              onDragEnter: e => e.preventDefault(),
              onDrop,
            })}
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
            <div
              data-column-name={col.id}
              css={{
                display: 'inline-flex',
                alignItems: 'flex-end',
              }}
            >
              <span data-column-name={col.id}>{label}</span>
              <SortIcon column={col} />
            </div>
          </th>
        ),
        Footer: totals ? (
          i === 0 ? (
            <th>{t('Totals')}</th>
          ) : (
            <td style={sharedStyle}>
              <strong>{formatColumnValue(column, totals[key])[1]}</strong>
            </td>
          )
        ) : undefined,
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitCrossFilters,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      toggleFilter,
      totals,
      columnColorFormatters,
      columnOrderToggle,
    ],
  );

  const columns = useMemo(
    () => columnsMeta.map(getColumnConfigs),
    [columnsMeta, getColumnConfigs],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      updateExternalFormData(setDataMask, pageNumber, pageSize);
    },
    [setDataMask],
  );

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setTableSize({ width, height });
    },
    [],
  );

  useLayoutEffect(() => {
    // After initial load the table should resize only when the new sizes
    // Are not only scrollbar updates, otherwise, the table would twicth
    const scrollBarSize = getScrollBarSize();
    const { width: tableWidth, height: tableHeight } = tableSize;
    // Table is increasing its original size
    if (
      width - tableWidth > scrollBarSize ||
      height - tableHeight > scrollBarSize
    ) {
      handleSizeChange({
        width: width - scrollBarSize,
        height: height - scrollBarSize,
      });
    } else if (
      tableWidth - width > scrollBarSize ||
      tableHeight - height > scrollBarSize
    ) {
      // Table is decreasing its original size
      handleSizeChange({
        width,
        height,
      });
    }
  }, [width, height, handleSizeChange, tableSize]);

  const { width: widthFromState, height: heightFromState } = tableSize;

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
        onColumnOrderChange={() => setColumnOrderToggle(!columnOrderToggle)}
        // 9 page items in > 340px works well even for 100+ pages
        maxPageItemCount={width > 340 ? 9 : 7}
        noResults={getNoResultsMessage}
        searchInput={includeSearch && SearchInput}
        selectPageSize={pageSize !== null && SelectPageSize}
        // not in use in Superset, but needed for unit tests
        sticky={sticky}
      />
    </Styles>
  );
}

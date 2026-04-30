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
  CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
} from 'react';

import {
  ColumnInstance,
  ColumnWithLooseAccessor,
  DefaultSortTypes,
  Row,
} from 'react-table';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import {
  CaretUpOutlined,
  CaretDownOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import cx from 'classnames';
import {
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  getSelectedText,
  getTimeFormatterForGranularity,
  BinaryQueryObjectFilterClause,
  extractTextFromHTML,
  TimeGranularity,
} from '@superset-ui/core';
import {
  styled,
  css,
  useTheme,
  SupersetTheme,
} from '@apache-superset/core/theme';
import { t, tn } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
  Input,
  Space,
  RawAntdSelect as Select,
  Dropdown,
  Tooltip,
} from '@superset-ui/core/components';
import {
  CheckOutlined,
  InfoCircleOutlined,
  DownOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { isEmpty, debounce, isEqual } from 'lodash';
import {
  ObjectFormattingEnum,
  ColorSchemeEnum,
} from '@superset-ui/chart-controls';
import {
  DataColumnMeta,
  SearchOption,
  SortByItem,
  TableChartTransformedProps,
} from './types';
import DataTable, {
  DataTableProps,
  SearchInputProps,
  SelectPageSizeRendererProps,
  SizeOption,
} from './DataTable';
import Styles from './Styles';
import { formatColumnValue } from './utils/formatValue';
import { PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS } from './consts';
import { updateTableOwnState } from './DataTable/utils/externalAPIs';
import getScrollBarSize from './DataTable/utils/getScrollBarSize';
import DateWithFormatter from './utils/DateWithFormatter';

type ValueRange = [number, number];

interface TableSize {
  width: number;
  height: number;
}

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType: GenericDataType): DefaultSortTypes {
  if (dataType === GenericDataType.Temporal) {
    return 'datetime';
  }
  if (dataType === GenericDataType.String) {
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
 * Sanitize a column identifier for use in HTML id attributes and CSS selectors.
 */
export function sanitizeHeaderId(columnId: string): string {
  return (
    columnId
      .replace(/%/g, 'percent')
      .replace(/#/g, 'hash')
      .replace(/△/g, 'delta')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart
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
  theme,
}: {
  value: number;
  colorPositiveNegative: boolean;
  theme: SupersetTheme;
}) {
  if (!colorPositiveNegative) {
    return `${theme.colorFill}`;
  }
  if (value < 0) {
    return `${theme.colorError}50`;
  }
  return `${theme.colorSuccess}50`;
}

function SortIcon<D extends object>({ column }: { column: ColumnInstance<D> }) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = <ColumnHeightOutlined />;
  if (isSorted) {
    sortIcon = isSortedDesc ? <CaretDownOutlined /> : <CaretUpOutlined />;
  }
  return sortIcon;
}

const VisuallyHidden = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

function SearchInput({
  count,
  value,
  onChange,
  onBlur,
  inputRef,
}: SearchInputProps) {
  return (
    <Space direction="horizontal" size={4} className="dt-global-filter">
      {t('Search')}
      <Input
        aria-label={t('Search %s records', count)}
        placeholder={tn('%s record', '%s records...', count, count)}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        ref={inputRef}
      />
    </Space>
  );
}

function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
  const { Option } = Select;

  return (
    <span className="dt-select-page-size">
      <VisuallyHidden htmlFor="pageSizeSelect">
        {t('Select page size')}
      </VisuallyHidden>
      {t('Show')}{' '}
      <Select<number>
        id="pageSizeSelect"
        value={current}
        onChange={value => onChange(value)}
        size="small"
        css={(theme: SupersetTheme) => css`
          width: ${theme.sizeUnit * 18}px;
        `}
        aria-label={t('Show entries per page')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <Option key={size} value={Number(size)}>
              {text}
            </Option>
          );
        })}
      </Select>{' '}
      {t('entries per page')}
    </span>
  );
}

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

/**
 * Calculates the inclusive/exclusive temporal range for a bucket.
 * standard SQL range pattern: [start, end)
 */
function getTimeRangeFromGranularity(
  startTime: Date,
  granularity: TimeGranularity,
): [Date, Date] {
  const time = startTime.getTime();
  const date = startTime.getUTCDate();
  const month = startTime.getUTCMonth();
  const year = startTime.getUTCFullYear();

  // Constants
  const MS_IN_SECOND = 1000;
  const MS_IN_MINUTE = 60 * MS_IN_SECOND;
  const MS_IN_HOUR = 60 * MS_IN_MINUTE;

  switch (granularity) {
    case TimeGranularity.SECOND:
      return [startTime, new Date(time + MS_IN_SECOND)];
    case TimeGranularity.MINUTE:
      return [startTime, new Date(time + MS_IN_MINUTE)];
    case TimeGranularity.FIVE_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 5)];
    case TimeGranularity.TEN_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 10)];
    case TimeGranularity.FIFTEEN_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 15)];
    case TimeGranularity.THIRTY_MINUTES:
      return [startTime, new Date(time + MS_IN_MINUTE * 30)];
    case TimeGranularity.HOUR:
      return [startTime, new Date(time + MS_IN_HOUR)];
    case TimeGranularity.DAY:
    case TimeGranularity.DATE:
      return [startTime, new Date(Date.UTC(year, month, date + 1))];
    case TimeGranularity.WEEK:
    case TimeGranularity.WEEK_STARTING_SUNDAY:
    case TimeGranularity.WEEK_STARTING_MONDAY:
      return [startTime, new Date(Date.UTC(year, month, date + 7))];
    case TimeGranularity.WEEK_ENDING_SATURDAY:
    case TimeGranularity.WEEK_ENDING_SUNDAY:
      // Week-ending buckets are labeled by the bucket's final day.
      return [
        new Date(Date.UTC(year, month, date - 6)),
        new Date(Date.UTC(year, month, date + 1)),
      ];
    case TimeGranularity.MONTH:
      return [startTime, new Date(Date.UTC(year, month + 1, 1))];
    case TimeGranularity.QUARTER:
      return [
        startTime,
        new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 1)),
      ];
    case TimeGranularity.YEAR:
      return [startTime, new Date(Date.UTC(year + 1, 0, 1))];
    default:
      return [startTime, new Date(Date.UTC(year, month, date + 1))];
  }
}

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
    columnLabelToNameMap = {},
  } = props;

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
    (value: DataRecordValue) =>
      isRawRecords
        ? String(value ?? '')
        : getTimeFormatterForGranularity(timeGrain)(
            value as number | Date | null | undefined,
          ),
    [timeGrain, isRawRecords],
  );

  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });
  const [columnOrderToggle, setColumnOrderToggle] = useState(false);
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns[0].key,
  ]);
  const [hideComparisonKeys, setHideComparisonKeys] = useState<string[]>([]);
  const [displayedTotals, setDisplayedTotals] = useState<D | undefined>(totals);
  const theme = useTheme();

  useEffect(() => {
    setDisplayedTotals(totals);
  }, [totals]);

  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return (
      serverPagination ? SERVER_PAGE_SIZE_OPTIONS : PAGE_SIZE_OPTIONS
    ).filter(([n]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * data.length,
    ) as SizeOption[];
  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      const nums = data
        ?.map(row => row?.[key])
        .filter(value => typeof value === 'number') as number[];
      if (nums.length > 0) {
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
      if (!filters || !filters[key]) return false;
      return filters[key].some(filterVal => {
        if (filterVal === val) return true;
        // DateWithFormatter extends Date — compare by time value
        // since memoization cache misses can create new instances
        if (filterVal instanceof Date && val instanceof Date) {
          return filterVal.getTime() === val.getTime();
        }
        return false;
      });
    },
    [filters],
  );

  const getCrossFilterDataMask = useCallback(
    (key: string, value: DataRecordValue) => {
      let updatedFilters = { ...filters };
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
                    // Resolve adhoc column labels back to original column names
                    // so that cross-filters work on the receiving chart
                    const resolvedCol = columnLabelToNameMap[col] ?? col;
                    const val = ensureIsArray(updatedFilters?.[col]);
                    if (!val.length || val[0] === null || (val[0] instanceof DateWithFormatter && val[0].input === null))
                      return {
                        col: resolvedCol,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col: resolvedCol,
                      op: 'IN' as const,
                      val: val.map(el =>
                        el instanceof Date ? el.getTime() : el!,
                      ),
                      grain: resolvedCol === DTTM_ALIAS ? timeGrain : undefined,
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
    },
    [
      filters,
      isActiveFilterValue,
      timestampFormatter,
      timeGrain,
      columnLabelToNameMap,
    ],
  );

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = useCallback(
    (column: DataColumnMeta): CSSProperties => {
      const { isNumeric, config = {} } = column;
      const textAlign =
        config.horizontalAlign ||
        (isNumeric && !isUsingTimeComparison ? 'right' : 'left');
      return {
        textAlign,
      };
    },
    [isUsingTimeComparison],
  );

  const comparisonLabels = useMemo(() => [t('Main'), '#', '△', '%'], []);

  const filteredColumnsMeta = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columnsMeta;
    }
    const allColumns = comparisonColumns[0].key;
    const main = comparisonLabels[0];
    const showAllColumns = selectedComparisonColumns.includes(allColumns);

    return columnsMeta.filter(({ label, key }) => {
      const keyPortion = key.substring(label.length);
      const isKeyHidded = hideComparisonKeys.includes(keyPortion);
      const isLableMain = label === main;

      return (
        isLableMain ||
        (!isKeyHidded &&
          (!comparisonLabels.includes(label) ||
            showAllColumns ||
            selectedComparisonColumns.includes(label)))
      );
    });
  }, [
    columnsMeta,
    comparisonColumns,
    comparisonLabels,
    isUsingTimeComparison,
    hideComparisonKeys,
    selectedComparisonColumns,
  ]);

  const handleContextMenu = useMemo(() => {
    if (onContextMenu && !isRawRecords) {
      return (
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
        filteredColumnsMeta.forEach(col => {
          if (!col.isMetric) {
            const dataRecordValue = value[col.key];

            // FIX: Explicitly handle NULL values for temporal and non-temporal columns
            // DateWithFormatter objects wrap nulls, so we must check both
            if (
              dataRecordValue == null ||
              (dataRecordValue instanceof DateWithFormatter && dataRecordValue.input == null)
            ) {
              drillToDetailFilters.push({
                col: col.key,
                op: 'IS NULL' as any,
                val: null,
              });

            } else if (col.dataType === GenericDataType.Temporal && timeGrain) {
              const startTime =
                dataRecordValue instanceof Date
                  ? dataRecordValue
                  : new Date(dataRecordValue as string | number);

              const [rangeStartTime, rangeEndTime] = getTimeRangeFromGranularity(
                startTime,
                timeGrain,
              );
              const timeRangeValue = `${rangeStartTime.toISOString()} : ${rangeEndTime.toISOString()}`;

              drillToDetailFilters.push({
                col: col.key,
                op: 'TEMPORAL_RANGE',
                val: timeRangeValue,
                grain: timeGrain,
                formattedVal: formatColumnValue(col, dataRecordValue)[1],
              });
            } else {
              // Non-temporal columns use exact match
              const sanitizedValue = extractTextFromHTML(dataRecordValue);
              drillToDetailFilters.push({
                col: col.key,
                op: '==',
                val: sanitizedValue as string | number | boolean,
                formattedVal: formatColumnValue(col, sanitizedValue)[1],
              });
            }
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
                    op: (cellPoint.value == null || (cellPoint.value instanceof DateWithFormatter && cellPoint.value.input == null) ? 'IS NULL' : '==') as any,
                    val: extractTextFromHTML(cellPoint.value),
                  },
                ],
                groupbyFieldName: 'groupby',
              },
        });
      };
    }
    return undefined;
  }, [
    onContextMenu,
    isRawRecords,
    filteredColumnsMeta,
    getCrossFilterDataMask,
    timeGrain,
  ]);

  const getHeaderColumns = useCallback(
    (columnsMeta: DataColumnMeta[], enableTimeComparison?: boolean) => {
      const resultMap: Record<string, number[]> = {};
      if (!enableTimeComparison) {
        return resultMap;
      }
      columnsMeta.forEach((element, index) => {
        if (comparisonLabels.includes(element.label)) {
          const keyPortion = element.key.substring(element.label.length);
          if (!resultMap[keyPortion]) {
            resultMap[keyPortion] = [index];
          } else {
            resultMap[keyPortion].push(index);
          }
        }
      });
      return resultMap;
    },
    [comparisonLabels],
  );

  const renderTimeComparisonDropdown = (): JSX.Element => {
    const allKey = comparisonColumns[0].key;
    const handleOnClick = (data: any) => {
      const { key } = data;
      if (key === allKey) {
        setSelectedComparisonColumns([allKey]);
      } else if (selectedComparisonColumns.includes(allKey)) {
        setSelectedComparisonColumns([key]);
      } else {
        setSelectedComparisonColumns(
          selectedComparisonColumns.includes(key)
            ? selectedComparisonColumns.filter(k => k !== key)
            : [...selectedComparisonColumns, key],
        );
      }
    };

    return (
      <Dropdown
        placement="bottomRight"
        open={showComparisonDropdown}
        onOpenChange={(flag: boolean) => setShowComparisonDropdown(flag)}
        menu={{
          multiple: true,
          onClick: handleOnClick,
          selectedKeys: selectedComparisonColumns,
          items: [
            {
              key: 'all-header',
              label: (
                <div
                  css={css`
                    max-width: 242px;
                    padding: 0 ${theme.sizeUnit * 2}px;
                    color: ${theme.colorText};
                    font-size: ${theme.fontSizeSM}px;
                  `}
                >
                  {t('Select columns to display. Multiselect supported.')}
                </div>
              ),
              type: 'group',
              children: comparisonColumns.map(column => ({
                key: column.key,
                label: (
                  <>
                    <span css={css`color: ${theme.colorText};`}>
                      {column.label}
                    </span>
                    <span css={css`float: right; font-size: ${theme.fontSizeSM}px;`}>
                      {selectedComparisonColumns.includes(column.key) && <CheckOutlined />}
                    </span>
                  </>
                ),
              })),
            },
          ],
        }}
        trigger={['click']}
      >
        <span>
          <TableOutlined /> <DownOutlined />
        </span>
      </Dropdown>
    );
  };

  const visibleColumnsMeta = useMemo(
    () => filteredColumnsMeta.filter(col => col.config?.visible !== false),
    [filteredColumnsMeta],
  );

  const groupHeaderColumns = useMemo(
    () => getHeaderColumns(visibleColumnsMeta, isUsingTimeComparison),
    [visibleColumnsMeta, getHeaderColumns, isUsingTimeComparison],
  );

  const renderGroupingHeaders = (): JSX.Element => {
    const headers: any = [];
    let currentColumnIndex = 0;
    const sortedEntries = Object.entries(groupHeaderColumns || {}).sort(
      (a, b) => a[1][0] - b[1][0],
    );

    sortedEntries.forEach(([key, value]) => {
      const startPosition = value[0];
      const colSpan = value.length;
      const firstColumnInGroup = visibleColumnsMeta[startPosition];
      const originalLabel = firstColumnInGroup
        ? columnsMeta.find(col => col.key === firstColumnInGroup.key)
            ?.originalLabel || key
        : key;

      for (let i = currentColumnIndex; i < startPosition; i += 1) {
        headers.push(<th key={`placeholder-${i}`} style={{ borderBottom: 0 }} />);
      }

      headers.push(
        <th key={`header-${key}`} colSpan={colSpan} style={{ borderBottom: 0 }}>
          {originalLabel}
          <span css={css`float: right; & svg { color: ${theme.colorIcon} !important; }`}>
            {hideComparisonKeys.includes(key) ? (
              <PlusCircleOutlined onClick={() => setHideComparisonKeys(hideComparisonKeys.filter(k => k !== key))} />
            ) : (
              <MinusCircleOutlined onClick={() => setHideComparisonKeys([...hideComparisonKeys, key])} />
            )}
          </span>
        </th>,
      );
      currentColumnIndex = startPosition + colSpan;
    });

    return (
      <tr
        css={css`
          th {
            border-right: 1px solid ${theme.colorSplit};
          }
          th:first-of-type {
            border-left: none;
          }
          th:last-child {
            border-right: none;
          }
        `}
      >
        {headers}
      </tr>
    );
  };

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> & { columnKey: string } => {
      const {
        key,
        label: originalLabel,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
        description,
      } = column;
      const label = config.customColumnName || originalLabel;
      let displayLabel = label;
      const isComparisonColumn = ['#', '△', '%', t('Main')].includes(column.label);

      if (isComparisonColumn) {
        if (column.label === t('Main')) {
          displayLabel = config.customColumnName || column.originalLabel || '';
        } else if (config.customColumnName) {
          displayLabel = config.displayTypeIcon !== false ? `${column.label} ${config.customColumnName}` : config.customColumnName;
        } else if (config.displayTypeIcon === false) {
          displayLabel = '';
        }
      }

      const columnWidth = Number.isNaN(Number(config.columnWidth)) ? config.columnWidth : Number(config.columnWidth);
      const sharedStyle: CSSProperties = getSharedStyle(column);
      const alignPositiveNegative = config.alignPositiveNegative ?? defaultAlignPN;
      const colorPositiveNegative = config.colorPositiveNegative ?? defaultColorPN;
      const { truncateLongCells } = config;
      const hasColumnColorFormatters = Array.isArray(columnColorFormatters) && columnColorFormatters.length > 0;
      const hasBasicColorFormatters = isUsingTimeComparison && Array.isArray(basicColorFormatters) && basicColorFormatters.length > 0;
      const generalShowCellBars = config.showCellBars ?? showCellBars;
      const valueRange = !hasBasicColorFormatters && generalShowCellBars && (isMetric || isRawRecords || isPercentMetric) && getValueRange(key, alignPositiveNegative);

      let className = '';
      if (emitCrossFilters && !isMetric) className += ' dt-is-filter';
      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1]) className += ' right-border-only';
      }

      const headerId = sanitizeHeaderId(column.originalLabel ?? column.key);

      return {
        id: String(i),
        columnKey: key,
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({ value, row }: { value: DataRecordValue; row: Row<D> }) => {
          const [isHtml, text] = formatColumnValue(column, value, row.original);
          const html = isHtml && allowRenderHtml ? { __html: text } : undefined;
          let backgroundColor;
          let color;
          let backgroundColorCellBar;
          let valueRangeFlag = true;
          let arrow = '';
          const originKey = column.key.substring(column.label.length).trim();

          if (!hasColumnColorFormatters && hasBasicColorFormatters) {
            backgroundColor = basicColorFormatters[row.index][originKey]?.backgroundColor;
            arrow = column.label === comparisonLabels[0] ? basicColorFormatters[row.index][originKey]?.mainArrow : '';
          }

          if (hasColumnColorFormatters) {
            columnColorFormatters
              .filter(f => f.columnFormatting ? f.columnFormatting === column.key : f.column === column.key)
              .forEach(formatter => {
                const formatterResult = formatter.getColorFromValue(formatter.columnFormatting ? row.original[formatter.column] : (value as any));
                if (!formatterResult) return;
                if (formatter.objectFormatting === ObjectFormattingEnum.TEXT_COLOR) {
                  color = formatterResult.slice(0, -2);
                } else if (formatter.objectFormatting === ObjectFormattingEnum.CELL_BAR) {
                  if (generalShowCellBars) backgroundColorCellBar = formatterResult.slice(0, -2);
                } else {
                  backgroundColor = formatterResult;
                  valueRangeFlag = false;
                }
              });
          }

          const StyledCell = styled.td`
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            font-weight: ${color ? theme.fontWeightBold : theme.fontWeightNormal};
            background: ${backgroundColor || undefined};
            padding-left: ${column.isChildColumn ? `${theme.sizeUnit * 5}px` : `${theme.sizeUnit}px`};
          `;

          const cellBarStyles = css`
            position: absolute; height: 100%; display: block; top: 0;
            ${valueRange && typeof value === 'number' && valueRangeFlag && `
              width: ${cellWidth({ value, valueRange, alignPositiveNegative })}%;
              left: ${cellOffset({ value, valueRange, alignPositiveNegative })}%;
              background-color: ${backgroundColorCellBar ? `${backgroundColorCellBar}99` : cellBackground({ value, colorPositiveNegative, theme })};
            `}
          `;

          const arrowStyles = css`
            color: ${(basicColorColumnFormatters?.[row.index]?.[column.key]?.arrowColor ?? basicColorFormatters?.[row.index]?.[originKey]?.arrowColor) === ColorSchemeEnum.Green ? theme.colorSuccess : theme.colorError};
            margin-right: ${theme.sizeUnit}px;
          `;

          const cellProps = {
            'aria-labelledby': `header-${headerId}`,
            role: 'cell',
            title: typeof value === 'number' ? String(value) : undefined,
            onClick: emitCrossFilters && !valueRange && !isMetric ? () => !getSelectedText() && toggleFilter(key, value) : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault(); e.stopPropagation();
                handleContextMenu(row.original, { key, value, isMetric }, e.nativeEvent.clientX, e.nativeEvent.clientY);
              }
            },
            className: [className, value == null ? 'dt-is-null' : '', isActiveFilterValue(key, value) ? ' dt-is-active-filter' : ''].join(' '),
            tabIndex: 0,
          };

          if (html) {
            return (
              <StyledCell {...cellProps}>
                {/* eslint-disable-next-line react/no-danger */}
                <div className={truncateLongCells ? 'dt-truncate-cell' : ''} style={truncateLongCells && columnWidth ? { width: columnWidth } : undefined} dangerouslySetInnerHTML={html} />
              </StyledCell>
            );
          }

          return (
            <StyledCell {...cellProps}>
              {valueRange && <div className={cx('cell-bar', typeof value === 'number' && value < 0 ? 'negative' : 'positive')} css={cellBarStyles} role="presentation" />}
              {/* eslint-disable-next-line react/no-danger */}
                <div className={truncateLongCells ? 'dt-truncate-cell' : ''} style={truncateLongCells && columnWidth ? { width: columnWidth } : undefined}>
                {arrow && <span css={arrowStyles}>{arrow}</span>}
                {text}
              </div>
            </StyledCell>
          );
        },
        Header: ({ column: col, onClick, style, onDragStart, onDrop }) => (
          <th
            id={`header-${headerId}`}
            title={description || t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{ ...sharedStyle, ...style }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLElement>) => Object.values(ACTION_KEYS).includes(e.key) && col.toggleSortBy()}
            role="columnheader button"
            onClick={onClick}
            {...(allowRearrangeColumns && { draggable: true, onDragStart, onDragOver: e => e.preventDefault(), onDrop })}
            tabIndex={0}
          >
            {config.columnWidth ? <div style={{ width: columnWidth, height: 0.01 }} /> : null}
            <div css={{ display: 'inline-flex', alignItems: 'flex-end' }}>
              <span>{displayLabel}</span>
              <SortIcon column={col} />
            </div>
          </th>
        ),
        Footer: displayedTotals ? (
          i === 0 ? (
            <th key="footer-summary">
              <div css={css`display: flex; align-items: center; & svg { margin-left: ${theme.sizeUnit}px; color: ${theme.colorBorder} !important; }`}>
                {t('Summary')}
                <Tooltip overlay={t('Show total aggregations. Row limit does not apply.')}><InfoCircleOutlined /></Tooltip>
              </div>
            </th>
          ) : (
            <td key={`footer-total-${i}`} style={sharedStyle}><strong>{formatColumnValue(column, displayedTotals[key])[1]}</strong></td>
          )
        ) : undefined,
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [getSharedStyle, defaultAlignPN, defaultColorPN, columnColorFormatters, isUsingTimeComparison, basicColorFormatters, showCellBars, isRawRecords, getValueRange, emitCrossFilters, comparisonLabels, displayedTotals, theme, sortDesc, groupHeaderColumns, allowRenderHtml, basicColorColumnFormatters, isActiveFilterValue, toggleFilter, handleContextMenu, allowRearrangeColumns],
  );

  const columns = useMemo(() => visibleColumnsMeta.map(getColumnConfigs), [visibleColumnsMeta, getColumnConfigs]);
  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);

  const handleFilteredDataChange = useCallback((rows: Row<D>[], searchText?: string) => {
    if (!totals || serverPagination) return;
    if (!searchText?.trim()) { setDisplayedTotals(totals); return; }
    const updatedTotals: Record<string, DataRecordValue> = { ...totals };
    filteredColumnsMeta.forEach(column => {
      if (column.isMetric || column.isPercentMetric) {
        updatedTotals[column.key] = rows.reduce((acc, row) => {
          const numValue = Number(String(row.original?.[column.key] ?? '').replace(/,/g, ''));
          return Number.isFinite(numValue) ? acc + numValue : acc;
        }, 0);
      }
    });
    setDisplayedTotals(updatedTotals as D);
  }, [filteredColumnsMeta, serverPagination, totals]);

  useEffect(() => {
    const options = (columns as (ColumnWithLooseAccessor & { columnKey: string; sortType?: string })[]).filter(col => col?.sortType === 'alphanumeric').map(column => ({ value: column.columnKey, label: column.columnKey }));
    if (!isEqual(options, searchOptions)) setSearchOptions(options || []);
  }, [columns, searchOptions]);

  const handleServerPaginationChange = useCallback((pageNumber: number, pageSize: number) => {
    updateTableOwnState(setDataMask, { ...serverPaginationData, currentPage: pageNumber, pageSize });
  }, [serverPaginationData, setDataMask]);

  useEffect(() => {
    if (hasServerPageLengthChanged) updateTableOwnState(setDataMask, { ...serverPaginationData, currentPage: 0, pageSize: serverPageLength });
  }, [hasServerPageLengthChanged, serverPageLength, serverPaginationData, setDataMask]);

  const handleSizeChange = useCallback(({ width, height }: { width: number; height: number }) => setTableSize({ width, height }), []);

  useLayoutEffect(() => {
    const scrollBarSize = getScrollBarSize();
    if (width - tableSize.width > scrollBarSize || height - tableSize.height > scrollBarSize) {
      handleSizeChange({ width: width - scrollBarSize, height: height - scrollBarSize });
    } else if (tableSize.width - width > scrollBarSize || tableSize.height - height > scrollBarSize) {
      handleSizeChange({ width, height });
    }
  }, [width, height, handleSizeChange, tableSize]);

  const handleSortByChange = useCallback((sortBy: SortByItem[]) => {
    if (!serverPagination) return;
    updateTableOwnState(setDataMask, { ...serverPaginationData, sortBy } as unknown as any);
  }, [serverPagination, serverPaginationData, setDataMask]);

  const debouncedSearch = debounce((searchText: string) => {
    updateTableOwnState(setDataMask, { ...serverPaginationData, searchColumn: serverPaginationData?.searchColumn || searchOptions[0]?.value, searchText, currentPage: 0 } as unknown as any);
  }, 800);

  const [clientViewRows, setClientViewRows] = useState<DataRecord[]>([]);
  const exportColumns = useMemo(() => visibleColumnsMeta.map(col => ({ key: col.key, label: col.config?.customColumnName || col.originalLabel || col.key })), [visibleColumnsMeta]);
  const prevClientViewRef = useRef<{ rows: DataRecord[]; columns: typeof exportColumns } | null>(null);

  useEffect(() => {
    if (serverPagination) return;
    const prev = prevClientViewRef.current;
    if (!prev || !isEqual(prev.rows, clientViewRows) || !isEqual(prev.columns, exportColumns)) {
      prevClientViewRef.current = { rows: clientViewRows, columns: exportColumns };
      updateTableOwnState(setDataMask, { ...serverPaginationData, clientView: { rows: clientViewRows, columns: exportColumns, count: clientViewRows.length } });
    }
  }, [clientViewRows, exportColumns, serverPagination, setDataMask, serverPaginationData]);

  return (
    <Styles>
      <DataTable<D>
        columns={columns} data={data} rowCount={rowCount} tableClassName="table table-striped table-condensed"
        pageSize={pageSize} serverPaginationData={serverPaginationData} pageSizeOptions={pageSizeOptions}
        width={tableSize.width} height={tableSize.height} serverPagination={serverPagination}
        onServerPaginationChange={handleServerPaginationChange} onColumnOrderChange={() => setColumnOrderToggle(!columnOrderToggle)}
        initialSearchText={serverPaginationData?.searchText || ''} sortByFromParent={serverPaginationData?.sortBy || []}
        searchInputId={`${slice_id}-search`} maxPageItemCount={width > 340 ? 9 : 7} noResults={getNoResultsMessage}
        searchInput={includeSearch && SearchInput} selectPageSize={pageSize !== null && SelectPageSize}
        sticky={sticky} renderGroupingHeaders={!isEmpty(groupHeaderColumns) ? renderGroupingHeaders : undefined}
        renderTimeComparisonDropdown={isUsingTimeComparison ? renderTimeComparisonDropdown : undefined}
        handleSortByChange={handleSortByChange} onSearchColChange={(searchCol: string) => updateTableOwnState(setDataMask, { ...serverPaginationData, searchColumn: searchCol, searchText: '' } as any)}
        manualSearch={serverPagination} onSearchChange={debouncedSearch} searchOptions={searchOptions}
        onFilteredDataChange={handleFilteredDataChange} onFilteredRowsChange={setClientViewRows}
      />
    </Styles>
  );
}

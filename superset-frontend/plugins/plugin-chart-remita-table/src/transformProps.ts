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
import memoizeOne from 'memoize-one';
import {
  ComparisonType,
  CurrencyFormatter,
  Currency,
  DataRecord,
  ensureIsArray,
  extractTimegrain,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  NumberFormats,
  QueryMode,
  SMART_DATE_ID,
  TimeFormats,
  TimeFormatter,
} from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  ColorFormatters,
  ConditionalFormattingConfig,
  getColorFormatters,
} from '@superset-ui/chart-controls';

import { isEmpty } from 'lodash';
import isEqualColumns from './utils/isEqualColumns';
import DateWithFormatter from './utils/DateWithFormatter';
import {
  BasicColorFormatterType,
  ColorSchemeEnum,
  DataColumnMeta,
  TableChartProps,
  TableChartTransformedProps,
  TableColumnConfig,
} from './types';

const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    x => x[key] === null || x[key] === undefined || typeof x[key] === 'number',
  );
}

/**
 * Parse action configs (split_actions, non_split_actions, table_actions) once at transform time
 * to avoid repeated JSON.parse operations in TableChart's useMemo hooks.
 *
 * Accepts string (JSON), array, Set, or undefined and always returns a Set.
 */
function parseActionConfig<T>(input: unknown): Set<T> {
  // If input is a string, try to parse it
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      return Array.isArray(parsed) ? new Set(parsed as T[]) : new Set<T>();
    } catch {
      return new Set<T>();
    }
  }
  // If input is an array, convert it to a set
  if (Array.isArray(input)) {
    return new Set(input as T[]);
  }
  // If input is already a set, return it
  if (input instanceof Set) {
    return input;
  }
  // Default: return empty set
  return new Set<T>();
}

/**
 * Cache for DateWithFormatter instances to avoid recreating them on every render.
 * Uses a WeakMap keyed by formatter function, with nested Maps for value lookups.
 * This provides O(1) cache hits while allowing garbage collection of unused formatters.
 */
const dateFormatterCache = new WeakMap<
  TimeFormatter,
  Map<string, DateWithFormatter>
>();

/**
 * Get or create a cached DateWithFormatter instance.
 * Cache key: formatter function + stringified value
 */
function getCachedDateWithFormatter(
  value: DataRecordValue,
  formatter: TimeFormatter,
): DateWithFormatter {
  // Get or create the nested map for this formatter
  let valueCache = dateFormatterCache.get(formatter);
  if (!valueCache) {
    valueCache = new Map();
    dateFormatterCache.set(formatter, valueCache);
  }

  // Create a cache key from the value
  // For nullish values, use a special key to avoid string conversion issues
  const cacheKey = value == null ? '__null__' : String(value);

  // Check cache
  let cached = valueCache.get(cacheKey);
  if (!cached) {
    // Create and cache new instance
    cached = new DateWithFormatter(value, { formatter });
    valueCache.set(cacheKey, cached);

    // Limit cache size per formatter to prevent memory bloat
    // If cache exceeds 1000 entries, clear the oldest 20% (LRU-like behavior)
    if (valueCache.size > 1000) {
      const entriesToDelete = Math.floor(valueCache.size * 0.2);
      const iterator = valueCache.keys();
      for (let i = 0; i < entriesToDelete; i += 1) {
        const key = iterator.next().value;
        if (key !== undefined) {
          valueCache.delete(key);
        }
      }
    }
  }

  return cached;
}

const processDataRecords = memoizeOne(function processDataRecords(
  data: DataRecord[] | undefined,
  columns: DataColumnMeta[],
) {
  if (!data?.[0]) {
    return data || [];
  }
  const timeColumns = columns.filter(
    column => column.dataType === GenericDataType.Temporal,
  );

  if (timeColumns.length > 0) {
    return data.map(x => {
      const datum = { ...x };
      timeColumns.forEach(({ key, formatter }) => {
        // Use cached DateWithFormatter instances to avoid recreating objects
        // on every render. This reduces allocations from O(rows × timeColumns)
        // to O(unique_values × timeColumns) - typically 10-100x improvement.
        datum[key] = getCachedDateWithFormatter(
          x[key],
          formatter as TimeFormatter,
        );
      });
      return datum;
    });
  }
  return data;
});

const calculateDifferences = (
  originalValue: number,
  comparisonValue: number,
) => {
  const valueDifference = originalValue - comparisonValue;
  let percentDifferenceNum;
  if (!originalValue && !comparisonValue) {
    percentDifferenceNum = 0;
  } else if (!originalValue || !comparisonValue) {
    percentDifferenceNum = originalValue ? 1 : -1;
  } else {
    percentDifferenceNum =
      (originalValue - comparisonValue) / Math.abs(comparisonValue);
  }
  return { valueDifference, percentDifferenceNum };
};

const processComparisonTotals = (
  comparisonSuffix: string,
  totals?: DataRecord[],
): DataRecord | undefined => {
  if (!totals) {
    return totals;
  }
  const transformedTotals: DataRecord = {};
  totals.map((totalRecord: DataRecord) =>
    Object.keys(totalRecord).forEach(key => {
      if (totalRecord[key] !== undefined && !key.includes(comparisonSuffix)) {
        transformedTotals[`Main ${key}`] =
          parseInt(transformedTotals[`Main ${key}`]?.toString() || '0', 10) +
          parseInt(totalRecord[key]?.toString() || '0', 10);
        transformedTotals[`# ${key}`] =
          parseInt(transformedTotals[`# ${key}`]?.toString() || '0', 10) +
          parseInt(
            totalRecord[`${key}__${comparisonSuffix}`]?.toString() || '0',
            10,
          );
        const { valueDifference, percentDifferenceNum } = calculateDifferences(
          transformedTotals[`Main ${key}`] as number,
          transformedTotals[`# ${key}`] as number,
        );
        transformedTotals[`△ ${key}`] = valueDifference;
        transformedTotals[`% ${key}`] = percentDifferenceNum;
      }
    }),
  );

  return transformedTotals;
};

const processComparisonDataRecords = memoizeOne(
  function processComparisonDataRecords(
    originalData: DataRecord[] | undefined,
    originalColumns: DataColumnMeta[],
    comparisonSuffix: string,
  ) {
    // Transform data
    return originalData?.map(originalItem => {
      const transformedItem: DataRecord = {};
      originalColumns.forEach(origCol => {
        if (
          (origCol.isMetric || origCol.isPercentMetric) &&
          !origCol.key.includes(comparisonSuffix) &&
          origCol.isNumeric
        ) {
          const originalValue = originalItem[origCol.key] || 0;
          const comparisonValue = origCol.isMetric
            ? originalItem?.[`${origCol.key}__${comparisonSuffix}`] || 0
            : originalItem[`%${origCol.key.slice(1)}__${comparisonSuffix}`] ||
              0;
          const { valueDifference, percentDifferenceNum } =
            calculateDifferences(
              originalValue as number,
              comparisonValue as number,
            );

          transformedItem[`Main ${origCol.key}`] = originalValue;
          transformedItem[`# ${origCol.key}`] = comparisonValue;
          transformedItem[`△ ${origCol.key}`] = valueDifference;
          transformedItem[`% ${origCol.key}`] = percentDifferenceNum;
        }
      });

      Object.keys(originalItem).forEach(key => {
        const isMetricOrPercentMetric = originalColumns.some(
          col => col.key === key && (col.isMetric || col.isPercentMetric),
        );
        if (!isMetricOrPercentMetric) {
          transformedItem[key] = originalItem[key];
        }
      });

      return transformedItem;
    });
  },
);

function humanizeHeaderLabel(input: string) {
  try {
    const withSpaces = String(input || '').replace(/_/g, ' ');
    return withSpaces
      .split(' ')
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');
  } catch {
    return input;
  }
}

const processColumns = memoizeOne(function processColumns(
  props: TableChartProps,
) {
  const { datasource, rawFormData, queriesData } = props as any;
  const { columnFormats, currencyFormats, verboseMap } = (datasource || {}) as any;
  const {
    table_timestamp_format: tableTimestampFormat,
    metrics: metrics_,
    percent_metrics: percentMetrics_,
    column_config: columnConfig = {},
    humanize_headers: humanizeHeadersRaw,
  } = (rawFormData || {}) as any;
  const granularity = extractTimegrain(props.rawFormData);
  const { data: records, colnames, coltypes } = (queriesData && queriesData[0]) || {} as any;
  // convert `metrics` and `percentMetrics` to the key names in `data.records`
  const metrics = (metrics_ ?? []).map(getMetricLabel);
  const rawPercentMetrics = (percentMetrics_ ?? []).map(getMetricLabel);
  // column names for percent metrics always starts with a '%' sign.
  const percentMetrics = rawPercentMetrics.map((x: string) => `%${x}`);
  const metricsSet = new Set(metrics);
  const percentMetricsSet = new Set(percentMetrics);
  const rawPercentMetricsSet = new Set(rawPercentMetrics);

  const columns: DataColumnMeta[] = (colnames || [])
    .filter(
      (key: string) =>
        // if a metric was only added to percent_metrics, they should not show up in the table.
        !(rawPercentMetricsSet.has(key) && !metricsSet.has(key)),
    )
    .map((key: string, i: number) => {
      const dataType = coltypes[i];
      const config = columnConfig[key] || {};
      // for the purpose of presentation, only numeric values are treated as metrics
      // because users can also add things like `MAX(str_col)` as a metric.
      const isMetric = metricsSet.has(key) && isNumeric(key, records);
      const isPercentMetric = percentMetricsSet.has(key);
      let label =
        isPercentMetric && verboseMap?.hasOwnProperty(key.replace('%', ''))
          ? `%${verboseMap[key.replace('%', '')]}`
          : verboseMap?.[key] || key;
      // Humanize only when using default key (no customized verbose label)
      const shouldHumanize = (humanizeHeadersRaw ?? true) !== false;
      if (shouldHumanize && label === key) {
        label = humanizeHeaderLabel(key);
      }
      const isTime = dataType === GenericDataType.Temporal;
      const isNumber = dataType === GenericDataType.Numeric;
      const savedFormat = columnFormats?.[key];
      const savedCurrency = currencyFormats?.[key];
      const numberFormat = config.d3NumberFormat || savedFormat;
      const currency = config.currencyFormat?.symbol
        ? config.currencyFormat
        : savedCurrency;

      let formatter;

      if (isTime || config.d3TimeFormat) {
        // string types may also apply d3-time format
        // pick adhoc format first, fallback to column level formats defined in
        // datasource
        const customFormat = config.d3TimeFormat || savedFormat;
        const timeFormat = customFormat || tableTimestampFormat;
        // When format is "Adaptive Formatting" (smart_date)
        if (timeFormat === SMART_DATE_ID) {
          if (granularity) {
            // time column use formats based on granularity
            formatter = getTimeFormatterForGranularity(granularity);
          } else if (customFormat) {
            // other columns respect the column-specific format
            formatter = getTimeFormatter(customFormat);
          } else if (isNumeric(key, records)) {
            // if column is numeric values, it is considered a timestamp64
            formatter = getTimeFormatter(DATABASE_DATETIME);
          } else {
            // if no column-specific format, print cell as is
            formatter = String;
          }
        } else if (timeFormat) {
          formatter = getTimeFormatter(timeFormat);
        }
      } else if (isPercentMetric) {
        // percent metrics have a default format
        formatter = getNumberFormatter(numberFormat || PERCENT_3_POINT);
      } else if (isMetric || (isNumber && (numberFormat || currency))) {
        formatter = currency
          ? new CurrencyFormatter({
              d3Format: numberFormat,
              currency,
            })
          : getNumberFormatter(numberFormat);
      }
      return {
        key,
        label,
        dataType,
        isNumeric: dataType === GenericDataType.Numeric,
        isMetric,
        isPercentMetric,
        formatter,
        config,
      };
    });
  return [metrics, percentMetrics, columns] as [
    typeof metrics,
    typeof percentMetrics,
    typeof columns,
  ];
}, isEqualColumns);

const getComparisonColConfig = (
  label: string,
  parentColKey: string,
  columnConfig: Record<string, TableColumnConfig>,
) => {
  const comparisonKey = `${label} ${parentColKey}`;
  const comparisonColConfig = columnConfig[comparisonKey] || {};
  return comparisonColConfig;
};

const getComparisonColFormatter = (
  label: string,
  parentCol: DataColumnMeta,
  columnConfig: Record<string, TableColumnConfig>,
  savedFormat: string | undefined,
  savedCurrency: Currency | undefined,
) => {
  const currentColConfig = getComparisonColConfig(
    label,
    parentCol.key,
    columnConfig,
  );
  const hasCurrency = currentColConfig.currencyFormat?.symbol;
  const currentColNumberFormat =
    // fallback to parent's number format if not set
    currentColConfig.d3NumberFormat || parentCol.config?.d3NumberFormat;
  let { formatter } = parentCol;
  if (label === '%') {
    formatter = getNumberFormatter(currentColNumberFormat || PERCENT_3_POINT);
  } else if (currentColNumberFormat || hasCurrency) {
    const currency = currentColConfig.currencyFormat || savedCurrency;
    const numberFormat = currentColNumberFormat || savedFormat;
    formatter = currency
      ? new CurrencyFormatter({
          d3Format: numberFormat,
          currency,
        })
      : getNumberFormatter(numberFormat);
  }
  return formatter;
};

const processComparisonColumns = (
  columns: DataColumnMeta[],
  props: TableChartProps,
  comparisonSuffix: string,
) =>
  columns
    .map(col => {
      const {
        datasource: { columnFormats, currencyFormats },
        rawFormData: { column_config: columnConfig = {} },
      } = props;
      const savedFormat = columnFormats?.[col.key];
      const savedCurrency = currencyFormats?.[col.key];
      if (
        (col.isMetric || col.isPercentMetric) &&
        !col.key.includes(comparisonSuffix) &&
        col.isNumeric
      ) {
        return [
          {
            ...col,
            label: t('Main'),
            key: `${t('Main')} ${col.key}`,
            config: getComparisonColConfig(t('Main'), col.key, columnConfig),
            formatter: getComparisonColFormatter(
              t('Main'),
              col,
              columnConfig,
              savedFormat,
              savedCurrency,
            ),
          },
          {
            ...col,
            label: `#`,
            key: `# ${col.key}`,
            config: getComparisonColConfig(`#`, col.key, columnConfig),
            formatter: getComparisonColFormatter(
              `#`,
              col,
              columnConfig,
              savedFormat,
              savedCurrency,
            ),
          },
          {
            ...col,
            label: `△`,
            key: `△ ${col.key}`,
            config: getComparisonColConfig(`△`, col.key, columnConfig),
            formatter: getComparisonColFormatter(
              `△`,
              col,
              columnConfig,
              savedFormat,
              savedCurrency,
            ),
          },
          {
            ...col,
            label: `%`,
            key: `% ${col.key}`,
            config: getComparisonColConfig(`%`, col.key, columnConfig),
            formatter: getComparisonColFormatter(
              `%`,
              col,
              columnConfig,
              savedFormat,
              savedCurrency,
            ),
          },
        ];
      }
      if (
        !col.isMetric &&
        !col.isPercentMetric &&
        !col.key.includes(comparisonSuffix)
      ) {
        return [col];
      }
      return [];
    })
    .flat();

/**
 * Automatically set page size based on number of cells.
 */
const getPageSize = (
  pageSize: number | string | null | undefined,
  numRecords: number,
  numColumns: number,
) => {
  if (typeof pageSize === 'number') {
    // NaN is also has typeof === 'number'
    return pageSize || 0;
  }
  if (typeof pageSize === 'string') {
    return Number(pageSize) || 0;
  }
  // when pageSize not set, automatically add pagination if too many records
  return numRecords * numColumns > 5000 ? 200 : 0;
};

const defaultServerPaginationData = {};
const defaultColorFormatters = [] as ColorFormatters;
const transformProps = (
  chartProps: TableChartProps,
): TableChartTransformedProps => {
  const {
    height,
    width,
    rawFormData: formData,
    queriesData = [],
    filterState,
    ownState: serverPaginationData,
    hooks: {
      onAddFilter: onChangeFilter,
      setDataMask = () => {},
      onContextMenu,
    },
    emitCrossFilters,
  } = chartProps as any;

  const {
    align_pn: alignPositiveNegative = true,
    color_pn: colorPositiveNegative = true,
    show_cell_bars: showCellBars = false,
    include_search: includeSearch = false,
    order_desc: sortDesc = false,
    query_mode: queryMode,
    show_totals: showTotals,
    conditional_formatting: conditionalFormatting,
    allow_rearrange_columns: allowRearrangeColumns,
    allow_render_html: allowRenderHtml,
    enable_column_visibility = false,
    enable_column_resize = false,
    enable_highlight_search = false,
    enable_quick_filters = false,
    enable_invert_selection = false,
    enable_pin_columns = false,
    enable_server_search_column_selector = false,
    show_search_column_select = false,
    time_compare,
    comparison_color_enabled: comparisonColorEnabled = false,
    comparison_color_scheme: comparisonColorScheme = ColorSchemeEnum.Green,
    comparison_type,
    
    // table_actions is deprecated here in favor of actions_config.table_actions (see derived_table_actions below)
    include_row_numbers,
    slice_id,
    // show_split_buttons_in_slice_header is deprecated here in favor of actions_config.show_split_buttons_in_slice_header
    retain_selection_across_navigation = undefined,
    retain_selection_accross_navigation: legacy_retain_selection_accross_navigation = undefined,
    // description
    show_description = false,
    description_markdown = '',
    include_native_filters = true,
    include_dashboard_filters,
    open_action_url_in_new_tab = false,
  } = formData;

  // Pagination defaults: if page_length provided and server_pagination not explicitly set, use client-side pagination.
  const pageLength = (formData as any)?.page_length;
  const serverPageLength = (formData as any)?.server_page_length ?? 50;
  // Default to server pagination unless explicitly disabled
  const serverPagination = (formData as any)?.server_pagination !== false;
  const isUsingTimeComparison =
    !isEmpty(time_compare) &&
    queryMode === QueryMode.Aggregate &&
    comparison_type === ComparisonType.Values;

  const calculateBasicStyle = (
    percentDifferenceNum: number,
    colorOption: ColorSchemeEnum,
  ) => {
    if (percentDifferenceNum === 0) {
      return {
        arrow: '',
        arrowColor: '',
        // eslint-disable-next-line theme-colors/no-literal-colors
        backgroundColor: 'rgba(0,0,0,0.2)',
      };
    }
    const isPositive = percentDifferenceNum > 0;
    const arrow = isPositive ? '↑' : '↓';
    const arrowColor =
      colorOption === ColorSchemeEnum.Green
        ? isPositive
          ? ColorSchemeEnum.Green
          : ColorSchemeEnum.Red
        : isPositive
          ? ColorSchemeEnum.Red
          : ColorSchemeEnum.Green;
    const backgroundColor =
      colorOption === ColorSchemeEnum.Green
        ? `rgba(${isPositive ? '0,150,0' : '150,0,0'},0.2)`
        : `rgba(${isPositive ? '150,0,0' : '0,150,0'},0.2)`;

    return { arrow, arrowColor, backgroundColor };
  };

  const getBasicColorFormatter = memoizeOne(function getBasicColorFormatter(
    originalData: DataRecord[] | undefined,
    originalColumns: DataColumnMeta[],
    selectedColumns?: ConditionalFormattingConfig[],
  ) {
    // Transform data
    const relevantColumns = selectedColumns
      ? originalColumns.filter(col =>
          selectedColumns.some(scol => scol?.column?.includes(col.key)),
        )
      : originalColumns;

    return originalData?.map(originalItem => {
      const item: { [key: string]: BasicColorFormatterType } = {};
      relevantColumns.forEach(origCol => {
        if (
          (origCol.isMetric || origCol.isPercentMetric) &&
          !origCol.key.includes(ensureIsArray(timeOffsets)[0]) &&
          origCol.isNumeric
        ) {
          const originalValue = originalItem[origCol.key] || 0;
          const comparisonValue = origCol.isMetric
            ? originalItem?.[
                `${origCol.key}__${ensureIsArray(timeOffsets)[0]}`
              ] || 0
            : originalItem[
                `%${origCol.key.slice(1)}__${ensureIsArray(timeOffsets)[0]}`
              ] || 0;
          const { percentDifferenceNum } = calculateDifferences(
            originalValue as number,
            comparisonValue as number,
          );

          if (selectedColumns) {
            selectedColumns.forEach(col => {
              if (col?.column?.includes(origCol.key)) {
                const { arrow, arrowColor, backgroundColor } =
                  calculateBasicStyle(
                    percentDifferenceNum,
                    col.colorScheme || comparisonColorScheme,
                  );
                item[col.column] = {
                  mainArrow: arrow,
                  arrowColor,
                  backgroundColor,
                };
              }
            });
          } else {
            const { arrow, arrowColor, backgroundColor } = calculateBasicStyle(
              percentDifferenceNum,
              comparisonColorScheme,
            );
            item[`${origCol.key}`] = {
              mainArrow: arrow,
              arrowColor,
              backgroundColor,
            };
          }
        }
      });
      return item;
    });
  });

  const getBasicColorFormatterForColumn = (
    originalData: DataRecord[] | undefined,
    originalColumns: DataColumnMeta[],
    conditionalFormatting?: ConditionalFormattingConfig[],
  ) => {
    const selectedColumns = conditionalFormatting?.filter(
      (config: ConditionalFormattingConfig) =>
        config.column &&
        (config.colorScheme === ColorSchemeEnum.Green ||
          config.colorScheme === ColorSchemeEnum.Red),
    );

    return selectedColumns?.length
      ? getBasicColorFormatter(originalData, originalColumns, selectedColumns)
      : undefined;
  };

  const timeGrain = extractTimegrain(formData);

  const nonCustomNorInheritShifts = ensureIsArray(formData.time_compare).filter(
    (shift: string) => shift !== 'custom' && shift !== 'inherit',
  );
  const customOrInheritShifts = ensureIsArray(formData.time_compare).filter(
    (shift: string) => shift === 'custom' || shift === 'inherit',
  );

  let timeOffsets: string[] = [];

  if (isUsingTimeComparison && !isEmpty(nonCustomNorInheritShifts)) {
    timeOffsets = nonCustomNorInheritShifts;
  }

  // Shifts for custom or inherit time comparison
  if (isUsingTimeComparison && !isEmpty(customOrInheritShifts)) {
    if (customOrInheritShifts.includes('custom')) {
      timeOffsets = timeOffsets.concat([formData.start_date_offset]);
    }
    if (customOrInheritShifts.includes('inherit')) {
      timeOffsets = timeOffsets.concat(['inherit']);
    }
  }
  const comparisonSuffix = isUsingTimeComparison
    ? ensureIsArray(timeOffsets)[0]
    : '';

  const [metrics, percentMetrics, columns] = processColumns(chartProps);
  let comparisonColumns: DataColumnMeta[] = [];
  if (isUsingTimeComparison) {
    comparisonColumns = processComparisonColumns(
      columns,
      chartProps,
      comparisonSuffix,
    );
  }

  let baseQuery;
  let countQuery;
  let totalQuery;
  let rowCount;
  if (serverPagination) {
    // Support optional exact rowcount query (second query) for performance
    if (queriesData.length >= 2 && (queriesData[1] as any)?.is_rowcount) {
      [baseQuery, countQuery, totalQuery] = queriesData;
    } else {
      // Only base query (and possibly totals for aggregate) were returned
      [baseQuery, totalQuery] = queriesData;
      countQuery = undefined as any;
    }
    const exactCount = (countQuery?.data?.[0]?.rowcount as number) ?? undefined;
    if (exactCount !== undefined) {
      rowCount = exactCount;
    } else {
      // Fallback: try baseQuery.rowcount if backend provides it; otherwise lower-bound estimate
      const currentPage = (serverPaginationData as any)?.currentPage ?? 0;
      const effectivePageSize = (serverPaginationData as any)?.pageSize ?? serverPageLength;
      const pageDataLen = baseQuery?.data?.length || 0;
      const lowerBound = currentPage * effectivePageSize + pageDataLen;
      const maybeMore = pageDataLen === effectivePageSize ? effectivePageSize : 0;
      rowCount = (baseQuery?.rowcount as number) ?? (lowerBound + maybeMore);
    }
  } else {
    [baseQuery, totalQuery] = queriesData;
    rowCount = baseQuery?.rowcount ?? 0;
  }
  const data = processDataRecords(baseQuery?.data, columns);
  const comparisonData = processComparisonDataRecords(
    baseQuery?.data,
    columns,
    comparisonSuffix,
  );
  const totals =
    showTotals && queryMode === QueryMode.Aggregate
      ? isUsingTimeComparison
        ? processComparisonTotals(comparisonSuffix, totalQuery?.data)
        : totalQuery?.data[0]
      : undefined;

  const passedData = isUsingTimeComparison ? comparisonData || [] : data;
  const passedColumns = isUsingTimeComparison ? comparisonColumns : columns;

  const basicColorFormatters =
    comparisonColorEnabled && getBasicColorFormatter(baseQuery?.data, columns);
  const columnColorFormatters =
    getColorFormatters(conditionalFormatting, passedData) ??
    defaultColorFormatters;

  const basicColorColumnFormatters = getBasicColorFormatterForColumn(
    baseQuery?.data,
    columns,
    conditionalFormatting,
  );

  const startDateOffset = chartProps.rawFormData?.start_date_offset;
  // prefer new key, fall back to legacy misspelled one
  const fd: any = formData as any;
  const actionsConfig: any = fd.actions_config || {};
  const retainSelectionAcross =
    (typeof retain_selection_across_navigation === 'boolean'
      ? retain_selection_across_navigation
      : (legacy_retain_selection_accross_navigation !== undefined
          ? Boolean(legacy_retain_selection_accross_navigation)
          : (typeof actionsConfig.retain_selection_across_navigation === 'boolean'
              ? actionsConfig.retain_selection_across_navigation
              : false)));

  // Derive action-related settings from actions_config when individual keys are absent
  const derived_enable_bulk_actions =
    fd.enable_bulk_actions ?? actionsConfig.enable_bulk_actions ?? false;
  const derived_enable_table_actions_temp =
    fd.enable_table_actions ?? actionsConfig.enable_table_actions ?? false;
  const derived_selection_enabled =
    fd.selection_enabled ?? actionsConfig.selection_enabled ?? (derived_enable_bulk_actions || derived_enable_table_actions_temp);
  const derived_selection_mode =
    fd.selection_mode ?? actionsConfig.selection_mode ?? 'multiple';
  // Consolidated row ID column with backward compatibility
  const derived_row_id_column =
    fd.row_id_column ?? actionsConfig.row_id_column ?? fd.bulk_action_id_column ?? actionsConfig.bulk_action_id_column ?? fd.table_actions_id_column ?? actionsConfig.table_actions_id_column ?? 'id';
  const derived_bulk_action_label =
    fd.bulk_action_label ?? actionsConfig.bulk_action_label ?? 'Bulk Action';
  const derived_show_split_buttons_in_slice_header =
    fd.show_split_buttons_in_slice_header ?? actionsConfig.show_split_buttons_in_slice_header ?? false;
  // Parse action configs once to avoid repeated JSON.parse in TableChart
  const derived_split_actions =
    parseActionConfig(fd.split_actions ?? actionsConfig.split_actions);
  const derived_non_split_actions =
    parseActionConfig(fd.non_split_actions ?? actionsConfig.non_split_actions);
  const derived_enable_table_actions =
    fd.enable_table_actions ?? actionsConfig.enable_table_actions ?? false;
  const derived_hide_row_id_column =
    fd.hide_row_id_column ?? actionsConfig.hide_row_id_column ?? fd.hide_table_actions_id_column ?? actionsConfig.hide_table_actions_id_column ?? false;
  const derived_table_actions =
    parseActionConfig(fd.table_actions ?? actionsConfig.table_actions);

  // Prefer new flag name if provided; default true
  const includeDashboardFilters =
    typeof include_dashboard_filters === 'boolean'
      ? include_dashboard_filters
      : (typeof include_native_filters === 'boolean' ? include_native_filters : true);

  // Build a flattened query params object from native filters and extra form data
  // Sanitize values to avoid propagating unsafe strings into action URLs
  const buildDashboardQueryParams = (
    filters?: Record<string, any>,
    extras?: Record<string, any>,
  ) => {
    const sanitizeParamValue = (v: any) => {
      try {
        let s = String(v ?? '');
        // Remove control chars and limit length
        s = s.replace(/[\u0000-\u001f\u007f]/g, '');
        // Strip common XSS vectors in case downstream renders unsafely
        s = s.replace(/\b(?:javascript|data):/gi, '');
        s = s.replace(/[<>"'`]/g, '');
        if (s.length > 1000) s = s.slice(0, 1000);
        return s;
      } catch {
        return '';
      }
    };
    const params: Record<string, any> = {};
    try {
      // Flatten simple extras commonly used downstream
      const flatCandidates = [
        'time_range',
        'time_grain_sqla',
        'granularity',
        'temporal_columns_lookup',
      ];
      const efd = (filterState as any)?.extraFormData || extras || {};
      flatCandidates.forEach(k => {
        const v = (efd as any)[k];
        if (v !== undefined && v !== null && typeof v !== 'object') params[k] = sanitizeParamValue(v);
      });
      // Join filter array values into comma-separated params for GET-friendly usage
      const nf = (filterState as any)?.filters || filters || {};
      Object.keys(nf || {}).forEach(k => {
        const val = nf[k];
        if (Array.isArray(val)) params[k] = val.map(sanitizeParamValue).join(',');
        else if (val !== undefined && val !== null) params[k] = sanitizeParamValue(val);
      });
    } catch {}
    return params;
  };

  const nativeFilters = filterState?.filters as any;
  const nativeParams = (filterState as any)?.extraFormData || {};
  const dashboardQueryParams = includeDashboardFilters
    ? buildDashboardQueryParams(nativeFilters, nativeParams)
    : {};
  return {
    height,
    width,
    isRawRecords: queryMode === QueryMode.Raw,
    data: passedData,
    totals,
    columns: passedColumns,
    serverPagination,
    metrics,
    percentMetrics,
    serverPaginationData: serverPagination
      ? serverPaginationData
      : defaultServerPaginationData,
    setDataMask,
    alignPositiveNegative,
    colorPositiveNegative,
    showCellBars,
    sortDesc,
    includeSearch,
    rowCount,
    pageSize: serverPagination
      ? (serverPaginationData as any)?.pageSize
        ? (serverPaginationData as any)?.pageSize
        : serverPageLength
      : getPageSize(pageLength, data.length, columns.length),
    filters: filterState.filters,
    emitCrossFilters,
    onChangeFilter,
    columnColorFormatters,
    timeGrain,
    allowRearrangeColumns,
    allowRenderHtml,
    onContextMenu,
    isUsingTimeComparison,
    basicColorFormatters,
    startDateOffset,
    basicColorColumnFormatters,
    // Global includeNativeFilters deprecated; handled per-action. Still pass native filters for per-action use.
    nativeFilters,
    nativeParams,
    dashboardQueryParams,
    // Add bulk action props
    showSearchColumnSelector: Boolean(show_search_column_select ?? enable_server_search_column_selector),
    enable_bulk_actions: derived_enable_bulk_actions,
    selection_enabled: derived_selection_enabled,
    row_id_column: derived_row_id_column,
    bulk_action_label: derived_bulk_action_label,
    selection_mode: derived_selection_mode,
    split_actions: derived_split_actions,
    non_split_actions: derived_non_split_actions,
    enable_table_actions: derived_enable_table_actions,
    hide_row_id_column: derived_hide_row_id_column,
    table_actions: derived_table_actions,
    include_row_numbers,
    slice_id,
    show_split_buttons_in_slice_header: derived_show_split_buttons_in_slice_header,
    retain_selection_across_navigation: retainSelectionAcross
    ,
    // description passthrough
    show_description,
    description_markdown,
    // Global openInNewTab (legacy) used as fallback when per-action setting not provided
    openInNewTab: Boolean(open_action_url_in_new_tab),
    // Default humanize to true when undefined or null
    humanizeHeaders: ((formData as any)?.humanize_headers ?? true) !== false,
    enableColumnVisibility: Boolean(enable_column_visibility),
    enableColumnResize: Boolean(enable_column_resize),
    enableHighlightSearch: Boolean(enable_highlight_search),
    enableQuickFilters: Boolean(enable_quick_filters),
    enableInvertSelection: Boolean(enable_invert_selection),
    enablePinColumns: Boolean(enable_pin_columns),
    enableAdvancedColumnFilters: Boolean((formData as any)?.enable_advanced_column_filters),
    enableContextMenuExport: Boolean((formData as any)?.enable_context_menu_export ?? true),
    // Experimental drill features (guarded)
    enableDrillFeatures: Boolean((formData as any)?.enable_drill_features),
  } as any;
};

export default transformProps;

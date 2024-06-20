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
  DataRecord,
  ensureIsArray,
  extractTimegrain,
  GenericDataType,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  NumberFormats,
  QueryMode,
  t,
  SMART_DATE_ID,
  TimeFormats,
  TimeFormatter,
  SimpleAdhocFilter,
  getTimeOffset,
  parseDttmToDate,
} from '@superset-ui/core';
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
} from './types';

const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    x => x[key] === null || x[key] === undefined || typeof x[key] === 'number',
  );
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
        // Convert datetime with a custom date class so we can use `String(...)`
        // formatted value for global search, and `date.getTime()` for sorting.
        datum[key] = new DateWithFormatter(x[key], {
          formatter: formatter as TimeFormatter,
        });
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

const processColumns = memoizeOne(function processColumns(
  props: TableChartProps,
) {
  const {
    datasource: { columnFormats, currencyFormats, verboseMap },
    rawFormData: {
      table_timestamp_format: tableTimestampFormat,
      metrics: metrics_,
      percent_metrics: percentMetrics_,
      column_config: columnConfig = {},
    },
    queriesData,
  } = props;
  const granularity = extractTimegrain(props.rawFormData);
  const { data: records, colnames, coltypes } = queriesData[0] || {};
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
      key =>
        // if a metric was only added to percent_metrics, they should not show up in the table.
        !(rawPercentMetricsSet.has(key) && !metricsSet.has(key)),
    )
    .map((key: string, i) => {
      const dataType = coltypes[i];
      const config = columnConfig[key] || {};
      // for the purpose of presentation, only numeric values are treated as metrics
      // because users can also add things like `MAX(str_col)` as a metric.
      const isMetric = metricsSet.has(key) && isNumeric(key, records);
      const isPercentMetric = percentMetricsSet.has(key);
      const label =
        isPercentMetric && verboseMap?.hasOwnProperty(key.replace('%', ''))
          ? `%${verboseMap[key.replace('%', '')]}`
          : verboseMap?.[key] || key;
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

const processComparisonColumns = (
  columns: DataColumnMeta[],
  props: TableChartProps,
  comparisonSuffix: string,
) =>
  columns
    .map(col => {
      const {
        datasource: { columnFormats },
        rawFormData: { column_config: columnConfig = {} },
      } = props;
      const config = columnConfig[col.key] || {};
      const savedFormat = columnFormats?.[col.key];
      const numberFormat = config.d3NumberFormat || savedFormat;
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
          },
          {
            ...col,
            label: `#`,
            key: `# ${col.key}`,
          },
          {
            ...col,
            label: `△`,
            key: `△ ${col.key}`,
          },
          {
            ...col,
            formatter: getNumberFormatter(numberFormat || PERCENT_3_POINT),
            label: `%`,
            key: `% ${col.key}`,
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
  } = chartProps;

  const {
    align_pn: alignPositiveNegative = true,
    color_pn: colorPositiveNegative = true,
    show_cell_bars: showCellBars = true,
    include_search: includeSearch = false,
    page_length: pageLength,
    server_pagination: serverPagination = false,
    server_page_length: serverPageLength = 10,
    order_desc: sortDesc = false,
    query_mode: queryMode,
    show_totals: showTotals,
    conditional_formatting: conditionalFormatting,
    allow_rearrange_columns: allowRearrangeColumns,
    allow_render_html: allowRenderHtml,
    time_compare,
    comparison_color_enabled: comparisonColorEnabled = false,
    comparison_color_scheme: comparisonColorScheme = ColorSchemeEnum.Green,
    comparison_type,
  } = formData;
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
  const TimeRangeFilters =
    chartProps.rawFormData?.adhoc_filters?.filter(
      (filter: SimpleAdhocFilter) => filter.operator === 'TEMPORAL_RANGE',
    ) || [];
  const previousCustomTimeRangeFilters: any =
    chartProps.rawFormData?.adhoc_custom?.filter(
      (filter: SimpleAdhocFilter) => filter.operator === 'TEMPORAL_RANGE',
    ) || [];

  let previousCustomStartDate = '';
  if (
    !isEmpty(previousCustomTimeRangeFilters) &&
    previousCustomTimeRangeFilters[0]?.comparator !== 'No Filter'
  ) {
    previousCustomStartDate =
      previousCustomTimeRangeFilters[0]?.comparator.split(' : ')[0];
  }

  const timeOffsets = getTimeOffset({
    timeRangeFilter: TimeRangeFilters[0],
    shifts: formData.time_compare,
    startDate:
      previousCustomStartDate && !formData.start_date_offset
        ? parseDttmToDate(previousCustomStartDate)?.toUTCString()
        : formData.start_date_offset,
  });
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
    [baseQuery, countQuery, totalQuery] = queriesData;
    rowCount = (countQuery?.data?.[0]?.rowcount as number) ?? 0;
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
      ? serverPageLength
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
  };
};

export default transformProps;

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
  Currency,
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
  SMART_DATE_ID,
  t,
  TimeFormats,
  TimeFormatter,
} from '@superset-ui/core';

import { isEmpty, isEqual } from 'lodash';
import isEqualColumns from './utils/isEqualColumns';
import DateWithFormatter from './utils/DateWithFormatter';
import {
  DataColumnMeta,
  TableChartProps,
  AgGridTableChartTransformedProps,
  TableColumnConfig,
} from './types';

const { PERCENT_3_POINT } = NumberFormats;
const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    x => x[key] === null || x[key] === undefined || typeof x[key] === 'number',
  );
}

function isPositiveNumber(value: string | number | null | undefined) {
  const num = Number(value);
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !Number.isNaN(num) &&
    num > 0
  );
}

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
      const originalLabel = col.label;
      if (
        (col.isMetric || col.isPercentMetric) &&
        !col.key.includes(comparisonSuffix) &&
        col.isNumeric
      ) {
        return [
          {
            ...col,
            originalLabel,
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
            originalLabel,
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
            originalLabel,
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
            originalLabel,
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

const serverPageLengthMap = new Map();

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

const transformProps = (
  chartProps: TableChartProps,
): AgGridTableChartTransformedProps => {
  const {
    height,
    width,
    rawFormData: formData,
    queriesData = [],
    ownState: serverPaginationData,
    filterState,
    hooks: { setDataMask = () => {} },
    emitCrossFilters,
  } = chartProps;

  const {
    include_search: includeSearch = false,
    page_length: pageLength,
    order_desc: sortDesc = false,
    allow_rearrange_columns: allowRearrangeColumns,
    slice_id,
    time_compare,
    comparison_type,
    server_pagination: serverPagination = false,
    server_page_length: serverPageLength = 10,
    query_mode: queryMode,
    align_pn: alignPositiveNegative = true,
    show_cell_bars: showCellBars = true,
    color_pn: colorPositiveNegative = true,
  } = formData;

  const isUsingTimeComparison =
    !isEmpty(time_compare) &&
    queryMode === QueryMode.Aggregate &&
    comparison_type === ComparisonType.Values;

  let hasServerPageLengthChanged = false;

  const pageLengthFromMap = serverPageLengthMap.get(slice_id);
  if (!isEqual(pageLengthFromMap, serverPageLength)) {
    serverPageLengthMap.set(slice_id, serverPageLength);
    hasServerPageLengthChanged = true;
  }

  const [, percentMetrics, columns] = processColumns(chartProps);

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
  let rowCount;
  if (serverPagination) {
    [baseQuery, countQuery] = queriesData;
    rowCount = (countQuery?.data?.[0]?.rowcount as number) ?? 0;
  } else {
    [baseQuery] = queriesData;
    rowCount = baseQuery?.rowcount ?? 0;
  }

  const data = processDataRecords(baseQuery?.data, columns);
  const comparisonData = processComparisonDataRecords(
    baseQuery?.data,
    columns,
    comparisonSuffix,
  );

  const passedData = isUsingTimeComparison ? comparisonData || [] : data;
  const passedColumns = isUsingTimeComparison ? comparisonColumns : columns;

  const hasPageLength = isPositiveNumber(pageLength);

  return {
    height,
    width,
    data: passedData,
    columns: passedColumns,
    percentMetrics,
    setDataMask,
    sortDesc,
    includeSearch,
    pageSize: getPageSize(pageLength, data.length, columns.length),
    filters: filterState.filters,
    emitCrossFilters,
    allowRearrangeColumns,
    slice_id,
    serverPagination,
    rowCount,
    serverPaginationData,
    hasServerPageLengthChanged,
    serverPageLength,
    hasPageLength,
    timeGrain,
    isRawRecords: queryMode === QueryMode.Raw,
    alignPositiveNegative,
    showCellBars,
    isUsingTimeComparison,
    colorPositiveNegative,
  };
};

export default transformProps;

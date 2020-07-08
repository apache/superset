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
import { DataRecord } from '@superset-ui/chart';
import { QueryFormDataMetric } from '@superset-ui/query';
import { getNumberFormatter, NumberFormats } from '@superset-ui/number-format';
import {
  getTimeFormatter,
  smartDateFormatter,
  getTimeFormatterForGranularity,
  TimeFormatter,
} from '@superset-ui/time-format';

import isEqualArray from './utils/isEqualArray';
import DateWithFormatter from './utils/DateWithFormatter';
import { TableChartProps, TableChartTransformedProps, DataType, DataColumnMeta } from './types';

const { PERCENT_3_POINT } = NumberFormats;
const TIME_COLUMN = '__timestamp';

/**
 * Consolidate list of metrics to string, identified by its unique identifier
 */
function getMetricIdentifier(metric: QueryFormDataMetric) {
  if (typeof metric === 'string') return metric;
  // even though `metric.optionName` is more unique, it's not used
  // anywhere else in `queryData` and cannot be used to access `data.records`.
  // The records are still keyed by `metric.label`.
  return metric.label || 'NOT_LABELED';
}

function isTimeColumn(key: string) {
  return key === TIME_COLUMN;
}

const REGEXP_DATETIME = /^\d{4}-[01]\d-[03]\d/;
function isTimeType(key: string, data: DataRecord[] = []) {
  return (
    isTimeColumn(key) ||
    data.some(x => {
      const value = x[key];
      return value instanceof Date || (typeof value === 'string' && REGEXP_DATETIME.test(value));
    })
  );
}

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(x => x[key] === null || x[key] === undefined || typeof x[key] === 'number');
}

const processDataRecords = memoizeOne(function processDataRecords(
  data: DataRecord[] | undefined,
  columns: DataColumnMeta[],
) {
  if (!data || !data[0]) {
    return data || [];
  }
  const timeColumns = columns.filter(column => column.dataType === DataType.DateTime);

  if (timeColumns.length > 0) {
    return data.map(x => {
      const datum = { ...x };
      timeColumns.forEach(({ key, formatter }) => {
        // Convert datetime with a custom date class so we can use `String(...)`
        // formatted value for global search, and `date.getTime()` for sorting.
        datum[key] = new DateWithFormatter(x[key], { formatter: formatter as TimeFormatter });
      });
      return datum;
    });
  }
  return data;
});

const isEqualColumns = <T extends TableChartProps[]>(propsA: T, propsB: T) => {
  const a = propsA[0];
  const b = propsB[0];
  return (
    a.datasource.columnFormats === b.datasource.columnFormats &&
    a.datasource.verboseMap === b.datasource.verboseMap &&
    a.formData.tableTimestampFormat === b.formData.tableTimestampFormat &&
    a.formData.timeGrainSqla === b.formData.timeGrainSqla &&
    isEqualArray(a.formData.metrics, b.formData.metrics) &&
    isEqualArray(a.queryData?.data?.columns, b.queryData?.data?.columns)
  );
};

const processColumns = memoizeOne(function processColumns(props: TableChartProps) {
  const {
    datasource: { columnFormats, verboseMap },
    formData: {
      tableTimestampFormat,
      timeGrainSqla: granularity,
      metrics: metrics_,
      percentMetrics: percentMetrics_,
    },
    queryData: { data: { records, columns: columns_ } = {} } = {},
  } = props;
  // convert `metrics` and `percentMetrics` to the key names in `data.records`
  const metrics = (metrics_ ?? []).map(getMetricIdentifier);
  const percentMetrics = (percentMetrics_ ?? [])
    .map(getMetricIdentifier)
    // column names for percent metrics always starts with a '%' sign.
    .map((x: string) => `%${x}`);
  const metricsSet = new Set(metrics);
  const percentMetricsSet = new Set(percentMetrics);

  const columns: DataColumnMeta[] = (columns_ || []).map((key: string) => {
    let label = verboseMap?.[key] || key;
    if (label[0] === '%' && label[1] !== ' ') {
      // add a " " after "%" for percent metric labels
      label = `% ${label.slice(1)}`;
    }
    // fallback to column level formats defined in datasource
    const format = columnFormats?.[key];
    const isTime = isTimeType(key, records);
    // for the purpose of presentation, only numeric values are treated as metrics
    const isMetric = metricsSet.has(key) && isNumeric(key, records);
    const isPercentMetric = percentMetricsSet.has(key);
    let dataType = DataType.Number; // TODO: get this from data source
    let formatter;
    if (isTime) {
      // Use granularity for "Adaptive Formatting" (smart_date)
      const timeFormat = format || tableTimestampFormat;
      formatter = getTimeFormatter(timeFormat);
      if (timeFormat === smartDateFormatter.id) {
        if (isTimeColumn(key)) {
          formatter = getTimeFormatterForGranularity(granularity);
        } else if (format) {
          formatter = getTimeFormatter(format);
        } else {
          // return the identity string when datasource level formatter is not set
          // and table timestamp format is set to Adaptive Formatting
          formatter = String;
        }
      }
      dataType = DataType.DateTime;
    } else if (isMetric) {
      formatter = getNumberFormatter(format);
    } else if (isPercentMetric) {
      // percent metrics have a default format
      formatter = getNumberFormatter(format || PERCENT_3_POINT);
    } else {
      dataType = DataType.String;
    }
    return {
      key,
      label,
      dataType,
      formatter,
    };
  });
  return [
    metrics,
    percentMetrics,
    columns,
  ] as [typeof metrics, typeof percentMetrics, typeof columns];
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
    return pageSize || 0;
  }
  if (typeof pageSize === 'string') {
    return Number(pageSize) || 0;
  }
  // when pageSize not set, automatically add pagination if too many records
  return numRecords * numColumns > 10000 ? 200 : 0;
};

export default function transformProps(chartProps: TableChartProps): TableChartTransformedProps {
  const {
    height,
    width,
    formData,
    queryData,
    initialValues: filters = {},
    hooks: { onAddFilter: onChangeFilter },
  } = chartProps;

  const {
    alignPn: alignPositiveNegative = true,
    colorPn: colorPositiveNegative = true,
    showCellBars = true,
    includeSearch = false,
    pageLength: pageSize = 0,
    tableFilter,
    orderDesc: sortDesc = false,
  } = formData;

  const [metrics, percentMetrics, columns] = processColumns(chartProps);
  const data = processDataRecords(queryData?.data?.records, columns);

  return {
    height,
    width,
    data,
    columns,
    metrics,
    percentMetrics,
    alignPositiveNegative,
    colorPositiveNegative,
    showCellBars,
    sortDesc,
    includeSearch,
    pageSize: getPageSize(pageSize, data.length, columns.length),
    filters,
    emitFilter: tableFilter === true,
    onChangeFilter,
  };
}

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
import { ChartProps, DataRecord, DataRecordFilters } from '@superset-ui/chart';
import { QueryFormDataMetric } from '@superset-ui/query';

interface DataColumnMeta {
  // `key` is what is called `label` in the input props
  key: string;
  // `label` is verbose column name used for rendering
  label: string;
  format?: string;
}

interface TableChartData {
  records: DataRecord[];
  columns: string[];
}

interface TableChartFormData {
  alignPn?: boolean;
  colorPn?: boolean;
  includeSearch?: boolean;
  orderDesc?: boolean;
  pageLength?: string | number;
  metrics?: QueryFormDataMetric[] | null;
  percentMetrics?: QueryFormDataMetric[] | null;
  showCellBars?: boolean;
  tableTimestampFormat?: string;
  tableFilter?: boolean;
}

export interface DataTableProps {
  // Each object is { field1: value1, field2: value2 }
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  columns: DataColumnMeta[];
  data: DataRecord[];
  height: number;
  includeSearch: boolean;
  metrics: string[];
  orderDesc: boolean;
  pageLength: number;
  percentMetrics: string[];
  showCellBars: boolean;
  tableTimestampFormat?: string;
  // timeseriesLimitMetric: string | object;
  // These are dashboard filters, don't be confused with in-chart search filter
  filters: DataRecordFilters;
  emitFilter: boolean;
  onChangeFilter: ChartProps['hooks']['onAddFilter'];
}

export type TableChartProps = ChartProps & {
  formData: TableChartFormData;
  queryData: ChartProps['queryData'] & {
    data?: TableChartData;
  };
};

/**
 * Consolidate list of metrics to string, identified by its unique identifier
 */
const consolidateMetricShape = (metric: QueryFormDataMetric) => {
  if (typeof metric === 'string') return metric;
  // even thought `metric.optionName` is more unique, it's not used
  // anywhere else in `queryData` and cannot be used to access `data.records`.
  // The records are still keyed by `metric.label`.
  return metric.label || 'NOT_LABLED';
};

export default function transformProps(chartProps: TableChartProps): DataTableProps {
  const {
    height,
    datasource,
    formData,
    queryData,
    initialValues: filters = {},
    hooks: { onAddFilter: onChangeFilter = () => {} },
  } = chartProps;
  const {
    alignPn = true,
    colorPn = true,
    showCellBars = true,
    includeSearch = false,
    orderDesc = false,
    pageLength = 0,
    metrics: metrics_ = [],
    percentMetrics: percentMetrics_ = [],
    tableTimestampFormat,
    tableFilter,
  } = formData;
  const { columnFormats, verboseMap } = datasource;
  const { records, columns: columns_ } = queryData.data || { records: [], columns: [] };

  const metrics = (metrics_ ?? []).map(consolidateMetricShape);
  // percent metrics always starts with a '%' sign.
  const percentMetrics = (percentMetrics_ ?? [])
    .map(consolidateMetricShape)
    .map((x: string) => `%${x}`);

  const columns = columns_.map((key: string) => {
    let label = verboseMap?.[key] || key;
    // make sure there is a " " after "%" for percent metrics
    if (label[0] === '%' && label[1] !== ' ') {
      label = `% ${label.slice(1)}`;
    }
    return {
      key,
      label,
      format: columnFormats?.[key],
    };
  });

  return {
    height,
    data: records,
    columns,
    metrics,
    percentMetrics,
    alignPositiveNegative: alignPn,
    colorPositiveNegative: colorPn,
    showCellBars,
    includeSearch,
    orderDesc,
    pageLength: typeof pageLength === 'string' ? parseInt(pageLength, 10) || 0 : 0,
    tableTimestampFormat,
    filters,
    emitFilter: tableFilter === true,
    onChangeFilter,
  };
}

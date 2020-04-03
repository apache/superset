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
import { ChartProps } from '@superset-ui/chart';
import { QueryFormDataMetric } from '@superset-ui/query';

interface DataRecord {
  [key: string]: any;
}

interface DataColumnMeta {
  // `key` is what is called `label` in the input props
  key: string;
  // `label` is verbose column name used for rendering
  label: string;
  format?: string;
}

export interface DataTableProps {
  // Each object is { field1: value1, field2: value2 }
  data: DataRecord[];
  height: number;
  alignPositiveNegative: boolean;
  colorPositiveNegative: boolean;
  columns: DataColumnMeta[];
  metrics: string[];
  percentMetrics: string[];
  includeSearch: boolean;
  orderDesc: boolean;
  pageLength: number;
  tableTimestampFormat?: string;
  // TODO: add filters back or clean up
  // filters: object;
  // onAddFilter?: (key: string, value: number[]) => void;
  // onRemoveFilter?: (key: string, value: number[]) => void;
  // tableFilter: boolean;
  // timeseriesLimitMetric: string | object;
}

export interface TableChartFormData {
  alignPn?: boolean;
  colorPn?: boolean;
  includeSearch?: boolean;
  orderDesc?: boolean;
  pageLength?: string;
  metrics?: QueryFormDataMetric[];
  percentMetrics?: QueryFormDataMetric[];
  tableTimestampFormat?: string;
}

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

export default function transformProps(chartProps: ChartProps): DataTableProps {
  const { height, datasource, formData, queryData } = chartProps;

  const {
    alignPn = true,
    colorPn = true,
    includeSearch = false,
    orderDesc = false,
    pageLength = 0,
    metrics: metrics_ = [],
    percentMetrics: percentMetrics_ = [],
    tableTimestampFormat,
  } = formData as TableChartFormData;
  const { columnFormats, verboseMap } = datasource;
  const {
    records,
    columns: columns_,
  }: { records: DataRecord[]; columns: string[] } = queryData.data;
  const metrics = (metrics_ ?? []).map(consolidateMetricShape);
  // percent metrics always starts with a '%' sign.
  const percentMetrics = (percentMetrics_ ?? [])
    .map(consolidateMetricShape)
    .map((x: string) => `%${x}`);
  const columns = columns_.map((key: string) => {
    let label = verboseMap[key] || key;
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
    includeSearch,
    orderDesc,
    pageLength: pageLength ? parseInt(pageLength, 10) : 0,
    tableTimestampFormat,
  };
}

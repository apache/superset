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
import { QueryFormDataMetric } from '@superset-ui/query';
import { ChartProps, DataRecord, DataRecordValue, DataRecordFilters } from '@superset-ui/chart';
import { TimeFormatter, TimeGranularity } from '@superset-ui/time-format';
import { NumberFormatter } from '@superset-ui/number-format';

export enum DataType {
  Number = 'number',
  String = 'string',
  DateTime = 'datetime',
}

export type CustomFormatter = (value: DataRecordValue) => string;

export interface DataColumnMeta {
  // `key` is what is called `label` in the input props
  key: string;
  // `label` is verbose column name used for rendering
  label: string;
  dataType: DataType;
  formatter?: TimeFormatter | NumberFormatter | CustomFormatter;
}

export interface TableChartData<D extends DataRecord = DataRecord> {
  records: D[];
  columns: string[];
}

export interface TableChartFormData {
  alignPn?: boolean;
  colorPn?: boolean;
  includeSearch?: boolean;
  pageLength?: string | number | null; // null means auto-paginate
  metrics?: QueryFormDataMetric[] | null;
  percentMetrics?: QueryFormDataMetric[] | null;
  orderDesc?: boolean;
  showCellBars?: boolean;
  tableTimestampFormat?: string;
  tableFilter?: boolean;
  timeGrainSqla?: TimeGranularity;
}

export interface TableChartProps<D extends DataRecord = DataRecord> extends ChartProps {
  formData: TableChartFormData;
  queryData: ChartProps['queryData'] & {
    data?: TableChartData<D>;
  };
}

export interface TableChartTransformedProps<D extends DataRecord = DataRecord> {
  height: number;
  width: number;
  data: D[];
  columns: DataColumnMeta[];
  metrics?: (keyof D)[];
  percentMetrics?: (keyof D)[];
  pageSize?: number;
  showCellBars?: boolean;
  sortDesc?: boolean;
  includeSearch?: boolean;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  tableTimestampFormat?: string;
  // These are dashboard filters, don't be confused with in-chart search filter
  // enabled by `includeSearch`
  filters?: DataRecordFilters;
  emitFilter?: boolean;
  onChangeFilter?: ChartProps['hooks']['onAddFilter'];
}

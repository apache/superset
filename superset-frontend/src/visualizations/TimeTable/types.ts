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

export interface ColumnConfig {
  key: string;
  label?: string;
  d3format?: string;
  colType?: string;
  comparisonType?: string;
  bounds?: [number | null, number | null] | null[];
  timeRatio?: string | number;
  timeLag?: number;
  tooltip?: string;
  width?: string;
  height?: string;
  dateFormat?: string;
  yAxisBounds?: [number | undefined, number | undefined] | null[];
  showYAxis?: boolean;
}

export interface ColumnRow {
  label?: string;
  column_name?: string;
  [key: string]: any;
}

export interface MetricRow {
  label?: string;
  metric_name: string;
  verbose_name?: string;
  expression?: string;
  warning_text?: string;
  description?: string;
  d3format?: string;
  is_certified?: boolean;
  certified_by?: string;
  certification_details?: string;
  [key: string]: any;
}

export type Row = ColumnRow | MetricRow;

export interface TimeTableData {
  [timestamp: string]: {
    [metric: string]: number;
  };
}

export interface TimeTableProps {
  className?: string;
  height?: number;
  data: TimeTableData;
  columnConfigs: ColumnConfig[];
  rowType: 'column' | 'metric';
  rows: Row[];
  url?: string;
}

export interface Entry {
  time: string;
  [metric: string]: any;
}

export interface Stats {
  count: number;
  sum: number;
}

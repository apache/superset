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
import type {
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import type { Slot } from './buckets';

type RGBColor = { r: number; g: number; b: number };

export type UsageSummaryFormData = QueryFormData & {
  x_axis?: QueryFormColumn;
  metric: QueryFormMetric;
  success_metric?: QueryFormMetric | null;
  failed_metric?: QueryFormMetric | null;
  success_color?: RGBColor;
  failed_color?: RGBColor;
  header?: string;
  bucket_sizes?: string;
  value_unit?: string;
  color_picker?: RGBColor;
};

export interface UsageSummaryProps {
  height: number;
  width: number;
  /** Totals per hour or per day, see `step`. */
  slots: Slot[];
  /** Length of one slot in ms: HOUR_MS for short time ranges, else DAY_MS. */
  step: number;
  /** The time filter's exact range, epoch ms (end exclusive); absent with "No filter". */
  period?: { from: number; to: number };
  /** Label above the total, e.g. "Consumed API calls". */
  title: string;
  /** Bucket sizes in days offered by the toggle, e.g. [1, 3]. Daily slots only. */
  bucketSizes: number[];
  barColor: string;
  /** Word after the value in the tooltip, e.g. "calls". */
  valueUnit: string;
  /** Success / failed totals for the status panel; absent when not configured. */
  status?: {
    success: number;
    failed: number;
    successColor: string;
    failedColor: string;
  };
}

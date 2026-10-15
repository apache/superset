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
  DataRecord,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

export type UsageDrilldownFormData = QueryFormData & {
  groupby: QueryFormColumn[];
  metric: QueryFormMetric;
  link_column?: QueryFormColumn | null;
  badge_column?: QueryFormColumn | null;
  subtitle_columns?: QueryFormColumn[];
  duration_column?: QueryFormColumn | null;
  title_prefix?: string;
};

export interface DrilldownLevel {
  /** Column label as it appears in the result rows. */
  key: string;
  /** Human-friendly name, e.g. "Project". */
  label: string;
}

export interface UsageDrilldownProps {
  height: number;
  width: number;
  data: DataRecord[];
  levels: DrilldownLevel[];
  metricKey: string;
  metricLabel: string;
  linkKey?: string;
  /** Badge (e.g. HTTP method) and sub-line columns, shown on the last level. */
  badgeKey?: string;
  subtitleKeys: string[];
  /** Whether the query includes the duration metrics (see consts.ts). */
  hasDuration: boolean;
  titlePrefix: string;
}

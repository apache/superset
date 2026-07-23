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

import {
  QueryFormMetric,
  getMetricLabel,
  SqlaFormData,
} from '@superset-ui/core';

export interface MetricColumnFilterParams {
  colname: string;
  colnames: string[];
  formData: SqlaFormData;
}

/**
 * Determines if a column should be skipped based on metric filtering logic.
 *
 * This function implements the logic to skip unprefixed percent metric columns
 * if a prefixed version exists, but doesn't skip if it's also a regular metric.
 *
 * @param params - The parameters for metric column filtering
 * @returns true if the column should be skipped, false otherwise
 */
export function shouldSkipMetricColumn({
  colname,
  colnames,
  formData,
}: MetricColumnFilterParams): boolean {
  if (!colname) {
    return false;
  }

  // Check if this column name exists as a percent metric in form data
  const isPercentMetric = formData.percent_metrics?.some(
    (metric: QueryFormMetric) => getMetricLabel(metric) === colname,
  );

  // Check if this column name exists as a regular metric in form data
  const isRegularMetric = formData.metrics?.some(
    (metric: QueryFormMetric) => getMetricLabel(metric) === colname,
  );

  // Check if there's a prefixed version of this column in the column list
  const hasPrefixedVersion = colnames.includes(`%${colname}`);

  // Skip if: has prefixed version AND is percent metric AND is NOT regular metric
  return hasPrefixedVersion && isPercentMetric && !isRegularMetric;
}

/**
 * Determines if a column is a regular metric.
 *
 * @param colname - The column name to check
 * @param formData - The form data containing metrics
 * @returns true if the column is a regular metric, false otherwise
 */
export function isRegularMetric(
  colname: string,
  formData: SqlaFormData,
): boolean {
  return !!formData.metrics?.some(metric => getMetricLabel(metric) === colname);
}

/**
 * Determines if a column is a percentage metric.
 *
 * @param colname: string,
 * @param formData - The form data containing percent_metrics
 * @returns true if the column is a percentage metric, false otherwise
 */
export function isPercentMetric(
  colname: string,
  formData: SqlaFormData,
): boolean {
  return !!formData.percent_metrics?.some(
    (metric: QueryFormMetric) => `%${getMetricLabel(metric)}` === colname,
  );
}

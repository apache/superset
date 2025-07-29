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

import { QueryFormMetric } from '@superset-ui/core';

export const getMetricDisplayName = (
  metric: QueryFormMetric,
  verboseMap: Record<string, string> = {},
): string => {
  // Case 1: Simple string metric - use verboseMap or the string itself
  if (typeof metric === 'string') {
    return verboseMap[metric] || metric;
  }

  // Case 2: Metric with explicit label - always prefer this if available
  if (metric.label) {
    return metric.label;
  }

  // Case 3: SIMPLE expression type (column with aggregate)
  if (metric.expressionType === 'SIMPLE') {
    const column = metric.column || {};
    const columnName = column.column_name || '';
    // Use verbose name from column if available
    const displayName = column.verbose_name || columnName;
    const aggregate = metric.aggregate || '';

    // If the verbose map has this column, use that
    if (verboseMap[columnName]) {
      return `${aggregate}(${verboseMap[columnName]})`;
    }

    return `${aggregate}(${displayName})`;
  }

  // Case 4: SQL expression
  if (metric.expressionType === 'SQL') {
    return metric.sqlExpression || 'Custom SQL Metric';
  }

  // Fallback
  return 'Unknown Metric';
};

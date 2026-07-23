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
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { QueryFormData } from '@superset-ui/core';

export interface FetchTopNValuesParams {
  datasource: string;
  column: string;
  metric: string;
  limit: number;
  sortAscending?: boolean;
  filters?: any[];
  timeRange?: string;
}

export interface TopNValue {
  value: string | number;
  metricValue: number;
}

/**
 * Fetches the top N values for a dimension sorted by a metric.
 * Based on the pattern used in dashboard Select filters.
 */
export async function fetchTopNValues({
  datasource,
  column,
  metric,
  limit,
  sortAscending = false,
  filters = [],
  timeRange,
}: FetchTopNValuesParams): Promise<TopNValue[]> {
  const formData: Partial<QueryFormData> = {
    datasource,
    groupby: [column],
    metrics: [metric],
    adhoc_filters: filters,
    time_range: timeRange,
    row_limit: limit,
    orderby: [[metric, sortAscending]], // false for DESC, true for ASC
    viz_type: 'table', // Use table viz type for simple data fetching
  };

  try {
    const response = await getChartDataRequest({
      formData: formData as QueryFormData,
      force: false,
    });

    // Handle the response based on the structure
    const result = response.json?.result?.[0];
    if (!result || !result.data) {
      return [];
    }

    // Extract values from the response data
    // The data is typically an array of objects with column names as keys
    return result.data.map((row: any) => ({
      value: row[column],
      metricValue: row[metric],
    }));
  } catch (error) {
    console.error('Error fetching top N values:', error);
    throw error;
  }
}

/**
 * Extracts just the dimension values from TopNValue array
 */
export function extractDimensionValues(
  topNValues: TopNValue[],
): (string | number)[] {
  return topNValues.map(item => item.value);
}

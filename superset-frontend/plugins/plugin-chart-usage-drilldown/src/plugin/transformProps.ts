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
import { ChartProps, getColumnLabel, getMetricLabel } from '@superset-ui/core';
import { UsageDrilldownFormData, UsageDrilldownProps } from '../types';

// "project_name" -> "Project", "api_name" -> "API"
function humanize(column: string): string {
  const words = column
    .replace(/_(name|id)$/i, '')
    .split('_')
    .filter(Boolean);
  return words
    .map(word =>
      word.length <= 3
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export default function transformProps(
  chartProps: ChartProps,
): UsageDrilldownProps {
  const { width, height, rawFormData, queriesData, datasource } = chartProps;
  const {
    groupby = [],
    metric,
    link_column: linkColumn,
    badge_column: badgeColumn,
    subtitle_columns: subtitleColumns = [],
    duration_column: durationColumn,
    title_prefix: titlePrefix,
    url_params: urlParams,
  } = rawFormData as UsageDrilldownFormData;
  const verboseMap: Record<string, string> = datasource?.verboseMap ?? {};

  // verboseMap falls back to the column name itself when no verbose name is set.
  const allLevels = groupby.map(column => {
    const key = getColumnLabel(column);
    const verbose = verboseMap[key];
    return { key, label: verbose && verbose !== key ? verbose : humanize(key) };
  });
  // ?drilldown_from=workflow starts at that level, e.g. when the embedding page
  // is already scoped to one project. Matches a column name or its label.
  const from = String(urlParams?.drilldown_from ?? '').toLowerCase();
  const start = from
    ? allLevels.findIndex(
        ({ key, label }) =>
          key.toLowerCase() === from ||
          humanize(key).toLowerCase() === from ||
          label.toLowerCase() === from,
      )
    : -1;
  const levels = start > 0 ? allLevels.slice(start) : allLevels;
  const metricKey = getMetricLabel(metric);

  return {
    width,
    height,
    data: queriesData[0]?.data ?? [],
    levels,
    metricKey,
    metricLabel: verboseMap[metricKey] || metricKey,
    linkKey: linkColumn ? getColumnLabel(linkColumn) : undefined,
    badgeKey: badgeColumn ? getColumnLabel(badgeColumn) : undefined,
    subtitleKeys: subtitleColumns.map(getColumnLabel),
    hasDuration: Boolean(durationColumn),
    titlePrefix: titlePrefix ?? 'Usage by',
  };
}

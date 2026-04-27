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
  ChartProps,
  getColumnLabel,
  getMetricLabel,
  QueryFormColumn,
} from '@superset-ui/core';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  parseMetricValue,
} from '../transformUtils';

interface H3Feature {
  hexagon: string;
  fillColor?: number[];
  elevation?: number;
  [key: string]: unknown;
}

export default function transformProps(chartProps: ChartProps) {
  const { formData } = chartProps;
  const { h3_index: h3IndexRaw, metric, js_columns: jsColumns } = formData;

  const records = getRecordsFromQuery(chartProps.queriesData);

  // Resolve the H3 column label, deriving a string consistently
  const h3Index = ((): string | undefined => {
    const column: QueryFormColumn | undefined = Array.isArray(h3IndexRaw)
      ? h3IndexRaw[0]
      : h3IndexRaw;
    if (column) {
      return getColumnLabel(column);
    }
    // Auto-detect H3 column if not specified
    if (records.length > 0) {
      const firstRecord = records[0];
      const possibleH3Keys = Object.keys(firstRecord).filter(
        (key: string) =>
          key.toLowerCase().includes('h3') || key.toLowerCase().includes('hex'),
      );
      if (possibleH3Keys.length > 0) {
        return possibleH3Keys[0];
      }
    }
    return undefined;
  })();

  const metricLabel = metric ? getMetricLabel(metric) : undefined;

  const features: H3Feature[] = records.map((record, index) => {
    const hexagonValue = h3Index ? record[h3Index] : undefined;
    const feature: H3Feature = {
      hexagon: String(hexagonValue || ''),
    };

    if (metricLabel && record[metricLabel] != null) {
      const value = parseMetricValue(record[metricLabel]);
      if (value !== undefined) {
        feature.elevation = value;
      }
    }

    if (jsColumns?.length) {
      jsColumns.forEach((col: string) => {
        if (record[col] !== undefined) {
          feature[col] = record[col];
        }
      });
    }

    Object.keys(record).forEach(key => {
      if (key !== h3Index && key !== metricLabel) {
        feature[key] = record[key];
      }
    });

    return feature;
  });

  const metricLabels = metricLabel ? [metricLabel] : [];

  return createBaseTransformResult(chartProps, features, metricLabels);
}

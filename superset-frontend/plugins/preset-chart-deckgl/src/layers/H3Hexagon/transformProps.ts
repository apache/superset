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
import { isValidCell } from 'h3-js';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  parseMetricValue,
} from '../transformUtils';
import { getH3IndexColumn, H3FormData } from './buildQuery';

export interface H3Feature {
  hexagon: string;
  elevation?: number;
  [key: string]: unknown;
}

// Keys the layer reads from each feature; record fields with the same name
// (e.g. a tooltip column called "hexagon") must not overwrite them.
const RESERVED_FEATURE_KEYS = new Set(['hexagon', 'elevation']);

export default function transformProps(chartProps: ChartProps) {
  const formData = chartProps.rawFormData as H3FormData;
  const { h3_index: h3IndexRaw, metric } = formData;

  const records = getRecordsFromQuery(chartProps.queriesData);

  // Resolve the H3 column label, deriving a string consistently
  const h3Index = ((): string | undefined => {
    const column = getH3IndexColumn(h3IndexRaw);
    if (column) {
      return getColumnLabel(column);
    }
    // Auto-detect H3 column if not specified
    if (records.length > 0) {
      const possibleH3Keys = Object.keys(records[0]).filter(
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

  const features: H3Feature[] = records.flatMap(record => {
    const hexagonValue = h3Index ? record[h3Index] : undefined;
    const hexagon = hexagonValue == null ? '' : String(hexagonValue);

    // Drop rows whose H3 index is missing or malformed: the deck.gl layer
    // cannot place them and h3-js throws on invalid cells.
    if (!hexagon || !isValidCell(hexagon)) {
      return [];
    }

    const feature: H3Feature = { hexagon };

    // Keep the other record fields (tooltip columns, the metric under its own
    // label) so tooltips can resolve them by name.
    Object.keys(record).forEach(key => {
      if (!RESERVED_FEATURE_KEYS.has(key)) {
        feature[key] = record[key];
      }
    });

    if (metricLabel && record[metricLabel] != null) {
      const value = parseMetricValue(record[metricLabel]);
      if (value !== undefined) {
        feature.elevation = value;
      }
    }

    return [feature];
  });

  const metricLabels = metricLabel ? [metricLabel] : [];

  return createBaseTransformResult(chartProps, features, metricLabels);
}

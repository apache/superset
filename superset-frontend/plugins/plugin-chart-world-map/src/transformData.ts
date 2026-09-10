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
import { getColumnLabel, getMetricLabel } from '@superset-ui/core';
import { getCountry } from './countries';

export interface WorldMapDataRow {
  country: string;
  m1: unknown;
  m2?: unknown;
  code?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
}

/**
 * Ports the legacy WorldMapViz.get_data reshape: rename the entity and
 * metric columns to country/m1/m2 and join country metadata (cca3 code,
 * coordinates, display name) from the bundled country list. Unmatched
 * countries become "XXX", exactly as the backend did.
 */
export default function transformData(
  records: Record<string, unknown>[],
  options: {
    entity?: string;
    metric?: unknown;
    secondaryMetric?: unknown;
    countryFieldtype?: string;
    strict?: boolean;
  },
): WorldMapDataRow[] {
  const entityLabel = getColumnLabel(options.entity ?? '');
  const metricLabel = getMetricLabel(options.metric as never);
  const secondaryLabel = options.secondaryMetric
    ? getMetricLabel(options.secondaryMetric as never)
    : undefined;
  const fieldtype = options.countryFieldtype;

  const seen = new Set<string>();
  return records.map(record => {
    const row: WorldMapDataRow = {
      country: record[entityLabel] as string,
      m1: record[metricLabel],
    };
    if (secondaryLabel) {
      row.m2 =
        secondaryLabel === metricLabel
          ? record[metricLabel]
          : record[secondaryLabel];
    }
    const countryInfo =
      typeof row.country === 'string' && fieldtype
        ? getCountry(fieldtype, row.country)
        : undefined;
    if (options.strict) {
      if (!countryInfo || seen.has(countryInfo.cca3)) {
        throw new Error(
          'Unrecognized or duplicate country value; choose the matching country format or normalize source values before aggregation.',
        );
      }
      seen.add(countryInfo.cca3);
      for (const label of [
        metricLabel,
        ...(secondaryLabel ? [secondaryLabel] : []),
      ]) {
        const value = record[label];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(`Geographic metric ${label} must be a finite number`);
        }
      }
      if (secondaryLabel && Number(record[secondaryLabel]) < 0) {
        throw new Error('Bubble-size metric must be nonnegative');
      }
    }
    if (countryInfo) {
      row.code = countryInfo[fieldtype as keyof typeof countryInfo] as string;
      row.country = countryInfo.cca3;
      row.latitude = countryInfo.lat;
      row.longitude = countryInfo.lng;
      row.name = countryInfo.name;
    } else {
      row.country = 'XXX';
    }
    return row;
  });
}

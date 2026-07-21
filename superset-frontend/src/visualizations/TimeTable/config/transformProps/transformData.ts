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
import { DTTM_ALIAS } from '@superset-ui/core';

const FLAT_COLUMN_SEPARATOR = ', ';

// Escape backslashes before commas so values like "a\\," and "a," cannot
// collide once joined (the backend escape_separator shares this gap, but
// these labels are only ever built client-side).
const escapeSeparator = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/,/g, '\\,');

const pad = (part: number) => String(part).padStart(2, '0');

/**
 * Formats an epoch timestamp the way str(pandas.Timestamp) did on the
 * legacy endpoint ("YYYY-MM-DD HH:MM:SS", with a microsecond suffix for
 * sub-second values), which the TimeTable component re-parses with
 * new Date().
 */
export const formatTimestamp = (value: unknown): string => {
  const date = new Date(value as number);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const millis = date.getUTCMilliseconds();
  const fraction = millis > 0 ? `.${String(millis).padStart(3, '0')}000` : '';
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${fraction}`
  );
};

export interface TimeTablePayload {
  records: Record<string, Record<string, unknown>>;
  columns: string[];
  is_group_by: boolean;
}

/**
 * Ports the legacy TimeTableViz.get_data pandas pivot: rows keyed by the
 * stringified timestamp, one column per metric, or per group value of the
 * single metric when grouped (multi-level group names joined with ", ",
 * commas escaped, matching FLAT_COLUMN_SEPARATOR semantics).
 */
export default function transformData(
  records: Record<string, unknown>[],
  groupbyLabels: string[],
  metricLabels: string[],
): TimeTablePayload {
  const isGroupBy = groupbyLabels.length > 0;
  const pivoted: Record<string, Record<string, unknown>> = {};
  const columnSet = new Set<string>();

  records.forEach(record => {
    const timeKey = formatTimestamp(record[DTTM_ALIAS]);
    if (!pivoted[timeKey]) {
      pivoted[timeKey] = {};
    }
    if (isGroupBy) {
      const column =
        groupbyLabels.length === 1
          ? String(record[groupbyLabels[0]])
          : groupbyLabels
              .map(label => escapeSeparator(String(record[label])))
              .join(FLAT_COLUMN_SEPARATOR);
      columnSet.add(column);
      pivoted[timeKey][column] = record[metricLabels[0]];
    } else {
      metricLabels.forEach(metric => {
        columnSet.add(metric);
        pivoted[timeKey][metric] = record[metric];
      });
    }
  });

  // pandas pivot pads missing combinations with NaN -> null
  const columns = Array.from(columnSet).sort();
  Object.values(pivoted).forEach(row => {
    columns.forEach(column => {
      if (!(column in row)) {
        // eslint-disable-next-line no-param-reassign
        row[column] = null;
      }
    });
  });

  return { records: pivoted, columns, is_group_by: isGroupBy };
}

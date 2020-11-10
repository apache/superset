/* eslint-disable no-underscore-dangle */
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
  DataRecord,
  DataRecordValue,
  NumberFormatter,
  TimeFormatter,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { NULL_STRING } from '../constants';

export function extractTimeseriesSeries(
  data: TimeseriesDataRecord[],
): echarts.EChartOption.Series[] {
  if (data.length === 0) return [];
  const rows = data.map(datum => ({
    ...datum,
    __timestamp: datum.__timestamp || datum.__timestamp === 0 ? new Date(datum.__timestamp) : null,
  }));

  return Object.keys(rows[0])
    .filter(key => key !== '__timestamp')
    .map(key => ({
      id: key,
      name: key,
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      data: rows.map(datum => [datum.__timestamp, datum[key]]),
    }));
}

export function formatSeriesName(
  name: DataRecordValue | undefined,
  {
    numberFormatter,
    timeFormatter,
  }: {
    numberFormatter?: NumberFormatter;
    timeFormatter?: TimeFormatter;
  } = {},
): string {
  if (name === undefined || name === null) {
    return NULL_STRING;
  }
  if (typeof name === 'number') {
    return numberFormatter ? numberFormatter(name) : name.toString();
  }
  if (typeof name === 'boolean') {
    return name.toString();
  }
  if (name instanceof Date) {
    return timeFormatter ? timeFormatter(name) : name.toISOString();
  }
  return name;
}

export function extractGroupbyLabel({
  datum = {},
  groupby,
  numberFormatter,
  timeFormatter,
}: {
  datum?: DataRecord;
  groupby?: string[] | null;
  numberFormatter?: NumberFormatter;
  timeFormatter?: TimeFormatter;
}): string {
  return (groupby || [])
    .map(val => formatSeriesName(datum[val], { numberFormatter, timeFormatter }))
    .join(', ');
}

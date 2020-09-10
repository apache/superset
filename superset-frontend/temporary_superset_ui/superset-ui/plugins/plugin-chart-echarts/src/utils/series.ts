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
import { DataRecord, TimeseriesDataRecord } from '@superset-ui/core';

export function extractTimeseriesSeries(
  data: TimeseriesDataRecord[],
): echarts.EChartOption.Series[] {
  if (data.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const rows = data.map(datum => ({
    ...datum,
    __timestamp: datum.__timestamp || datum.__timestamp === 0 ? new Date(datum.__timestamp) : null,
  }));

  return Object.keys(rows[0])
    .filter(key => key !== '__timestamp')
    .map(key => ({
      name: key,
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      data: rows.map(datum => [datum.__timestamp, datum[key]]),
    }));
}

export function extractGroupbyLabel(datum: DataRecord, groupby: string[]): string {
  // TODO: apply formatting to dates and numbers
  return groupby.map(val => `${datum[val]}`).join(', ');
}

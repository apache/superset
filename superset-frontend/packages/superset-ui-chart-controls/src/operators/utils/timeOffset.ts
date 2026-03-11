/* eslint-disable camelcase */
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
 * specific language governing permissions and limitationsxw
 * under the License.
 */
import { JsonObject } from '@superset-ui/core';

export const getTimeOffset = (
  series: JsonObject,
  timeCompare: string[],
): string | undefined =>
  timeCompare.find(
    timeOffset =>
      // offset is represented as <offset>, group by list
      series.name.includes(`${timeOffset},`) ||
      // offset is represented as <metric>__<offset>
      series.name.includes(`__${timeOffset}`),
  );

export const hasTimeOffset = (
  series: JsonObject,
  timeCompare: string[],
): boolean =>
  typeof series.name === 'string'
    ? !!getTimeOffset(series, timeCompare)
    : false;

export const getOriginalSeries = (
  seriesName: string,
  timeCompare: string[],
): string => {
  let result = seriesName;
  timeCompare.forEach(compare => {
    // offset is represented as <offset>, group by list
    result = result.replace(`${compare},`, '');
    // offset is represented as <metric>__<offset>
    result = result.replace(`__${compare}`, '');
  });
  return result.trim();
};

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
import { TimeRangeEndpoints } from '@superset-ui/core';

const SEPARATOR = ' : ';

export const buildTimeRangeString = (since: string, until: string): string =>
  `${since}${SEPARATOR}${until}`;

const formatDateEndpoint = (dttm: string, isStart?: boolean): string =>
  dttm.replace('T00:00:00', '') || (isStart ? '-∞' : '∞');

export const formatTimeRange = (
  timeRange: string,
  endpoints?: TimeRangeEndpoints,
) => {
  const splitDateRange = timeRange.split(SEPARATOR);
  if (splitDateRange.length === 1) return timeRange;
  const formattedEndpoints = (
    endpoints || ['unknown', 'unknown']
  ).map((endpoint: string) => (endpoint === 'inclusive' ? '≤' : '<'));

  return `${formatDateEndpoint(splitDateRange[0], true)} ${
    formattedEndpoints[0]
  } col ${formattedEndpoints[1]} ${formatDateEndpoint(splitDateRange[1])}`;
};

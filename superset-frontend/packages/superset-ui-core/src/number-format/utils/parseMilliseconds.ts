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

import parseMs from 'parse-ms';

interface Duration {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  microseconds: number;
  nanoseconds: number;
}

const DAYS_IN_YEAR = 365;

/**
 * Parses milliseconds into a duration object.

 * @param ms - The number of milliseconds to parse
 * @returns A duration object containing years, days, hours, minutes, seconds,
 *          milliseconds, microseconds, and nanoseconds (1 year = 365 days)
 * @example
 * // Parse a complex duration
 * parseMilliseconds(90061000);
 * // { years: 0, days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 0, ... }
 */
export function parseMilliseconds(ms: number): Duration {
  const parsed = parseMs(ms);
  const totalDays = parsed.days;
  const years = Math.floor(totalDays / DAYS_IN_YEAR);
  const remainingDays = totalDays % DAYS_IN_YEAR;

  return {
    ...parsed,
    years,
    days: remainingDays,
  };
}

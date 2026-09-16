/*
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

export default function stringifyTimeInput(
  value: Date | number | string | undefined | null,
  fn: (time: Date) => string,
) {
  if (value === null || value === undefined) {
    return `${value}`;
  }

  let time: Date;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // A bare four-digit string is the ISO 8601 year-only form ("2017"), which
    // every engine parses as January 1st of that year. A digit-only string
    // of at least 10 digits is long enough to plausibly be an epoch
    // timestamp in milliseconds that was stringified on its way here, e.g.
    // by the pivot table. Anything shorter that isn't a four-digit year -
    // a YYYYMMDD date key such as "20260903", for instance - is neither, so
    // it is handed to `new Date(value)` like any other string; that resolves
    // to an Invalid Date and falls back to the original input below instead
    // of being silently misread as a moment near 1970.
    const isYear = /^\d{4}$/.test(trimmed);
    const isPlausibleEpoch = /^-?\d{10,}$/.test(trimmed);
    if (isYear) {
      time = new Date(trimmed);
    } else {
      time = new Date(isPlausibleEpoch ? Number(trimmed) : value);
    }
  } else {
    time = value instanceof Date ? value : new Date(value);
  }

  // An input that does not resolve to a valid date - a duration such as
  // "00:01:54", for instance - would otherwise be formatted from an Invalid
  // Date and render as "NaN:NaN:NaN". Fall back to its own representation,
  // as is already done for null and undefined above. For a `DateWithFormatter`
  // this calls its `toString()`, which returns the original input rather than
  // re-entering the formatter; that guard is what keeps the fallback finite.
  if (Number.isNaN(time.getTime())) {
    return `${value}`;
  }

  return fn(time);
}

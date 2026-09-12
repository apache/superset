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

export const TS_REGEX = /(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2}\.?\d*).*/;

// Matches a bare date with no time component, e.g. "2023-03-11".
// Native `Date` parsing of date-only strings is timezone-independent per the
// ECMA-262 spec (they should always be treated as UTC midnight), but some
// browser/OS combinations (notably Windows installs with an unresolved
// timezone id) parse them as local time instead, shifting the displayed
// date backward by a day in timezones ahead of UTC. Normalizing to an
// explicit UTC timestamp removes that ambiguity.
export const DATE_ONLY_REGEX = /^(\d{4}-\d{2}-\d{2})$/;

export default function normalizeTimestamp(value: string): string {
  const match = value.match(TS_REGEX);
  if (match) {
    return `${match[1]}T${match[2]}Z`;
  }
  const dateOnlyMatch = value.match(DATE_ONLY_REGEX);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}T00:00:00Z`;
  }
  return value;
}

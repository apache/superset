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

import { getTimeFormatter } from '@superset-ui/core';

// Cal-Heatmap provides local timestamps (UTC shifted by the browser's timezone
// offset). We subtract that offset so the formatter displays the correct UTC
// date regardless of the browser's timezone.
export const getFormattedUTCTime = (
  ts: number | string,
  timeFormat?: string,
) => {
  const date = new Date(ts);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return getTimeFormatter(timeFormat)(date.getTime() - offset);
};

// The vendor library interprets timestamps as local time but the backend sends UTC timestamps.
// That's why we need to add the offset
export const convertUTCTimestampToLocal = (utcTimestamp: number): number => {
  const date = new Date(utcTimestamp);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return utcTimestamp + offsetMs;
};

// SECURITY: escape HTML special characters before formatter output reaches
// an innerHTML sink. The tooltip time/value formatters are built from
// creator-controlled format strings (d3-time-format passes non-% characters
// through verbatim, and an invalid d3 number format echoes the raw format
// string back), so their output must never be treated as markup. Mirrors
// plugin-chart-country-map's escapeHtml.
export const escapeHtml = (text: unknown): string => {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
};

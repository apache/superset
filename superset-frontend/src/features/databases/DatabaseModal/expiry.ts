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
import { extendedDayjs } from '@superset-ui/core/utils/dates';

// Warn this many calendar days before a stored token expires, so there is time
// to rotate it.
export const EXPIRY_WARNING_DAYS = 7;

/**
 * Calendar days from today to the day a token expires, in local time; NaN for
 * an invalid date.
 */
export const calendarDaysUntil = (expiresAt: string): number =>
  extendedDayjs(expiresAt)
    .startOf('day')
    .diff(extendedDayjs().startOf('day'), 'day');

/**
 * Whether a token expires today or within the warning window. A token whose day
 * the browser clock already passed counts too: the server decides whether it
 * has expired.
 */
export const isExpiringSoon = (expiresAt: string): boolean =>
  calendarDaysUntil(expiresAt) <= EXPIRY_WARNING_DAYS;

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { SmartDateFormat } from './types';

export const DEFAULT_SMART_DATE_FORMAT: SmartDateFormat = {
  smart_date: {
    millisecond: '.%Lms',
    second: ':%Ss',
    minute: '%I:%M',
    hour: '%I %p',
    day: '%a %d',
    week: '%b %d',
    month: '%B',
    year: '%Y',
  },
  smart_date_verbose: {
    millisecond: '.%L',
    second: '%a %b %d, %I:%M:%S %p',
    minute: '%a %b %d, %I:%M %p',
    hour: '%a %b %d, %I %p',
    day: '%a %b %-e',
    week: '%a %b %-e',
    month: '%b %Y',
    year: '%Y',
  },
  smart_date_detailed: {
    millisecond: '%Y-%m-%d %H:%M:%S.%L',
    second: '%Y-%m-%d %H:%M:%S',
    minute: '%Y-%m-%d %H:%M',
    hour: '%Y-%m-%d %H:%M',
    day: '%Y-%m-%d',
    week: '%Y-%m-%d',
    month: '%Y-%m-%d',
    year: '%Y',
  },
};

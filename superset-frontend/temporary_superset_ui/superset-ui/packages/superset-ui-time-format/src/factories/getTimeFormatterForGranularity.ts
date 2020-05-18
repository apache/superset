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
import TimeFormats from '../TimeFormats';
import { getTimeFormatter } from '../TimeFormatterRegistrySingleton';
import smartDateVerboseFormatter from '../formatters/smartDateVerbose';
import { TimeGranularity } from '../types';

// Translate time granularity to d3-format
const MINUTE = '%Y-%m-%d %H:%M';
const { DATABASE_DATE, DATABASE_DATETIME } = TimeFormats;

// search for `builtin_time_grains` in incubator-superset/superset/db_engine_specs/base.py
const formats = {
  date: DATABASE_DATE,
  PT1S: DATABASE_DATETIME, // second
  PT1M: MINUTE, // minute
  PT5M: MINUTE, // 5 minute
  PT10M: MINUTE, // 10 minute
  PT15M: MINUTE, // 15 minute
  'PT0.5H': MINUTE, // half hour
  PT1H: '%Y-%m-%d %H:00', // hour
  P1D: DATABASE_DATE, // day
  P1W: DATABASE_DATE, // week
  P1M: '%Y-%m', // month
  'P0.25Y': '%Y Q%q', // quarter
  P1Y: '%Y', // year
  '1969-12-28T00:00:00Z/P1W': DATABASE_DATE, // 'week_start_sunday'
  '1969-12-29T00:00:00Z/P1W': DATABASE_DATE, // 'week_start_monday'
  'P1W/1970-01-03T00:00:00Z': DATABASE_DATE, // 'week_ending_saturday'
  'P1W/1970-01-04T00:00:00Z': DATABASE_DATE, // 'week_ending_sunday'
};

export default function getTimeFormatterForGranularity(granularity?: TimeGranularity) {
  return granularity && granularity in formats
    ? getTimeFormatter(formats[granularity])
    : smartDateVerboseFormatter;
}

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

import TimeFormats from './TimeFormats';
import { TimeGranularity } from './types';

const { DATABASE_DATE, DATABASE_DATETIME } = TimeFormats;
const MINUTE = '%Y-%m-%d %H:%M';

/**
 * Map time granularity to d3-format string
 */
const TimeFormatsForGranularity: Record<TimeGranularity, string> = {
  [TimeGranularity.DATE]: DATABASE_DATE,
  [TimeGranularity.SECOND]: DATABASE_DATETIME,
  [TimeGranularity.MINUTE]: MINUTE,
  [TimeGranularity.FIVE_MINUTES]: MINUTE,
  [TimeGranularity.TEN_MINUTES]: MINUTE,
  [TimeGranularity.FIFTEEN_MINUTES]: MINUTE,
  [TimeGranularity.THIRTY_MINUTES]: MINUTE,
  [TimeGranularity.HOUR]: '%Y-%m-%d %H:00',
  [TimeGranularity.DAY]: DATABASE_DATE,
  [TimeGranularity.WEEK]: DATABASE_DATE,
  [TimeGranularity.MONTH]: '%b %Y',
  [TimeGranularity.QUARTER]: '%Y Q%q',
  [TimeGranularity.YEAR]: '%Y',
  [TimeGranularity.WEEK_STARTING_SUNDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_STARTING_MONDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_ENDING_SATURDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_ENDING_SUNDAY]: DATABASE_DATE,
};

export default TimeFormatsForGranularity;

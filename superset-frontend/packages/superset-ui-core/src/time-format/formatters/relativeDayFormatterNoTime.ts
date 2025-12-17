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

import TimeFormatter from '../TimeFormatter';

export const RELATIVE_DAY_NO_TIME_ID = 'relative_day_no_time';

// Reference date: January 1, 2000 00:00:00 UTC = Day 1
const DAY_ONE_DATE = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
const MS_PER_DAY = 86400000;

export function createRelativeDayFormatterNoTime() {
  return new TimeFormatter({
    id: RELATIVE_DAY_NO_TIME_ID,
    label: 'Relative Day (No Time)',
    description: 'Formats dates as relative days from Day 1 (01/01/2000) without time',
    formatFunc: (date: Date) => {
      const ms = date.getTime();

      // Calculate day difference from Day 1 (01/01/2000)
      // Day 1 = 01/01/2000, Day 2 = 02/01/2000, Day -1 = 31/12/1999
      // There is no Day 0
      const msDiff = ms - DAY_ONE_DATE;
      const daysDiff = Math.floor(msDiff / MS_PER_DAY);
      // Adjust for no Day 0: if >= 0, add 1; if < 0, keep as is
      const relativeDay = daysDiff >= 0 ? daysDiff + 1 : daysDiff;

      return `Day ${relativeDay}`;
    },
    useLocalTime: false,
  });
}

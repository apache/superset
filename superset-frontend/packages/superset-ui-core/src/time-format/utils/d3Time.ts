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

import {
  timeSecond,
  timeMinute,
  timeHour,
  timeDay,
  timeWeek,
  timeSunday,
  timeMonday,
  timeTuesday,
  timeWednesday,
  timeThursday,
  timeFriday,
  timeSaturday,
  timeMonth,
  timeYear,
  utcSecond,
  utcMinute,
  utcHour,
  utcDay,
  utcWeek,
  utcSunday,
  utcMonday,
  utcTuesday,
  utcWednesday,
  utcThursday,
  utcFriday,
  utcSaturday,
  utcMonth,
  utcYear,
  CountableTimeInterval,
} from 'd3-time';

function createUtils(useLocalTime = false) {
  let floorSecond: CountableTimeInterval;
  let floorMinute: CountableTimeInterval;
  let floorHour: CountableTimeInterval;
  let floorDay: CountableTimeInterval;
  let floorWeek: CountableTimeInterval;
  let floorWeekStartOnSunday: CountableTimeInterval;
  let floorWeekStartOnMonday: CountableTimeInterval;
  let floorWeekStartOnTuesday: CountableTimeInterval;
  let floorWeekStartOnWednesday: CountableTimeInterval;
  let floorWeekStartOnThursday: CountableTimeInterval;
  let floorWeekStartOnFriday: CountableTimeInterval;
  let floorWeekStartOnSaturday: CountableTimeInterval;
  let floorMonth: CountableTimeInterval;
  let floorYear: CountableTimeInterval;
  if (useLocalTime) {
    floorSecond = timeSecond;
    floorMinute = timeMinute;
    floorHour = timeHour;
    floorDay = timeDay;
    floorWeek = timeWeek;
    floorWeekStartOnSunday = timeSunday;
    floorWeekStartOnMonday = timeMonday;
    floorWeekStartOnTuesday = timeTuesday;
    floorWeekStartOnWednesday = timeWednesday;
    floorWeekStartOnThursday = timeThursday;
    floorWeekStartOnFriday = timeFriday;
    floorWeekStartOnSaturday = timeSaturday;
    floorMonth = timeMonth;
    floorYear = timeYear;
  } else {
    floorSecond = utcSecond;
    floorMinute = utcMinute;
    floorHour = utcHour;
    floorDay = utcDay;
    floorWeek = utcWeek;
    floorWeekStartOnSunday = utcSunday;
    floorWeekStartOnMonday = utcMonday;
    floorWeekStartOnTuesday = utcTuesday;
    floorWeekStartOnWednesday = utcWednesday;
    floorWeekStartOnThursday = utcThursday;
    floorWeekStartOnFriday = utcFriday;
    floorWeekStartOnSaturday = utcSaturday;
    floorMonth = utcMonth;
    floorYear = utcYear;
  }

  return {
    floorSecond,
    floorMinute,
    floorHour,
    floorDay,
    floorWeek,
    floorWeekStartOnSunday,
    floorWeekStartOnMonday,
    floorWeekStartOnTuesday,
    floorWeekStartOnWednesday,
    floorWeekStartOnThursday,
    floorWeekStartOnFriday,
    floorWeekStartOnSaturday,
    floorMonth,
    floorYear,
    hasMillisecond: (date: Date) => floorSecond(date) < date,
    hasSecond: (date: Date) => floorMinute(date) < date,
    hasMinute: (date: Date) => floorHour(date) < date,
    hasHour: (date: Date) => floorDay(date) < date,
    isNotFirstDayOfMonth: (date: Date) => floorMonth(date) < date,
    isNotFirstDayOfWeek: (date: Date) => floorWeek(date) < date,
    isNotFirstDayOfWeekStartOnSunday: (date: Date) =>
      floorWeekStartOnSunday(date) < date,
    isNotFirstDayOfWeekStartOnMonday: (date: Date) =>
      floorWeekStartOnMonday(date) < date,
    isNotFirstDayOfWeekStartOnTuesday: (date: Date) =>
      floorWeekStartOnTuesday(date) < date,
    isNotFirstDayOfWeekStartOnWednesday: (date: Date) =>
      floorWeekStartOnWednesday(date) < date,
    isNotFirstDayOfWeekStartOnThursday: (date: Date) =>
      floorWeekStartOnThursday(date) < date,
    isNotFirstDayOfWeekStartOnFriday: (date: Date) =>
      floorWeekStartOnFriday(date) < date,
    isNotFirstDayOfWeekStartOnSaturday: (date: Date) =>
      floorWeekStartOnSaturday(date) < date,
    isNotFirstMonth: (date: Date) => floorYear(date) < date,
  };
}

const utcUtils = createUtils();
const localTimeUtils = createUtils(true);

export { utcUtils, localTimeUtils };

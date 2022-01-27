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
import { timeSecond, timeMinute, timeHour, timeDay, timeWeek, timeSunday, timeMonday, timeTuesday, timeWednesday, timeThursday, timeFriday, timeSaturday, timeMonth, timeYear, utcSecond, utcMinute, utcHour, utcDay, utcWeek, utcSunday, utcMonday, utcTuesday, utcWednesday, utcThursday, utcFriday, utcSaturday, utcMonth, utcYear, } from 'd3-time';
function createUtils(useLocalTime = false) {
    let floorSecond;
    let floorMinute;
    let floorHour;
    let floorDay;
    let floorWeek;
    let floorWeekStartOnSunday;
    let floorWeekStartOnMonday;
    let floorWeekStartOnTuesday;
    let floorWeekStartOnWednesday;
    let floorWeekStartOnThursday;
    let floorWeekStartOnFriday;
    let floorWeekStartOnSaturday;
    let floorMonth;
    let floorYear;
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
    }
    else {
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
        hasMillisecond: (date) => floorSecond(date) < date,
        hasSecond: (date) => floorMinute(date) < date,
        hasMinute: (date) => floorHour(date) < date,
        hasHour: (date) => floorDay(date) < date,
        isNotFirstDayOfMonth: (date) => floorMonth(date) < date,
        isNotFirstDayOfWeek: (date) => floorWeek(date) < date,
        isNotFirstDayOfWeekStartOnSunday: (date) => floorWeekStartOnSunday(date) < date,
        isNotFirstDayOfWeekStartOnMonday: (date) => floorWeekStartOnMonday(date) < date,
        isNotFirstDayOfWeekStartOnTuesday: (date) => floorWeekStartOnTuesday(date) < date,
        isNotFirstDayOfWeekStartOnWednesday: (date) => floorWeekStartOnWednesday(date) < date,
        isNotFirstDayOfWeekStartOnThursday: (date) => floorWeekStartOnThursday(date) < date,
        isNotFirstDayOfWeekStartOnFriday: (date) => floorWeekStartOnFriday(date) < date,
        isNotFirstDayOfWeekStartOnSaturday: (date) => floorWeekStartOnSaturday(date) < date,
        isNotFirstMonth: (date) => floorYear(date) < date,
    };
}
const utcUtils = createUtils();
const localTimeUtils = createUtils(true);
export { utcUtils, localTimeUtils };
//# sourceMappingURL=d3Time.js.map
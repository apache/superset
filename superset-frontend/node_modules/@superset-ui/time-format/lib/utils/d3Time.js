"use strict";

exports.__esModule = true;
exports.localTimeUtils = exports.utcUtils = void 0;

var _d3Time = require("d3-time");

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
    floorSecond = _d3Time.timeSecond;
    floorMinute = _d3Time.timeMinute;
    floorHour = _d3Time.timeHour;
    floorDay = _d3Time.timeDay;
    floorWeek = _d3Time.timeWeek;
    floorWeekStartOnSunday = _d3Time.timeSunday;
    floorWeekStartOnMonday = _d3Time.timeMonday;
    floorWeekStartOnTuesday = _d3Time.timeTuesday;
    floorWeekStartOnWednesday = _d3Time.timeWednesday;
    floorWeekStartOnThursday = _d3Time.timeThursday;
    floorWeekStartOnFriday = _d3Time.timeFriday;
    floorWeekStartOnSaturday = _d3Time.timeSaturday;
    floorMonth = _d3Time.timeMonth;
    floorYear = _d3Time.timeYear;
  } else {
    floorSecond = _d3Time.utcSecond;
    floorMinute = _d3Time.utcMinute;
    floorHour = _d3Time.utcHour;
    floorDay = _d3Time.utcDay;
    floorWeek = _d3Time.utcWeek;
    floorWeekStartOnSunday = _d3Time.utcSunday;
    floorWeekStartOnMonday = _d3Time.utcMonday;
    floorWeekStartOnTuesday = _d3Time.utcTuesday;
    floorWeekStartOnWednesday = _d3Time.utcWednesday;
    floorWeekStartOnThursday = _d3Time.utcThursday;
    floorWeekStartOnFriday = _d3Time.utcFriday;
    floorWeekStartOnSaturday = _d3Time.utcSaturday;
    floorMonth = _d3Time.utcMonth;
    floorYear = _d3Time.utcYear;
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
    hasMillisecond: date => floorSecond(date) < date,
    hasSecond: date => floorMinute(date) < date,
    hasMinute: date => floorHour(date) < date,
    hasHour: date => floorDay(date) < date,
    isNotFirstDayOfMonth: date => floorMonth(date) < date,
    isNotFirstDayOfWeek: date => floorWeek(date) < date,
    isNotFirstDayOfWeekStartOnSunday: date => floorWeekStartOnSunday(date) < date,
    isNotFirstDayOfWeekStartOnMonday: date => floorWeekStartOnMonday(date) < date,
    isNotFirstDayOfWeekStartOnTuesday: date => floorWeekStartOnTuesday(date) < date,
    isNotFirstDayOfWeekStartOnWednesday: date => floorWeekStartOnWednesday(date) < date,
    isNotFirstDayOfWeekStartOnThursday: date => floorWeekStartOnThursday(date) < date,
    isNotFirstDayOfWeekStartOnFriday: date => floorWeekStartOnFriday(date) < date,
    isNotFirstDayOfWeekStartOnSaturday: date => floorWeekStartOnSaturday(date) < date,
    isNotFirstMonth: date => floorYear(date) < date
  };
}

const utcUtils = createUtils();
exports.utcUtils = utcUtils;
const localTimeUtils = createUtils(true);
exports.localTimeUtils = localTimeUtils;
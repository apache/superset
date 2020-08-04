import interval from "./interval.js";
import {durationWeek} from "./duration.js";

function utcWeekday(i) {
  return interval(function(date) {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step * 7);
  }, function(start, end) {
    return (end - start) / durationWeek;
  });
}

export var utcSunday = utcWeekday(0);
export var utcMonday = utcWeekday(1);
export var utcTuesday = utcWeekday(2);
export var utcWednesday = utcWeekday(3);
export var utcThursday = utcWeekday(4);
export var utcFriday = utcWeekday(5);
export var utcSaturday = utcWeekday(6);

export var utcSundays = utcSunday.range;
export var utcMondays = utcMonday.range;
export var utcTuesdays = utcTuesday.range;
export var utcWednesdays = utcWednesday.range;
export var utcThursdays = utcThursday.range;
export var utcFridays = utcFriday.range;
export var utcSaturdays = utcSaturday.range;

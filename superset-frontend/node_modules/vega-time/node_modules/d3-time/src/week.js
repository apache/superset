import interval from "./interval.js";
import {durationMinute, durationWeek} from "./duration.js";

function weekday(i) {
  return interval(function(date) {
    date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step * 7);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}

export var sunday = weekday(0);
export var monday = weekday(1);
export var tuesday = weekday(2);
export var wednesday = weekday(3);
export var thursday = weekday(4);
export var friday = weekday(5);
export var saturday = weekday(6);

export var sundays = sunday.range;
export var mondays = monday.range;
export var tuesdays = tuesday.range;
export var wednesdays = wednesday.range;
export var thursdays = thursday.range;
export var fridays = friday.range;
export var saturdays = saturday.range;

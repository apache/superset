import interval from "./interval.js";
import {durationMinute, durationSecond} from "./duration.js";

var minute = interval(function(date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getMinutes();
});

export default minute;
export var minutes = minute.range;

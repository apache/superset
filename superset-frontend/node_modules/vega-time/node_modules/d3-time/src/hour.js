import interval from "./interval.js";
import {durationHour, durationMinute, durationSecond} from "./duration.js";

var hour = interval(function(date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond - date.getMinutes() * durationMinute);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getHours();
});

export default hour;
export var hours = hour.range;

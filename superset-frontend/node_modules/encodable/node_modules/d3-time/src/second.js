import interval from "./interval.js";
import {durationSecond} from "./duration.js";

var second = interval(function(date) {
  date.setTime(date - date.getMilliseconds());
}, function(date, step) {
  date.setTime(+date + step * durationSecond);
}, function(start, end) {
  return (end - start) / durationSecond;
}, function(date) {
  return date.getUTCSeconds();
});

export default second;
export var seconds = second.range;

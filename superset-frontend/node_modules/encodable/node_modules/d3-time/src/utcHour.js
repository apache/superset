import interval from "./interval.js";
import {durationHour} from "./duration.js";

var utcHour = interval(function(date) {
  date.setUTCMinutes(0, 0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getUTCHours();
});

export default utcHour;
export var utcHours = utcHour.range;

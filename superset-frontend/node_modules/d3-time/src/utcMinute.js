import interval from "./interval";
import {durationMinute} from "./duration";

var utcMinute = interval(function(date) {
  date.setUTCSeconds(0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getUTCMinutes();
});

export default utcMinute;
export var utcMinutes = utcMinute.range;

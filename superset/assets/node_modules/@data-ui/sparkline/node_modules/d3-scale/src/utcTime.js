import {calendar} from "./time";
import {utcFormat} from "d3-time-format";
import {utcYear, utcMonth, utcWeek, utcDay, utcHour, utcMinute, utcSecond, utcMillisecond} from "d3-time";

export default function() {
  return calendar(utcYear, utcMonth, utcWeek, utcDay, utcHour, utcMinute, utcSecond, utcMillisecond, utcFormat).domain([Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)]);
}

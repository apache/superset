"use strict";

exports.__esModule = true;
exports.default = createMultiFormatter;

var _d3TimeFormat = require("d3-time-format");

var _d3Time = require("../utils/d3Time");

var _TimeFormatter = _interopRequireDefault(require("../TimeFormatter"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createMultiFormatter({
  id,
  label,
  description,
  formats = {},
  useLocalTime = false
}) {
  const {
    millisecond = '.%L',
    second = ':%S',
    minute = '%I:%M',
    hour = '%I %p',
    day = '%a %d',
    week = '%b %d',
    month = '%B',
    year = '%Y'
  } = formats;
  const format = useLocalTime ? _d3TimeFormat.timeFormat : _d3TimeFormat.utcFormat;
  const formatMillisecond = format(millisecond);
  const formatSecond = format(second);
  const formatMinute = format(minute);
  const formatHour = format(hour);
  const formatDay = format(day);
  const formatFirstDayOfWeek = format(week);
  const formatMonth = format(month);
  const formatYear = format(year);
  const {
    hasMillisecond,
    hasSecond,
    hasMinute,
    hasHour,
    isNotFirstDayOfMonth,
    isNotFirstDayOfWeek,
    isNotFirstMonth
  } = useLocalTime ? _d3Time.localTimeUtils : _d3Time.utcUtils;

  function multiFormatFunc(date) {
    if (hasMillisecond(date)) {
      return formatMillisecond;
    }

    if (hasSecond(date)) {
      return formatSecond;
    }

    if (hasMinute(date)) {
      return formatMinute;
    }

    if (hasHour(date)) {
      return formatHour;
    }

    if (isNotFirstDayOfMonth(date)) {
      return isNotFirstDayOfWeek(date) ? formatDay : formatFirstDayOfWeek;
    }

    if (isNotFirstMonth(date)) {
      return formatMonth;
    }

    return formatYear;
  }

  return new _TimeFormatter.default({
    description,
    formatFunc: date => multiFormatFunc(date)(date),
    id,
    label,
    useLocalTime
  });
}
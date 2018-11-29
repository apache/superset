import { utcFormat, timeFormat } from 'd3-time-format';
import { utcUtils, localTimeUtils } from '../utils';
import TimeFormatter from '../TimeFormatter';

export default function createMultiFormatter({
  id,
  label,
  description,
  formats = {},
  useLocalTime = false,
}) {
  const {
    millisecond = '.%L',
    second = ':%S',
    minute = '%I:%M',
    hour = '%I %p',
    day = '%a %d',
    week = '%b %d',
    month = '%B',
    year = '%Y',
  } = formats;

  const format = useLocalTime ? timeFormat : utcFormat;

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
    isNotFirstMonth,
  } = useLocalTime ? localTimeUtils : utcUtils;

  function multiFormatFunc(date) {
    if (hasMillisecond(date)) {
      return formatMillisecond;
    } else if (hasSecond(date)) {
      return formatSecond;
    } else if (hasMinute(date)) {
      return formatMinute;
    } else if (hasHour(date)) {
      return formatHour;
    } else if (isNotFirstDayOfMonth(date)) {
      return isNotFirstDayOfWeek(date) ? formatDay : formatFirstDayOfWeek;
    } else if (isNotFirstMonth(date)) {
      return formatMonth;
    }

    return formatYear;
  }

  return new TimeFormatter({
    description,
    formatFunc: date => multiFormatFunc(date)(date),
    id,
    label,
    useLocalTime,
  });
}

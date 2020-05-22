import { utcFormat, timeFormat } from 'd3-time-format';
import { utcUtils, localTimeUtils } from '../utils/d3Time';
import TimeFormatter from '../TimeFormatter';

type FormatsByStep = Partial<{
  millisecond: string;
  second: string;
  minute: string;
  hour: string;
  day: string;
  week: string;
  month: string;
  year: string;
}>;

export default function createMultiFormatter({
  id,
  label,
  description,
  formats = {},
  useLocalTime = false,
}: {
  id: string;
  label?: string;
  description?: string;
  formats?: FormatsByStep;
  useLocalTime?: boolean;
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

  function multiFormatFunc(date: Date) {
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

  return new TimeFormatter({
    description,
    formatFunc: (date: Date) => multiFormatFunc(date)(date),
    id,
    label,
    useLocalTime,
  });
}

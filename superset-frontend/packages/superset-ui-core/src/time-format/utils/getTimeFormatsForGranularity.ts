// DODO was here
// DODO created 45525377
import TimeFormats from '../TimeFormats';
import { TimeGranularity } from '../types';

/**
 * Map time granularity to d3-format string
 */
export const getTimeFormatsForGranularity = (isDateReversed: boolean) => {
  const {
    DATABASE_DATE,
    DATABASE_DATE_DOT_REVERSE,
    DATABASE_DATETIME,
    DATABASE_DATETIME_REVERSE,
  } = TimeFormats;
  const DATE = isDateReversed ? DATABASE_DATE_DOT_REVERSE : DATABASE_DATE;
  const TIME = isDateReversed ? DATABASE_DATETIME_REVERSE : DATABASE_DATETIME;
  const MINUTE = `${DATE} %H:%M`;

  const TimeFormatsForGranularity: Record<TimeGranularity, string> = {
    [TimeGranularity.DATE]: DATE,
    [TimeGranularity.SECOND]: TIME,
    [TimeGranularity.MINUTE]: MINUTE,
    [TimeGranularity.FIVE_MINUTES]: MINUTE,
    [TimeGranularity.TEN_MINUTES]: MINUTE,
    [TimeGranularity.FIFTEEN_MINUTES]: MINUTE,
    [TimeGranularity.THIRTY_MINUTES]: MINUTE,
    [TimeGranularity.HOUR]: `${DATE} %H:00`,
    [TimeGranularity.DAY]: DATE,
    [TimeGranularity.WEEK]: DATE,
    [TimeGranularity.MONTH]: '%b %Y',
    [TimeGranularity.QUARTER]: '%Y Q%q',
    [TimeGranularity.YEAR]: '%Y',
    [TimeGranularity.WEEK_STARTING_SUNDAY]: DATE,
    [TimeGranularity.WEEK_STARTING_MONDAY]: DATE,
    [TimeGranularity.WEEK_ENDING_SATURDAY]: DATE,
    [TimeGranularity.WEEK_ENDING_SUNDAY]: DATE,
  };

  return TimeFormatsForGranularity;
};

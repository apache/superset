import TimeFormats from './TimeFormats';
import { TimeGranularity } from './types';

const { DATABASE_DATE, DATABASE_DATETIME } = TimeFormats;
const MINUTE = '%Y-%m-%d %H:%M';

/**
 * Map time granularity to d3-format string
 */
const TimeFormatsForGranularity: Record<TimeGranularity, string> = {
  [TimeGranularity.DATE]: DATABASE_DATE,
  [TimeGranularity.SECOND]: DATABASE_DATETIME,
  [TimeGranularity.MINUTE]: MINUTE,
  [TimeGranularity.FIVE_MINUTES]: MINUTE,
  [TimeGranularity.TEN_MINUTES]: MINUTE,
  [TimeGranularity.FIFTEEN_MINUTES]: MINUTE,
  [TimeGranularity.HALF_HOUR]: MINUTE,
  [TimeGranularity.HOUR]: '%Y-%m-%d %H:00',
  [TimeGranularity.DAY]: DATABASE_DATE,
  [TimeGranularity.WEEK]: DATABASE_DATE,
  [TimeGranularity.MONTH]: '%b %Y',
  [TimeGranularity.QUARTER]: '%Y Q%q',
  [TimeGranularity.YEAR]: '%Y',
  [TimeGranularity.WEEK_STARTING_SUNDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_STARTING_MONDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_ENDING_SATURDAY]: DATABASE_DATE,
  [TimeGranularity.WEEK_ENDING_SUNDAY]: DATABASE_DATE,
};

export default TimeFormatsForGranularity;

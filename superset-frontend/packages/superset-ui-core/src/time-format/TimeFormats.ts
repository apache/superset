// DODO was here

export const LOCAL_PREFIX = 'local!';

const DATABASE_DATETIME = '%Y-%m-%d %H:%M:%S';
const DATABASE_DATETIME_REVERSE = '%d-%m-%Y %H:%M:%S';
const US_DATE = '%m/%d/%Y';
const INTERNATIONAL_DATE = '%d/%m/%Y';
const DATABASE_DATE = '%Y-%m-%d';
const DATABASE_DATE_DOT_REVERSE = '%d.%m.%Y'; // DODO added 45525377
const TIME = '%H:%M:%S';

const TimeFormats = {
  DATABASE_DATE,
  DATABASE_DATETIME,
  DATABASE_DATETIME_REVERSE,
  INTERNATIONAL_DATE,
  TIME,
  US_DATE,
  DATABASE_DATE_DOT_REVERSE, // DODO added 45525377
};

export default TimeFormats;

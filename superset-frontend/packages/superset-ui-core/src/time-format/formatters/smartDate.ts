// DODO was here

import { TimeLocaleDefinition } from 'd3-time-format';
import createMultiFormatter from '../factories/createMultiFormatter';

export const SMART_DATE_ID = 'smart_date';
export const SMART_DATE_DOT_DDMMYYYY_ID = 'smart_date_dot_ddmmyyyy'; // DODO added 45525377

export function createSmartDateFormatter(locale?: TimeLocaleDefinition) {
  return createMultiFormatter({
    id: SMART_DATE_ID,
    label: 'Adaptative Formatting',
    formats: {
      millisecond: '.%Lms',
      second: ':%Ss',
      minute: '%I:%M',
      hour: '%I %p',
      day: '%a %d',
      week: '%b %d',
      month: '%B',
      year: '%Y',
    },
    locale,
  });
}

/* eslint-disable sort-keys */

import createMultiFormatter from '../factories/createMultiFormatter';

const smartDateFormatter = createMultiFormatter({
  id: 'smart_date_verbose',
  label: 'Verbose Adaptative Formatting',
  formats: {
    millisecond: '.%L',
    second: ':%S',
    minute: '%a %b %d, %I:%M %p',
    hour: '%a %b %d, %I %p',
    day: '%a %b %-e',
    week: '%a %b %-e',
    month: '%b %Y',
    year: '%Y',
  },
});

export default smartDateFormatter;

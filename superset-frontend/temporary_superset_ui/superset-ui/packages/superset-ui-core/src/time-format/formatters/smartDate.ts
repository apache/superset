import createMultiFormatter from '../factories/createMultiFormatter';

const smartDateFormatter = createMultiFormatter({
  id: 'smart_date',
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
});

export default smartDateFormatter;

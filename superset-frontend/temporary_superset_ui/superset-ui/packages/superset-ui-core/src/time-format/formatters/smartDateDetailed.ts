import createMultiFormatter from '../factories/createMultiFormatter';

const smartDateDetailedFormatter = createMultiFormatter({
  id: 'smart_date_detailed',
  label: 'Detailed adaptive formatter',
  formats: {
    millisecond: '%Y-%m-%d %H:%M:%S.%L',
    second: '%Y-%m-%d %H:%M:%S',
    minute: '%Y-%m-%d %H:%M',
    hour: '%Y-%m-%d %H:%M',
    day: '%Y-%m-%d',
    week: '%Y-%m-%d',
    month: '%Y-%m-%d',
    year: '%Y',
  },
});

export default smartDateDetailedFormatter;

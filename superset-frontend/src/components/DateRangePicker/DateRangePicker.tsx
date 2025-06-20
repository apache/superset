import { useState } from 'react';
import { DatePicker } from 'antd';
import moment from 'moment';
import { DateRangePickerProps } from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/types';

const { RangePicker } = DatePicker;

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const [dates, setDates] = useState<[moment.Moment, moment.Moment]>([
    moment(startDate),
    moment(endDate),
  ]);

  const handleDateChange = (dates: [moment.Moment, moment.Moment]) => {
    setDates(dates);
    onChange(dates[0].toDate(), dates[1].toDate());
  };

  return (
    <RangePicker
      value={dates}
      onChange={handleDateChange}
      format="YYYY-MM-DD"
    />
  );
};

export default DateRangePicker;

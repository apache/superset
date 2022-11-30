import React, { useState } from 'react';
import 'react-modern-calendar-datepicker/lib/DatePicker.css';
import { Calendar } from 'react-modern-calendar-datepicker';

// eslint-disable-next-line no-unused-vars
const jalaali = require('jalaali-js');

// eslint-disable-next-line no-unused-vars
const CalendarDatePicker = props => {
  // eslint-disable-next-line no-unused-vars
  const { changeFilter } = props;

  const defaultFrom = {
    year: 2019,
    month: 3,
    day: 4,
  };

  const defaultTo = {
    year: 2019,
    month: 3,
    day: 7,
  };

  const defaultRange = {
    from: defaultFrom,
    to: defaultTo,
  };

  const [selectedDayRange, setSelectedDayRange] = useState(defaultRange);

  const changeDateFilter = date => {
    const from = `${date.from.year}-${date.from.month}-${date.from.day}`;
    const to = `${date.to.year}-${date.to.month}-${date.to.day}`;
    const NewDate = `${from} : ${to}`;
    changeFilter('__time_range', NewDate);
  };
  return (
    <Calendar
      value={selectedDayRange}
      onChange={date => {
        setSelectedDayRange(date);
        changeDateFilter(date);
      }}
      colorPrimary="#0fbcf9"
      colorSecondary="rgba(75,207,250,0.4)"
      shouldHighlightWeekends
    />
  );
};

export default CalendarDatePicker;

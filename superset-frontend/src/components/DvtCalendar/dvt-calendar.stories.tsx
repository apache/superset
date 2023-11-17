import React from 'react';
import DvtCalendar from './index';

export default {
  title: 'Dvt-Components/Calendar',
  component: DvtCalendar,
};

export const InteractiveDatePicker = () => {
  const handleDateSelect = (selectedDate: moment.Moment) => {
    console.log('Selected date:', selectedDate.format('YYYY-MM-DD HH:mm:ss'));
  };

  return <DvtCalendar onSelect={handleDateSelect} />;
};
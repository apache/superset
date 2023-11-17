import React, { useState } from 'react';
import 'dayjs/locale/zh-cn';
import { Calendar, Select, Typography } from 'antd';
import Icon from '../Icons/Icon';

const DvtCalendar: React.FC = () => {
  const [isCalendarVisible, setCalendarVisible] = useState(true);
  const [isNextIconHovered, setNextIconHovered] = useState(false);
  const [isPrevIconHovered, setPrevIconHovered] = useState(false);

  const wrapperStyle: React.CSSProperties = {
    width: '308px',
    height: '315px',
    display: isCalendarVisible ? 'block' : 'none',
  };
  const handleToggleCalendar = () => {
    setCalendarVisible(!isCalendarVisible);
  };
  return (
    <div style={wrapperStyle}>
      <Calendar
        style={{
          borderRadius: '12px',
          boxShadow: '5px 5px 10px',
          paddingLeft: '11px',
          paddingRight: '11px',
        }}
        fullscreen={false}
        headerRender={({ value, type, onChange }) => {
          const start = 0;
          const end = 12;
          const monthOptions = [];

          let current = value.clone();
          const localeData = value.localeData();
          const months = [];
          for (let i = 0; i < 12; i++) {
            current = current.month(i);
            months.push(localeData.monthsShort(current));
          }

          for (let i = start; i < end; i++) {
            monthOptions.push(
              <Select.Option key={i} value={i} className="month-item">
                {months[i]}
              </Select.Option>,
            );
          }
          const monthNames = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];
          const year = value.year();
          const month = value.month();
          const options = [];
          for (let i = year - 10; i < year + 10; i += 1) {
            options.push(
              <Select.Option key={i} value={i} className="year-item">
                {i}
              </Select.Option>,
            );
          }

          const handlePrevMonth = () => {
            const newDate = value.clone().subtract(1, 'month');
            onChange(newDate);
          };

          const handleNextMonth = () => {
            const newDate = value.clone().add(1, 'month');
            onChange(newDate);
          };
          return (
            <div style={{ padding: 8, display: 'flex', alignItems: 'center' }}>
              <Typography.Title level={5} style={{ width: 140 }}>
                {monthNames[month]} {year}
              </Typography.Title>
              <Icon
                fileName="caret_left"
                iconColor={isPrevIconHovered ? 'blue' : 'gray'}
                style={{ cursor: 'pointer' }}
                iconSize="xl"
                onMouseEnter={() => setPrevIconHovered(true)}
                onMouseLeave={() => setPrevIconHovered(false)}
                onClick={handlePrevMonth}
              ></Icon>
              <Icon
                fileName="caret_right"
                iconColor={isNextIconHovered ? 'blue' : 'gray'}
                style={{ cursor: 'pointer' }}
                iconSize="xl"
                onMouseEnter={() => setNextIconHovered(true)}
                onMouseLeave={() => setNextIconHovered(false)}
                onClick={handleNextMonth}
              ></Icon>
              <Icon
                fileName="close"
                style={{ marginLeft: 'auto', cursor: 'pointer' }}
                iconSize="m"
                onClick={handleToggleCalendar}
              />
            </div>
          );
        }}
      />
    </div>
  );
};

export default DvtCalendar;

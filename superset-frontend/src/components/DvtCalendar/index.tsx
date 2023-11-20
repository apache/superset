import React, { useState } from 'react';
import moment, { Moment } from 'moment';
import { Calendar, Typography } from 'antd';
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledCalendar,
  StyledCalendarIcon,
  StyledCalendarDateCell,
} from './dvt-calendar.module';

export interface DvtCalendarProps {
  onSelect?: (date: Moment) => void;
}

const DvtCalendar: React.FC<DvtCalendarProps> = ({ onSelect }) => {
  const [isCalendarVisible, setCalendarVisible] = useState(true);
  const [isNextIconHovered, setNextIconHovered] = useState(false);
  const [isPrevIconHovered, setPrevIconHovered] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Moment | null>(
    moment(Date.now()),
  );

  const handleToggleCalendar = () => {
    setCalendarVisible(!isCalendarVisible);
  };

  return (
    <StyledCalendar isCalendarVisible={isCalendarVisible}>
      <Calendar
        dateFullCellRender={(date: Moment): React.ReactNode => {
          const isSelected: boolean = selectedDate
            ? date.isSame(selectedDate, 'day') &&
              date.isSame(selectedDate, 'month')
            : false;

          return (
            <StyledCalendarDateCell
              css={(theme: SupersetTheme) => ({
                backgroundColor: isSelected
                  ? theme.colors.dvt.primary.base
                  : '',
                borderRadius: '50px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected
                  ? `0px 5px 10px ${theme.colors.dvt.boxShadow.primaryLight3}`
                  : '',
                color: isSelected ? theme.colors.grayscale.light5 : '',
                position: 'relative',
              })}
              onClick={() => onSelect?.(date)}
            >
              {date.date()}
            </StyledCalendarDateCell>
          );
        }}
        css={(theme: SupersetTheme) => ({
          borderRadius: '12px',
          paddingLeft: '11px',
          paddingRight: '11px',
          boxShadow: `5px 5px 10px ${theme.colors.dvt.boxShadow.primaryLight3}`,
        })}
        fullscreen={false}
        onSelect={date => setSelectedDate(date)}
        headerRender={({ value, onChange }) => {
          let current = value.clone();
          const localeData = value.localeData();
          const months = [];
          for (let i = 0; i < 12; i += 1) {
            current = current.month(i);
            months.push(localeData.monthsShort(current));
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

          const handlePrevMonth = () => {
            const newDate = value.clone().subtract(1, 'month');
            onChange(newDate);
          };

          const handleNextMonth = () => {
            const newDate = value.clone().add(1, 'month');
            onChange(newDate);
          };
          return (
            <StyledCalendarIcon>
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
              />
              <Icon
                fileName="caret_right"
                iconColor={isNextIconHovered ? 'blue' : 'gray'}
                style={{ cursor: 'pointer' }}
                iconSize="xl"
                onMouseEnter={() => setNextIconHovered(true)}
                onMouseLeave={() => setNextIconHovered(false)}
                onClick={handleNextMonth}
              />
              <Icon
                fileName="close"
                style={{
                  marginLeft: 'auto',
                  marginTop: '4px',
                  cursor: 'pointer',
                }}
                iconSize="m"
                onClick={handleToggleCalendar}
              />
            </StyledCalendarIcon>
          );
        }}
      />
    </StyledCalendar>
  );
};

export default DvtCalendar;

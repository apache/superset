/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect, useState } from 'react';
import { Moment } from 'moment';
import { Calendar, Typography } from 'antd';
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledCalendar,
  StyledCalendarIcon,
  StyledCalendarDateCell,
} from './dvt-calendar.module';

export interface DvtCalendarProps {
  onSelect: (date: Moment | null) => void;
  isOpen: boolean;
  setIsOpen: (newCalendarVisible: boolean) => void;
  selectedDate: Moment | null;
  setSelectedDate: (date: Moment | null) => void;
}

const DvtCalendar: React.FC<DvtCalendarProps> = ({
  onSelect,
  isOpen,
  setIsOpen,
  selectedDate,
  setSelectedDate,
}) => {
  const [isNextIconHovered, setNextIconHovered] = useState(false);
  const [isPrevIconHovered, setPrevIconHovered] = useState(false);

  const handleToggleCalendar = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    onSelect(selectedDate);
  }, [selectedDate]);

  return (
    <StyledCalendar>
      {isOpen && (
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
                    ? `4px 8px 18px 0px ${theme.colors.dvt.boxShadow.primaryLight3}`
                    : '',
                  color: isSelected ? theme.colors.grayscale.light5 : '',
                  position: 'relative',
                })}
              >
                {date.date()}
              </StyledCalendarDateCell>
            );
          }}
          css={(theme: SupersetTheme) => ({
            borderRadius: '12px',
            paddingLeft: '11px',
            paddingRight: '11px',
            boxShadow: `4px 4px 10px ${theme.colors.dvt.boxShadow.light2}`,
          })}
          fullscreen={false}
          onSelect={date =>
            !(isPrevIconHovered || isNextIconHovered) &&
            (setSelectedDate(date))
          }
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
                  iconSize="xxl"
                  onMouseEnter={() => setPrevIconHovered(true)}
                  onMouseLeave={() => setPrevIconHovered(false)}
                  onClick={handlePrevMonth}
                />
                <Icon
                  fileName="caret_right"
                  iconColor={isNextIconHovered ? 'blue' : 'gray'}
                  style={{ cursor: 'pointer' }}
                  iconSize="xxl"
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
      )}
    </StyledCalendar>
  );
};

export default DvtCalendar;

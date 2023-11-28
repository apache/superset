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
import React, { useState } from 'react';
import { Moment } from 'moment';
import { Calendar, Select } from 'antd';
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledCalendar,
  StyledCalendarIcon,
  StyledCalendarDateCell,
  StyledCalendarDateCellClick,
} from './dvt-calendar.module';

export interface DvtCalendarProps {
  isOpen: boolean;
  setIsOpen: (newCalendarVisible: boolean) => void;
  selectedDate: Moment | null;
  setSelectedDate: (date: Moment | null) => void;
  selectedDateClose?: boolean;
}

const DvtCalendar: React.FC<DvtCalendarProps> = ({
  isOpen,
  setIsOpen,
  selectedDate,
  setSelectedDate,
  selectedDateClose = false,
}) => {
  const [isNextIconHovered, setNextIconHovered] = useState(false);
  const [isPrevIconHovered, setPrevIconHovered] = useState(false);

  const handleToggleCalendar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <StyledCalendar>
      {isOpen && (
        <Calendar
          defaultValue={selectedDate || undefined}
          dateFullCellRender={(date: Moment): React.ReactNode => {
            const isSelected: boolean = selectedDate
              ? date.isSame(selectedDate, 'day') &&
                date.isSame(selectedDate, 'month')
              : false;

            return (
              <StyledCalendarDateCell isSelected={isSelected}>
                <StyledCalendarDateCellClick
                  onClick={selectedDateClose ? handleToggleCalendar : () => {}}
                ></StyledCalendarDateCellClick>
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
            !(isPrevIconHovered || isNextIconHovered) && setSelectedDate(date)
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
            const options = [];
            for (let i = year - 10; i < year + 10; i += 1) {
              options.push(i);
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
              <StyledCalendarIcon>
                <Select
                  size="small"
                  dropdownMatchSelectWidth={false}
                  value={monthNames[month]}
                  onChange={newMonth => {
                    const now = value.clone().month(newMonth);
                    onChange(now);
                  }}
                  defaultValue={monthNames[month]}
                  bordered={false}
                >
                  {monthNames.map((month, index) => (
                    <Select.Option
                      key={month}
                      value={month}
                      className="month-item"
                      style={{ zIndex: 9999 }}
                    >
                      {month}
                    </Select.Option>
                  ))}
                </Select>
                <Select
                  size="small"
                  dropdownMatchSelectWidth={false}
                  value={year}
                  onChange={newYear => {
                    const now = value.clone().year(newYear);
                    onChange(now);
                  }}
                  bordered={false}
                >
                  {options.map((option, index) => (
                    <Select.Option
                      key={option}
                      value={option}
                      className="year-item"
                      style={{ zIndex: 9999 }}
                    >
                      {option}
                    </Select.Option>
                  ))}
                </Select>
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

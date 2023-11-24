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
import Icon from '../Icons/Icon';
import DvtCalendar from '../DvtCalendar';
import { Moment } from 'moment';
import moment from 'moment';
import {
  StyledDatepicker,
  StyledDatepickerLabel,
  StyledDatepickerInput,
  StyledDatepickerIcon,
  StyledDatepickerGroup,
  StyledDatepickerCalendar,
} from './dvt-datepicker.module';

export interface DvtDatePickerProps {
  label?: string;
  placeholder?: string;
  selectedDate: Moment | null;
  setSelectedDate: (newSeletedValue: Moment) => void;
  isOpen: boolean;
  setIsOpen: (newOpen: boolean) => void;
}

const DvtDatePicker: React.FC<DvtDatePickerProps> = ({
  label,
  placeholder,
  selectedDate,
  setSelectedDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleCalendarOpen = () => {
    setIsOpen(true);
  };

  const handleDatepickerClick = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    setIsOpen(false);
  }, [selectedDate]);

  return (
    <StyledDatepicker>
      {label && <StyledDatepickerLabel>{label}</StyledDatepickerLabel>}
      <StyledDatepickerGroup>
        <StyledDatepickerInput
          isOpen={isOpen}
          type={!isOpen ? 'text' : isOpen && selectedDate ? 'text' : 'date'}
          onClick={handleCalendarOpen}
          value={selectedDate ? moment(selectedDate).format('YYYY-MM-DD') : ''}
          placeholder={placeholder}
        />
        <StyledDatepickerIcon isOpen={isOpen} onClick={handleDatepickerClick}>
          <Icon fileName="caret_right" iconSize="xxl" iconColor="black" />
        </StyledDatepickerIcon>
      </StyledDatepickerGroup>
      {isOpen && (
        <StyledDatepickerCalendar label={label || ''}>
          <DvtCalendar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
          />
        </StyledDatepickerCalendar>
      )}
    </StyledDatepicker>
  );
};

export default DvtDatePicker;

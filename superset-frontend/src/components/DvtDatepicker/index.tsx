/* eslint-disable translation-vars/no-template-vars */
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
import React, { useEffect, useState, useRef } from 'react';
import { t } from '@superset-ui/core';
import useOnClickOutside from 'src/hooks/useOnClickOutsite';
import moment, { Moment } from 'moment';
import Icon from '../Icons/Icon';

import DvtCalendar from '../DvtCalendar';
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
  width?: number;
  maxWidth?: boolean;
}

const DvtDatePicker: React.FC<DvtDatePickerProps> = ({
  label = '',
  placeholder = '',
  selectedDate,
  setSelectedDate,
  width = 202,
  maxWidth = false,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  useOnClickOutside(ref, () => setIsOpen(false));

  const handleCalendarOpen = () => {
    setIsOpen(true);
  };

  const handleDatepickerClick = () => {
    setIsOpen(!isOpen);
  };
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleInputBlur = () => {
    const parsedDate = moment(inputValue, 'YYYY-MM-DD', true);

    if (parsedDate.isValid()) {
      setSelectedDate(parsedDate);
    }
  };
  useEffect(() => {
    setInputValue(
      selectedDate ? moment(selectedDate).format('YYYY-MM-DD') : '',
    );
  }, [selectedDate]);

  return (
    <StyledDatepicker ref={ref} style={{ minWidth: maxWidth ? '100%' : width }}>
      {t(`${label}`) && (
        <StyledDatepickerLabel>{t(`${label}`)}</StyledDatepickerLabel>
      )}
      <StyledDatepickerGroup>
        <StyledDatepickerInput
          isOpen={isOpen}
          type="date"
          onClick={handleCalendarOpen}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          value={inputValue}
          placeholder={t(`${placeholder}`)}
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
            selectedDateClose
          />
        </StyledDatepickerCalendar>
      )}
    </StyledDatepicker>
  );
};

export default DvtDatePicker;

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
import { keyframes, styled } from '@superset-ui/core';

interface StyledDatePickerProps {
  isOpen: boolean;
}
interface StyledDatepickerCalendarProps {
  label: string;
}
const datePickerKeyframes = keyframes`
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
`;
const StyledDatepicker = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
`;

const StyledDatepickerGroup = styled.div`
  position: relative;
  display: inline-flex;
  width: 202px;
  height: 48px;
  padding: 12px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  margin-bottom: 3px;
  color: ${({ theme }) => theme.colors.dvt.primary.light1};
`;

const StyledDatepickerInput = styled.input<StyledDatePickerProps>`
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  border: none;
  ::-webkit-inner-spin-button,
  ::-webkit-calendar-picker-indicator {
    display: none;
    -webkit-appearance: none;
  }
  &:focus {
    outline: none;
  }
`;

const StyledDatepickerLabel = styled.label`
  padding-left: 13px;
  font-weight: 600;
`;

const StyledDatepickerIcon = styled.div<StyledDatePickerProps>`
  position: absolute;
  right: 12px;
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(90deg)' : 'none')};
  cursor: pointer;
`;
const StyledDatepickerCalendar = styled.div<StyledDatepickerCalendarProps>`
  position: absolute;
  top: ${({ label }) => (label ? '74px' : '52px')};
  left: 0;
  right: 0;
  animation: ${datePickerKeyframes} 0.3s ease-in-out;
  transform-origin: top;
`;

export {
  StyledDatepicker,
  StyledDatepickerLabel,
  StyledDatepickerInput,
  StyledDatepickerIcon,
  StyledDatepickerGroup,
  StyledDatepickerCalendar,
};

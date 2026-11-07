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
import { useMemo, FC } from 'react';
import type { Dayjs } from 'dayjs';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { RangePicker } from '@superset-ui/core/components';
import type { CalendarRangePickerProps } from './types';
import {
  parseRangeValue,
  formatRangeValue,
  DEFAULT_DATE_FORMAT,
} from './utils';

const StyledRangePicker = styled(RangePicker)`
  ${({ theme }) => css`
    width: 100%;
    border-radius: ${theme.borderRadius}px;

    .ant-picker-input > input {
      font-size: ${theme.fontSize}px;
    }

    &.ant-picker {
      border-color: ${theme.colorBorder};
      &:hover {
        border-color: ${theme.colorPrimaryHover || theme.colorPrimary};
      }
      &.ant-picker-focused {
        border-color: ${theme.colorPrimary};
        box-shadow: 0 0 0 2px ${theme.controlOutline};
      }
    }

    @media (max-width: ${theme.breakpoints?.xs ?? 768}px) {
      .ant-picker-panels {
        flex-direction: column;
      }
    }
  `}
`;

export const CalendarRangePicker: FC<CalendarRangePickerProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder,
  format = DEFAULT_DATE_FORMAT,
  clearValue = '',
  allowClear = true,
  inclusiveEndDate = true,
  className,
  style,
  'data-test': dataTest = 'calendar-range-picker',
  autoFocus = false,
  size,
  status,
  disabledDate,
  id,
}) => {
  const dayjsValue = useMemo(
    () => parseRangeValue(value, format),
    [value, format],
  );

  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    const formatted = formatRangeValue(dates, format, clearValue);
    onChange?.(formatted);
  };

  const defaultPlaceholder: [string, string] = [
    t('Start date'),
    t('End date'),
  ];

  return (
    <StyledRangePicker
      id={id}
      data-test={dataTest}
      className={className}
      style={style}
      value={dayjsValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder || defaultPlaceholder}
      format={format}
      allowClear={allowClear}
      autoFocus={autoFocus}
      size={size}
      status={status}
      disabledDate={disabledDate}
      popupMatchSelectWidth={false}
    />
  );
};

export default CalendarRangePicker;

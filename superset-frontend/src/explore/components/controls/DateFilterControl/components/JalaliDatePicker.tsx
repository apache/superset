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
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import DateObject, { type Month } from 'react-date-object';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import type { Dayjs } from 'dayjs';
import { useResizeDetector } from 'react-resize-detector';
import {
  gregorianToPersian,
  persianToGregorian,
} from 'src/utils/persianCalendar';

type BasePickerProps = {
  placeholder?: string;
  style?: CSSProperties;
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  forceRTL?: boolean;
  minYear?: number;
  maxYear?: number;
};

type SingleModeProps = BasePickerProps & {
  mode?: 'single';
  value: Dayjs | null;
  onChange: (date: Dayjs | null) => void;
};

type RangeModeProps = BasePickerProps & {
  mode: 'range';
  value: [Dayjs | null, Dayjs | null];
  onChange: (range: [Dayjs | null, Dayjs | null]) => void;
};

export type JalaliDatePickerProps = SingleModeProps | RangeModeProps;

const getMonthNumber = (month?: number | Month): number => {
  if (!month) {
    return 1;
  }
  return typeof month === 'number' ? month : month.number;
};

const buildDateObject = (year: number, month: number, day: number) =>
  new DateObject({
    calendar: persian,
    locale: persian_fa,
    year,
    month,
    day,
  });

const detectRTL = () => {
  if (typeof document === 'undefined') {
    return true;
  }
  const doc = document.documentElement;
  if (doc?.dir === 'rtl' || doc?.lang?.startsWith('fa')) {
    return true;
  }
  if (typeof navigator !== 'undefined') {
    return navigator.language?.startsWith('fa') ?? false;
  }
  return true;
};

/**
 * JalaliDatePicker component that displays Persian calendar but returns Gregorian dates.
 * Supports both single-date and range selection modes.
 */
export function JalaliDatePicker(props: JalaliDatePickerProps) {
  const {
    placeholder = 'تاریخ را انتخاب کنید',
    style,
    placement = 'bottomRight',
    forceRTL,
    minYear = 782,
    maxYear = 1500,
  } = props;

  const isRangeMode = props.mode === 'range';
  const singleValue = !isRangeMode ? (props.value as Dayjs | null) : null;
  const rangeValue = isRangeMode
    ? (props.value as [Dayjs | null, Dayjs | null])
    : null;
  const [jalaliReady, setJalaliReady] = useState(false);
  const isRTL = forceRTL ?? detectRTL();
  const { ref: resizeRef, width: containerWidth } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 100,
  });

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jalaliPlugin = require('dayjs-jalali');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jalaliDayjsModule = jalaliPlugin.default || jalaliPlugin;
      dayjs.extend(jalaliDayjsModule);
      setJalaliReady(true);
    } catch (error) {
      console.warn('Failed to load dayjs-jalali plugin:', error);
      setJalaliReady(false);
    }
  }, []);

  const convertDayjsToDateObject = useCallback(
    (currentValue: Dayjs): DateObject | undefined => {
      if (!currentValue || !currentValue.isValid()) {
        return undefined;
      }

      if (jalaliReady) {
        try {
          const jDate = dayjs(currentValue) as Dayjs & {
            jYear: () => number;
            jMonth: () => number;
            jDate: () => number;
          };
          return buildDateObject(
            jDate.jYear(),
            jDate.jMonth() + 1,
            jDate.jDate(),
          );
        } catch (error) {
          console.warn('Error converting to Jalali:', error);
        }
      }

      try {
        const persianDate = gregorianToPersian(
          currentValue.year(),
          currentValue.month() + 1,
          currentValue.date(),
        );
        return buildDateObject(
          persianDate.year,
          persianDate.month,
          persianDate.day,
        );
      } catch (error) {
        console.error('Error in fallback conversion:', error);
        return undefined;
      }
    },
    [jalaliReady],
  );

  const convertDateObjectToDayjs = useCallback(
    (date: DateObject | null): Dayjs | null => {
      if (!date) {
        return null;
      }
      const monthValue = getMonthNumber(date.month as number | Month | undefined);

      if (jalaliReady) {
        try {
          const jalaliDate = dayjs(
            `${date.year}/${monthValue}/${date.day}`,
            'jYYYY/jM/jD',
          );
          const gregorianDate = dayjs(jalaliDate.toDate());
          if (gregorianDate.isValid()) {
            return gregorianDate;
          }
        } catch (error) {
          console.warn('Error converting Jalali to Gregorian:', error);
        }
      }

      try {
        const gregorian = persianToGregorian(date.year, monthValue, date.day);
        const converted = dayjs(
          `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(
            gregorian.day,
          ).padStart(2, '0')}`,
        );
        return converted.isValid() ? converted : null;
      } catch (error) {
        console.error('Error in fallback conversion:', error);
        return null;
      }
    },
    [jalaliReady],
  );

  const jalaliValue = useMemo<DateObject | DateObject[] | undefined>(() => {
    if (isRangeMode) {
      if (!rangeValue) {
        return undefined;
      }
      const converted = rangeValue
        .map(value => (value ? convertDayjsToDateObject(value) : undefined))
        .filter(
          (result): result is DateObject =>
            Boolean(result) && result instanceof DateObject,
        );
      return converted.length ? converted : undefined;
    }

    if (!singleValue) {
      return undefined;
    }

    return convertDayjsToDateObject(singleValue);
  }, [convertDayjsToDateObject, isRangeMode, rangeValue, singleValue]);

  const todayJalali = useMemo(() => {
    const today = dayjs();
    return convertDayjsToDateObject(today);
  }, [convertDayjsToDateObject]);

  const minDateObject = useMemo(
    () => buildDateObject(minYear, 1, 1),
    [minYear],
  );
  const maxDateObject = useMemo(
    () => buildDateObject(maxYear, 12, 29),
    [maxYear],
  );

  const handleDateChange = (selected: DateObject | DateObject[] | null) => {
    if (isRangeMode) {
      const normalized = Array.isArray(selected)
        ? selected
        : selected
        ? [selected]
        : [];

      const startCandidate = normalized[0] ?? null;
      const endCandidate =
        normalized.length > 1 ? normalized[normalized.length - 1] : null;
      const rangeStart = convertDateObjectToDayjs(startCandidate);
      const rangeEnd = endCandidate
        ? convertDateObjectToDayjs(endCandidate)
        : rangeStart;

      (props as RangeModeProps).onChange([rangeStart, rangeEnd]);
      return;
    }

    const nextValue = convertDateObjectToDayjs(selected as DateObject | null);
    (props as SingleModeProps).onChange(nextValue);
  };

  const monthsToShow = useMemo(() => {
    if (!isRangeMode) {
      return 1;
    }
    if (!containerWidth) {
      return 2;
    }
    return containerWidth < 520 ? 1 : 2;
  }, [containerWidth, isRangeMode]);

  return (
    <div
      ref={resizeRef}
      style={{ width: '100%', direction: isRTL ? 'rtl' : 'ltr', ...style }}
      onClick={event => event.stopPropagation()}
    >
      <DatePicker
        calendar={persian}
        locale={persian_fa}
        value={jalaliValue}
        onChange={handleDateChange}
        format="YYYY/MM/DD"
        calendarPosition={placement}
        containerClassName="custom-rmdp"
        inputClass={`jalali-date-input${
          isRangeMode ? ' jalali-date-input--range' : ''
        }`}
        style={{
          width: '100%',
          direction: isRTL ? 'rtl' : 'ltr',
          textAlign: isRTL ? 'right' : 'left',
        }}
        placeholder={placeholder}
        multiple={false}
        range={isRangeMode}
        numberOfMonths={monthsToShow}
        rangeHover={isRangeMode}
        showOtherDays
        minDate={minDateObject}
        maxDate={maxDateObject}
        portal={false}
        mapDays={({ date }) => {
          if (
            todayJalali &&
            date.year === todayJalali.year &&
            getMonthNumber(date.month) === getMonthNumber(todayJalali.month) &&
            date.day === todayJalali.day
          ) {
            return { className: 'rmdp-day-today' };
          }
          return {};
        }}
      />
      <style>{`
        .custom-rmdp {
          position: relative;
          width: 100%;
        }
        .custom-rmdp .rmdp-wrapper {
          direction: ${isRTL ? 'rtl' : 'ltr'};
          z-index: 10000 !important;
          background: white;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          padding: 8px;
          width: 100%;
          max-width: 100%;
        }
        .custom-rmdp .rmdp-calendar {
          direction: ${isRTL ? 'rtl' : 'ltr'};
          z-index: 10000 !important;
          width: 100%;
          max-width: 100%;
        }
        .custom-rmdp .rmdp-header {
          padding: 8px;
          border-bottom: 1px solid #f0f0f0;
          margin-bottom: 8px;
        }
        .custom-rmdp .rmdp-header-values {
          font-weight: 600;
          font-size: 14px;
          color: #1890ff;
        }
        .custom-rmdp .rmdp-arrow {
          border: solid #1890ff;
          border-width: 0 2px 2px 0;
          padding: 3px;
          cursor: pointer;
        }
        .custom-rmdp .rmdp-arrow:hover {
          border-color: #40a9ff;
        }
        .custom-rmdp .rmdp-arrow-container {
          cursor: pointer;
          padding: 4px;
        }
        .custom-rmdp .rmdp-arrow-container:hover {
          background-color: #f0f0f0;
          border-radius: 4px;
        }
        .custom-rmdp .rmdp-week-day {
          color: #1890ff;
          font-weight: 600;
          padding: 8px;
        }
        .custom-rmdp .rmdp-day {
          cursor: pointer;
          padding: 4px;
          margin: 2px;
          border-radius: 4px;
        }
        .custom-rmdp .rmdp-day:hover {
          background-color: #e6f7ff !important;
        }
        .custom-rmdp .rmdp-day.rmdp-selected span:not(.highlight) {
          background-color: #1890ff !important;
          color: white !important;
          border-radius: 4px;
        }
        .custom-rmdp .rmdp-day.rmdp-today span,
        .custom-rmdp .rmdp-day-today span {
          background-color: #e6f7ff !important;
          border: 1px solid #1890ff !important;
          font-weight: bold;
          border-radius: 4px;
        }
        .custom-rmdp .rmdp-day.rmdp-today:hover span,
        .custom-rmdp .rmdp-day-today:hover span {
          background-color: #bae7ff !important;
        }
        .custom-rmdp .rmdp-day.rmdp-disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .custom-rmdp .rmdp-day.rmdp-disabled:hover {
          background-color: transparent !important;
        }
        .jalali-date-input {
          width: 100%;
          cursor: pointer;
          padding: 4px 11px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
        }
        .jalali-date-input:hover {
          border-color: #40a9ff;
        }
        .jalali-date-input:focus {
          border-color: #40a9ff;
          outline: 0;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }
        .jalali-date-input--range {
          text-align: ${isRTL ? 'right' : 'left'};
        }
        .rmdp-container,
        .rmdp-popup {
          z-index: 10000 !important;
        }
      `}</style>
    </div>
  );
}

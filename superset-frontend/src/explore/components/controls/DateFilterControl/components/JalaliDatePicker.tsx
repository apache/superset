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
import { useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import DateObject, { type Month } from 'react-date-object';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import type { Dayjs } from 'dayjs';
import { css, styled } from '@apache-superset/core/ui';
import { useResizeDetector } from 'react-resize-detector';
import {
  ensureJalaliDayjsPlugin,
  gregorianToPersian,
  isRTLLayout,
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

type JalaliDayjs = Dayjs & {
  jYear: () => number;
  jMonth: () => number;
  jDate: () => number;
};

const getMonthNumber = (month?: number | Month): number => {
  if (!month) {
    return 1;
  }
  return typeof month === 'number' ? month : month.number;
};

const hasValidPersianParts = (
  year?: number,
  month?: number,
  day?: number,
) => Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);

const buildDateObject = (year: number, month: number, day: number) =>
  new DateObject({
    calendar: persian,
    locale: persian_fa,
    year,
    month,
    day,
  });

const PickerContainer = styled.div<{ $isRTL: boolean }>(
  ({ theme, $isRTL }) => css`
    width: 100%;
    direction: ${$isRTL ? 'rtl' : 'ltr'};

    .custom-rmdp {
      position: relative;
      width: 100%;
    }

    .custom-rmdp .rmdp-wrapper {
      direction: ${$isRTL ? 'rtl' : 'ltr'};
      z-index: ${theme.zIndexPopupBase + 1};
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      box-shadow: ${theme.boxShadow};
      padding: ${theme.paddingSM}px;
      width: 100%;
      max-width: 100%;
    }

    .custom-rmdp .rmdp-calendar {
      direction: ${$isRTL ? 'rtl' : 'ltr'};
      z-index: ${theme.zIndexPopupBase + 1};
      width: 100%;
      max-width: 100%;
    }

    .custom-rmdp .rmdp-header {
      padding: ${theme.paddingSM}px;
      border-bottom: 1px solid ${theme.colorBorder};
      margin-bottom: ${theme.marginSM}px;
    }

    .custom-rmdp .rmdp-header-values {
      font-weight: ${theme.fontWeightStrong};
      font-size: ${theme.fontSize}px;
      color: ${theme.colorPrimary};
    }

    .custom-rmdp .rmdp-arrow {
      border: solid ${theme.colorPrimary};
      border-width: 0 2px 2px 0;
      padding: 3px;
      cursor: pointer;
    }

    .custom-rmdp .rmdp-arrow-container {
      cursor: pointer;
      padding: ${theme.paddingXS}px;
      border-radius: ${theme.borderRadius}px;
    }

    .custom-rmdp .rmdp-arrow-container:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }

    .custom-rmdp .rmdp-week-day {
      color: ${theme.colorPrimary};
      font-weight: ${theme.fontWeightStrong};
      padding: ${theme.paddingSM}px;
    }

    .custom-rmdp .rmdp-day {
      cursor: pointer;
      padding: ${theme.paddingXS}px;
      margin: ${theme.marginXS}px;
      border-radius: ${theme.borderRadius}px;
    }

    .custom-rmdp .rmdp-day:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }

    .custom-rmdp .rmdp-day.rmdp-selected span:not(.highlight) {
      background-color: ${theme.colorPrimary};
      color: ${theme.colorTextLightSolid};
      border-radius: ${theme.borderRadius}px;
    }

    .custom-rmdp .rmdp-day.rmdp-today span,
    .custom-rmdp .rmdp-day-today span {
      background-color: ${theme.colorPrimaryBg};
      border: 1px solid ${theme.colorPrimaryBorder};
      font-weight: ${theme.fontWeightStrong};
      border-radius: ${theme.borderRadius}px;
    }

    .custom-rmdp .rmdp-day.rmdp-disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .custom-rmdp .rmdp-day.rmdp-disabled:hover {
      background-color: transparent;
    }

    .jalali-date-input {
      width: 100%;
      cursor: pointer;
      padding: ${theme.paddingXS}px ${theme.paddingSM}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      direction: ${$isRTL ? 'rtl' : 'ltr'};
      text-align: ${$isRTL ? 'right' : 'left'};
    }

    .jalali-date-input:hover {
      border-color: ${theme.colorPrimary};
    }

    .jalali-date-input:focus {
      border-color: ${theme.colorPrimary};
      outline: 0;
      box-shadow: 0 0 0 2px ${theme.colorPrimaryBorder};
    }

    .jalali-date-input--range {
      text-align: ${$isRTL ? 'right' : 'left'};
    }

    .rmdp-container,
    .rmdp-popup {
      z-index: ${theme.zIndexPopupBase + 1};
    }

    .rmdp-calendar-container-mobile {
      inset: 0;
      background-color: rgba(0, 0, 0, 0.6);
    }

    .rmdp-calendar-container-mobile .rmdp-mobile.rmdp-wrapper {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }

    .rmdp-mobile.rmdp-wrapper {
      box-shadow: none;
      border: 1px solid ${theme.colorBorder};
    }

    .rmdp-mobile .rmdp-header,
    .rmdp-mobile .rmdp-panel-header {
      height: 30px;
      font-size: ${theme.fontSize}px;
      padding-bottom: ${theme.paddingSM}px;
    }

    .rmdp-mobile .rmdp-arrow-container {
      height: 26px;
      width: 26px;
    }
  `,
);

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
  const jalaliReady = useMemo(() => ensureJalaliDayjsPlugin(), []);
  const isRTL = useMemo(
    () => (forceRTL !== undefined ? forceRTL : isRTLLayout()),
    [forceRTL],
  );
  const { ref: resizeRef, width: containerWidth } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 100,
  });

  const convertDayjsToDateObject = useCallback(
    (currentValue: Dayjs): DateObject | undefined => {
      if (!currentValue || !currentValue.isValid()) {
        return undefined;
      }

      if (jalaliReady) {
        try {
          const jDate = dayjs(currentValue) as JalaliDayjs;
          return buildDateObject(
            jDate.jYear(),
            jDate.jMonth() + 1,
            jDate.jDate(),
          );
        } catch (error) {
          // eslint-disable-next-line no-console
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
      } catch {
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
      if (!hasValidPersianParts(date.year, monthValue, date.day)) {
        return null;
      }

      if (jalaliReady) {
        try {
          const jalaliDate = dayjs(
            `${date.year}/${monthValue}/${date.day}`,
            'jYYYY/jM/jD',
          );
          if (jalaliDate.isValid()) {
            const gregorianDate = dayjs(jalaliDate.toDate());
            if (gregorianDate.isValid()) {
              return gregorianDate;
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Error converting Jalali to Gregorian:', error);
        }
      }

      try {
        const gregorian = persianToGregorian(date.year, monthValue, date.day);
        const formatted = `${gregorian.year}-${String(gregorian.month).padStart(
          2,
          '0',
        )}-${String(gregorian.day).padStart(2, '0')}`;
        const converted = dayjs(formatted);
        return converted.isValid() ? converted : null;
      } catch {
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
    <PickerContainer
      ref={resizeRef}
      style={{ width: '100%', ...style }}
      $isRTL={isRTL}
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
    </PickerContainer>
  );
}

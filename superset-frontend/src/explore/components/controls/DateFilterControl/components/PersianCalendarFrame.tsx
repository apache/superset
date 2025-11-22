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
import { NO_TIME_RANGE, t } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
// eslint-disable-next-line no-restricted-imports
import { Button } from '@superset-ui/core/components/Button';
import { Radio } from '@superset-ui/core/components/Radio';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import type { Dayjs } from 'dayjs';
import {
  formatPersianDate,
  getCurrentPersianDate,
  gregorianToPersian,
  isPersianLocale,
  isRTLLayout,
  persianToGregorian,
} from 'src/utils/persianCalendar';
import { JalaliDatePicker } from './JalaliDatePicker';

type PersianCalendarRangeType =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_year'
  | 'custom_range';

interface RangeDefinition {
  key: PersianCalendarRangeType;
  label: string;
  labelFa: string;
  timeRange?: string;
}

const PERSIAN_RANGE_LABELS: Record<PersianCalendarRangeType, string> = {
  last_7_days: '۷ روز گذشته',
  last_30_days: '۳۰ روز گذشته',
  last_90_days: '۹۰ روز گذشته',
  last_year: 'یک سال گذشته',
  custom_range: 'بازه سفارشی',
};

const RANGE_DEFINITIONS: RangeDefinition[] = [
  {
    key: 'last_7_days',
    label: t('Last 7 days'),
    labelFa: PERSIAN_RANGE_LABELS.last_7_days,
    timeRange: 'Last 7 days',
  },
  {
    key: 'last_30_days',
    label: t('Last 30 days'),
    labelFa: PERSIAN_RANGE_LABELS.last_30_days,
    timeRange: 'Last 30 days',
  },
  {
    key: 'last_90_days',
    label: t('Last 90 days'),
    labelFa: PERSIAN_RANGE_LABELS.last_90_days,
    timeRange: 'Last 90 days',
  },
  {
    key: 'last_year',
    label: t('Last year'),
    labelFa: PERSIAN_RANGE_LABELS.last_year,
    timeRange: 'Last year',
  },
  {
    key: 'custom_range',
    label: t('Custom range'),
    labelFa: PERSIAN_RANGE_LABELS.custom_range,
  },
];

const RANGE_VALUE_TO_KEY = new Map(
  RANGE_DEFINITIONS.filter(def => def.timeRange).map(def => [
    def.timeRange as string,
    def.key,
  ]),
);

const RANGE_KEY_TO_VALUE = new Map(
  RANGE_DEFINITIONS.filter(def => def.timeRange).map(def => [
    def.key,
    def.timeRange as string,
  ]),
);

const DEFAULT_RANGE: PersianCalendarRangeType = 'last_7_days';

const PERSIAN_TEXT = {
  title: 'فیلتر تقویم شمسی',
  selectTimeRange: 'انتخاب بازه زمانی',
  chooseCustomRange: 'انتخاب بازه دلخواه',
  selectRangePlaceholder: 'بازه تاریخ را انتخاب کنید',
  startToToday: 'تنظیم شروع روی امروز',
  endToToday: 'تنظیم پایان روی امروز',
  selectedRangeLabel: 'بازه انتخاب‌شده (جلالی)',
  currentDateLabel: 'تاریخ جلالی امروز',
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

const toPersianDigits = (value: string) =>
  value.replace(/\d/g, digit => PERSIAN_DIGITS[Number(digit)]);

// Dates below this threshold are treated as Jalali years and converted to Gregorian.
// Jalali years (13xx/14xx) stay below 1700, while persisted Gregorian years exceed it.
const YEAR_THRESHOLD_GREGORIAN_VS_JALALI = 1700;

interface FrameComponentProps {
  onChange: (value: string) => void;
  value?: string;
}

const Container = styled.div<{ $isRTL: boolean }>`
  ${({ theme, $isRTL }) => css`
    padding: ${theme.padding}px;
    direction: ${$isRTL ? 'rtl' : 'ltr'};
    text-align: ${$isRTL ? 'right' : 'left'};
  `}
`;

const SectionTitle = styled.h3`
  ${({ theme }) => css`
    margin: 0 0 ${theme.marginSM}px;
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const SectionLabel = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.marginXS}px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const SummaryCard = styled.div<{ $variant?: 'default' | 'info' }>`
  ${({ theme, $variant = 'default' }) => css`
    margin-top: ${theme.marginSM}px;
    padding: ${theme.paddingSM}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${
      $variant === 'info' ? theme.colorPrimaryBorder : theme.colorBorder
    };
    background-color: ${
      $variant === 'info' ? theme.colorPrimaryBgHover : theme.colorBgContainer
    };
  `}
`;

const PickerActions = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.marginXS}px;
    margin-top: ${theme.marginXS}px;
    justify-content: flex-end;
    flex-wrap: wrap;
  `}
`;

const RadioGroup = styled(Radio.Group)`
  width: 100%;
`;

const RadioList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.marginXS}px;
`;

export function PersianCalendarFrame({
  onChange,
  value,
}: FrameComponentProps) {
  const [selectedRange, setSelectedRange] = useState<PersianCalendarRangeType>(
    DEFAULT_RANGE,
  );
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null);
  const [currentPersianDate] = useState(getCurrentPersianDate());

  const isRTL = useMemo(() => isRTLLayout(), []);

  const shouldUsePersianText = useMemo(() => isPersianLocale(), []);

  const normalizeToGregorian = useCallback(
    (date: Dayjs | null): Dayjs | null => {
      if (!date) {
        return null;
      }
      if (date.year() >= YEAR_THRESHOLD_GREGORIAN_VS_JALALI) {
        return date;
      }
      const converted = persianToGregorian(
        date.year(),
        date.month() + 1,
        date.date(),
      );
      return dayjs(
        `${converted.year}-${String(converted.month).padStart(2, '0')}-${String(
          converted.day,
        ).padStart(2, '0')}`,
      );
    },
    [],
  );

  useEffect(() => {
    if (!value || value === NO_TIME_RANGE) {
      setSelectedRange(DEFAULT_RANGE);
      setCustomStartDate(null);
      setCustomEndDate(null);
      return;
    }

    const matchedRange = RANGE_VALUE_TO_KEY.get(value);
    if (matchedRange) {
      setSelectedRange(matchedRange);
      setCustomStartDate(null);
      setCustomEndDate(null);
      return;
    }

    if (value.includes(' : ')) {
      const [startStr, endStr] = value.split(' : ').map(str => str.trim());
      const start = dayjs(startStr);
      const end = dayjs(endStr);
      if (start.isValid() && end.isValid()) {
        setSelectedRange('custom_range');
        setCustomStartDate(normalizeToGregorian(start));
        setCustomEndDate(normalizeToGregorian(end));
      }
    }
  }, [normalizeToGregorian, value]);

  const updateCustomRange = useCallback(
    (startDate: Dayjs | null, endDate: Dayjs | null) => {
      const normalizedStart = normalizeToGregorian(startDate);
      const normalizedEnd = normalizeToGregorian(endDate);
      setCustomStartDate(normalizedStart);
      setCustomEndDate(normalizedEnd);
      if (normalizedStart && normalizedEnd) {
        onChange(
          `${normalizedStart.format('YYYY-MM-DD')} : ${normalizedEnd.format(
            'YYYY-MM-DD',
          )}`,
        );
      }
    },
    [normalizeToGregorian, onChange],
  );

  const handleCustomRangeSelection = useCallback(
    (range: [Dayjs | null, Dayjs | null]) => {
      updateCustomRange(range[0], range[1]);
    },
    [updateCustomRange],
  );

  const handleRangeChange = (range: PersianCalendarRangeType) => {
    setSelectedRange(range);
    if (range === 'custom_range') {
      const today = dayjs();
      updateCustomRange(today, today);
      return;
    }
    setCustomStartDate(null);
    setCustomEndDate(null);
    const relativeValue = RANGE_KEY_TO_VALUE.get(range);
    if (relativeValue) {
      onChange(relativeValue);
    }
  };

  const setBoundaryToToday = (target: 'start' | 'end') => {
    const today = dayjs();
    if (target === 'start') {
      updateCustomRange(today, customEndDate);
    } else {
      updateCustomRange(customStartDate, today);
    }
  };

  const customRangeSummary = useMemo(() => {
    if (!customStartDate || !customEndDate) {
      return undefined;
    }
    const startParts = gregorianToPersian(
      customStartDate.year(),
      customStartDate.month() + 1,
      customStartDate.date(),
    );
    const endParts = gregorianToPersian(
      customEndDate.year(),
      customEndDate.month() + 1,
      customEndDate.date(),
    );
    const summary = `${formatPersianDate(
      startParts.year,
      startParts.month,
      startParts.day,
    )}${shouldUsePersianText ? ' تا ' : ' – '}${formatPersianDate(
      endParts.year,
      endParts.month,
      endParts.day,
    )}`;
    return shouldUsePersianText ? toPersianDigits(summary) : summary;
  }, [customEndDate, customStartDate, shouldUsePersianText]);

  const currentDateDisplay = useMemo(() => {
    const baseText = `${formatPersianDate(
      currentPersianDate.year,
      currentPersianDate.month,
      currentPersianDate.day,
    )} (${currentPersianDate.monthName})`;
    return shouldUsePersianText ? toPersianDigits(baseText) : baseText;
  }, [currentPersianDate, shouldUsePersianText]);

  const titleText = shouldUsePersianText
    ? PERSIAN_TEXT.title
    : t('Persian calendar filter');
  const selectRangeText = shouldUsePersianText
    ? PERSIAN_TEXT.selectTimeRange
    : t('Select time range');
  const chooseCustomRangeText = shouldUsePersianText
    ? PERSIAN_TEXT.chooseCustomRange
    : t('Choose custom range');
  const setStartTodayText = shouldUsePersianText
    ? PERSIAN_TEXT.startToToday
    : t('Set start to today');
  const setEndTodayText = shouldUsePersianText
    ? PERSIAN_TEXT.endToToday
    : t('Set end to today');
  const selectedRangeLabel = shouldUsePersianText
    ? PERSIAN_TEXT.selectedRangeLabel
    : t('Selected Jalali range');
  const currentDateLabel = shouldUsePersianText
    ? PERSIAN_TEXT.currentDateLabel
    : t('Current Jalali date');
  const rangePlaceholder = shouldUsePersianText
    ? PERSIAN_TEXT.selectRangePlaceholder
    : t('Select date range');

  return (
    <Container $isRTL={isRTL}>
      <SectionTitle>{titleText}</SectionTitle>
      <section>
        <SectionLabel>{selectRangeText}</SectionLabel>
        <RadioGroup
          value={selectedRange}
          onChange={event =>
            handleRangeChange(event.target.value as PersianCalendarRangeType)
          }
        >
          <RadioList>
            {RANGE_DEFINITIONS.map(option => (
              <Radio key={option.key} value={option.key}>
                {shouldUsePersianText ? option.labelFa : option.label}
              </Radio>
            ))}
          </RadioList>
        </RadioGroup>
      </section>

      {selectedRange === 'custom_range' && (
        <section>
          <SectionLabel>{chooseCustomRangeText}</SectionLabel>
          <JalaliDatePicker
            mode="range"
            placeholder={rangePlaceholder}
            value={[customStartDate, customEndDate]}
            onChange={handleCustomRangeSelection}
            style={{ width: '100%' }}
            placement="bottomRight"
            forceRTL
          />
          <PickerActions>
            <Button
              buttonSize="xsmall"
              buttonStyle="link"
              onClick={() => setBoundaryToToday('start')}
            >
              {setStartTodayText}
            </Button>
            <Button
              buttonSize="xsmall"
              buttonStyle="link"
              onClick={() => setBoundaryToToday('end')}
            >
              {setEndTodayText}
            </Button>
          </PickerActions>
        </section>
      )}

      {customRangeSummary && (
        <SummaryCard>
          <SectionLabel>{selectedRangeLabel}</SectionLabel>
          {customRangeSummary}
        </SummaryCard>
      )}

      <SummaryCard $variant="info">
        <SectionLabel>{currentDateLabel}</SectionLabel>
        {currentDateDisplay}
      </SummaryCard>
    </Container>
  );
}

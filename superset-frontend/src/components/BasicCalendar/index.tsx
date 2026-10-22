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
import { useEffect, useRef, useState } from 'react';
import { Dayjs } from 'dayjs';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Tag } from '@superset-ui/core/components';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import BasicDatePicker from './BasicDatePicker';
import CalendarMonth from './CalendarMonth';
import { getQuickRanges } from './presets';
import {
  CalendarRange,
  DatePickerMode,
  decodeCalendarRange,
  decodeDateTimeRange,
  decodeResolvedRange,
  encodeCalendarRange,
  encodeDateTimeRange,
} from './utils';

export { default as BasicDatePicker } from './BasicDatePicker';
export type { BasicDatePickerProps } from './BasicDatePicker';

export interface BasicCalendarProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
  resolvedRange?: string;
  mode?: DatePickerMode;
}

const CalendarLayout = styled.div`
  color: ${({ theme }) => theme.colorText};
  .calendar-body {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    gap: ${({ theme }) => theme.marginLG}px;
  }
  .presets {
    border-right: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding-right: ${({ theme }) => theme.paddingMD}px;
  }
  .preset-list {
    max-height: 365px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .eyebrow {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin-bottom: ${({ theme }) => theme.marginSM}px;
  }
  .preset {
    width: 100%;
    justify-content: flex-start;
    margin: 0 0 4px !important;
    font-weight: normal;
  }
  .date-fields,
  .months {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.marginLG}px;
  }
  .date-fields {
    margin-bottom: ${({ theme }) => theme.marginMD}px;
  }
  .field-label {
    display: block;
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin-bottom: ${({ theme }) => theme.marginXS}px;
  }
  .selection-hint {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.marginXS}px;
    margin-top: ${({ theme }) => theme.marginSM}px;
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    min-height: 22px;
  }
  @media (max-width: 700px) {
    .calendar-body {
      grid-template-columns: minmax(0, 1fr);
    }
    .presets {
      border-right: 0;
      padding-right: 0;
    }
    .preset-list {
      max-height: 80px;
    }
    .preset {
      width: auto;
      margin-right: 4px !important;
    }
    .date-fields {
      grid-template-columns: minmax(0, 1fr);
      gap: ${({ theme }) => theme.marginSM}px;
    }
    .months {
      grid-template-columns: minmax(0, 1fr);
    }
    .month:last-child {
      display: none;
    }
  }
`;

/** Range picker with editable endpoints, relative presets and two month panels. */
export default function BasicCalendar({
  value,
  onChange,
  onValidityChange,
  resolvedRange,
  mode = 'date',
}: BasicCalendarProps) {
  const initialRange =
    mode === 'date' ? decodeCalendarRange(value) : decodeDateTimeRange(value);
  const [range, setRange] = useState<CalendarRange>(initialRange);
  const [month, setMonth] = useState(
    (initialRange[0] ?? dayjs()).startOf('month'),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<Dayjs | null>(null);
  const [fieldVersion, setFieldVersion] = useState(0);
  const draftEdited = useRef(false);
  const previousValue = useRef(value);
  const inputsValid = useRef({ start: true, end: true });

  useEffect(() => {
    if (previousValue.current === value && draftEdited.current) return;
    previousValue.current = value;
    draftEdited.current = false;
    const decoded =
      mode === 'date' ? decodeCalendarRange(value) : decodeDateTimeRange(value);
    const resolved = decoded[0]
      ? decoded
      : decodeResolvedRange(resolvedRange, mode);
    setRange(resolved);
    setHoveredDay(null);
    if (resolved[0]) {
      const resolvedStart = resolved[0];
      setMonth(visibleMonth =>
        resolvedStart.isBefore(visibleMonth, 'month') ||
        resolvedStart.isAfter(visibleMonth.add(1, 'month'), 'month')
          ? resolvedStart.startOf('month')
          : visibleMonth,
      );
    }
  }, [value, resolvedRange, mode]);

  const presets = getQuickRanges(mode);
  const [start, end] = range;
  const previewEnd = selectingEnd && hoveredDay ? hoveredDay : end;
  const first =
    start && previewEnd && previewEnd.isBefore(start) ? previewEnd : start;
  const last =
    start && previewEnd && previewEnd.isBefore(start) ? start : previewEnd;
  const rangeComplete = (candidate: CalendarRange, candidateMode = mode) =>
    !!(
      candidate[0] &&
      candidate[1] &&
      (candidateMode === 'datetime'
        ? candidate[1].startOf('minute').isAfter(candidate[0].startOf('minute'))
        : !candidate[1].isBefore(candidate[0], 'day'))
    );
  const emitRange = (candidate: CalendarRange, candidateMode = mode) => {
    const valid =
      rangeComplete(candidate, candidateMode) &&
      inputsValid.current.start &&
      inputsValid.current.end;
    onValidityChange(valid);
    if (valid && candidate[0] && candidate[1])
      onChange(
        candidateMode === 'datetime'
          ? encodeDateTimeRange(candidate[0], candidate[1])
          : encodeCalendarRange(candidate[0], candidate[1]),
      );
  };
  const resetFields = () => {
    inputsValid.current = { start: true, end: true };
    setFieldVersion(previous => previous + 1);
  };
  const selectDay = (date: Dayjs) => {
    draftEdited.current = true;
    resetFields();
    if (!selectingEnd || !start) {
      setRange([
        mode === 'datetime'
          ? date
              .hour(start?.hour() ?? 0)
              .minute(start?.minute() ?? 0)
              .startOf('minute')
          : date,
        null,
      ]);
      setSelectingEnd(true);
      setHoveredDay(null);
      onValidityChange(false);
      return;
    }
    const nextEnd =
      mode === 'datetime'
        ? date
            .hour(end?.hour() ?? 0)
            .minute(end?.minute() ?? 0)
            .startOf('minute')
        : date;
    const ordered: [Dayjs, Dayjs] = nextEnd.isBefore(start)
      ? [nextEnd, start]
      : [start, nextEnd];
    setRange(ordered);
    setSelectingEnd(true);
    setHoveredDay(null);
    emitRange(ordered);
  };
  const changeEndpoint = (date: Dayjs | null, isStart: boolean) => {
    draftEdited.current = true;
    const next: CalendarRange = isStart ? [date, end] : [start, date];
    setRange(next);
    setSelectingEnd(!isStart);
    emitRange(next);
    if (date) setMonth(date.startOf('month'));
  };
  const fieldValidity = (valid: boolean, isStart: boolean) => {
    draftEdited.current = true;
    inputsValid.current[isStart ? 'start' : 'end'] = valid;
    onValidityChange(
      inputsValid.current.start &&
        inputsValid.current.end &&
        rangeComplete(range),
    );
  };
  const selectedDays =
    mode === 'date' && rangeComplete(range) && start && end
      ? end.diff(start, 'day') + 1
      : null;
  return (
    <CalendarLayout data-test="basic-calendar">
      <div className="calendar-body">
        <aside className="presets" aria-label={t('Quick ranges')}>
          <div className="eyebrow">{t('Quick ranges')}</div>
          <div className="preset-list">
            {presets.map(preset => (
              <Button
                key={preset.value}
                className="preset"
                buttonStyle={value === preset.value ? 'secondary' : 'link'}
                aria-pressed={value === preset.value && !draftEdited.current}
                onClick={() => {
                  draftEdited.current = false;
                  resetFields();
                  setSelectingEnd(false);
                  setRange(
                    preset.value === value
                      ? decodeResolvedRange(resolvedRange, mode)
                      : [null, null],
                  );
                  onValidityChange(true);
                  onChange(preset.value);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </aside>
        <div>
          <div className="date-fields">
            <div>
              <span className="field-label">
                {mode === 'date' ? t('Start date') : t('Start date and time')}
              </span>
              <BasicDatePicker
                key={`start-${fieldVersion}`}
                mode={mode}
                value={start}
                label={
                  mode === 'date' ? t('Start date') : t('Start date and time')
                }
                onFocus={() => setSelectingEnd(false)}
                onChange={date => changeEndpoint(date, true)}
                onValidityChange={valid => fieldValidity(valid, true)}
              />
            </div>
            <div>
              <span className="field-label">
                {mode === 'date' ? t('End date') : t('End date and time')}
              </span>
              <BasicDatePicker
                key={`end-${fieldVersion}`}
                mode={mode}
                value={end}
                label={mode === 'date' ? t('End date') : t('End date and time')}
                status={
                  start && end && !rangeComplete(range) ? 'error' : undefined
                }
                onFocus={() => setSelectingEnd(true)}
                onChange={date => changeEndpoint(date, false)}
                onValidityChange={valid => fieldValidity(valid, false)}
              />
            </div>
          </div>
          <div className="months">
            {[month, month.add(1, 'month')].map((panelMonth, panelIndex) => (
              <CalendarMonth
                key={panelIndex}
                month={panelMonth}
                onMonthChange={next =>
                  setMonth(next.subtract(panelIndex, 'month'))
                }
                onSelect={selectDay}
                start={first}
                end={last}
                onHover={date => {
                  if (selectingEnd) setHoveredDay(date);
                }}
              />
            ))}
          </div>
          {mode === 'date' && (
            <output className="selection-hint">
              {selectedDays && <Tag>{t('%s days', selectedDays)}</Tag>}
              {selectingEnd && !end
                ? t('Choose an end date to complete your range.')
                : start && end && !rangeComplete(range)
                  ? t('End must be after start.')
                  : null}
            </output>
          )}
        </div>
      </div>
    </CalendarLayout>
  );
}

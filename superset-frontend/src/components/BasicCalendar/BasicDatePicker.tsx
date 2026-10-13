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
import { useEffect, useId, useRef, useState } from 'react';
import { Dayjs } from 'dayjs';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Input, InputRef, Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import CalendarMonth from './CalendarMonth';
import { DatePickerMode, parseTypedDate, pickerFormat } from './utils';

export interface BasicDatePickerProps {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  onValidityChange?: (valid: boolean) => void;
  mode?: DatePickerMode;
  label: string;
  status?: 'error';
}

const Field = styled.div`
  .picker-icon {
    display: inline-flex;
    padding: 2px;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colorTextSecondary};
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadiusSM}px;
  }
  .picker-icon:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
  .picker-icon:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colorPrimary};
  }
  .input-error {
    display: block;
    color: ${({ theme }) => theme.colorError};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin-top: ${({ theme }) => theme.marginXXS}px;
  }
`;
const Picker = styled.section`
  width: min(100%, 460px);
  .picker-panels {
    display: grid;
    grid-template-columns: minmax(230px, 1fr);
    gap: ${({ theme }) => theme.marginMD}px;
  }
  .picker-panels.with-time {
    grid-template-columns: minmax(230px, 1fr) 132px;
  }
  .time-panel {
    border-left: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding-left: ${({ theme }) => theme.paddingSM}px;
  }
  .time-labels,
  .time-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }
  .time-labels {
    text-align: center;
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    margin-bottom: ${({ theme }) => theme.marginSM}px;
  }
  .time-column {
    position: relative;
    height: 226px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .time-option {
    width: 100%;
    padding: 0;
    margin: 0 0 2px !important;
  }
  .picker-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: ${({ theme }) => theme.paddingSM}px;
    margin-top: ${({ theme }) => theme.marginSM}px;
    border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  }
  @media (max-width: 480px) {
    .picker-panels.with-time {
      grid-template-columns: minmax(0, 1fr);
    }
    .time-panel {
      border-left: 0;
      padding-left: 0;
    }
    .time-column {
      height: 100px;
    }
  }
`;

/** Scroll the selected time into view without moving the surrounding page. */
function TimeColumn({
  unit,
  value,
  onChange,
}: {
  unit: 'hour' | 'minute';
  value: number;
  onChange: (value: number) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const column = columnRef.current;
    const selected = column?.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    if (column && selected)
      column.scrollTop = Math.max(
        0,
        selected.offsetTop - (column.clientHeight - selected.offsetHeight) / 2,
      );
  }, [value]);
  return (
    <div className="time-column" ref={columnRef}>
      {Array.from({ length: unit === 'hour' ? 24 : 60 }, (_, index) => (
        <Button
          key={index}
          buttonStyle={value === index ? 'secondary' : 'link'}
          className="time-option"
          aria-label={
            unit === 'hour' ? t('Hour %s', index) : t('Minute %s', index)
          }
          aria-pressed={value === index}
          onClick={() => onChange(index)}
        >
          {String(index).padStart(2, '0')}
        </Button>
      ))}
    </div>
  );
}

/** Editable date input; only its icon or Arrow Down opens the calendar. */
export default function BasicDatePicker({
  value,
  onChange,
  onValidityChange,
  mode = 'date',
  label,
  status,
}: BasicDatePickerProps) {
  const format =
    mode === 'datetime' && value?.second()
      ? 'DD/MM/YYYY HH:mm:ss'
      : pickerFormat(mode);
  const [text, setText] = useState(value?.format(format) ?? '');
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState(
    value ?? dayjs().startOf('minute'),
  );
  const [month, setMonth] = useState((value ?? dayjs()).startOf('month'));
  const inputRef = useRef<InputRef>(null);
  const popupId = useId();
  const displayValue = value?.format(format) ?? '';
  useEffect(() => {
    setText(displayValue);
    setInvalid(false);
  }, [displayValue]);

  const commit = (date: Dayjs | null) => {
    setText(date?.format(format) ?? '');
    setInvalid(false);
    onValidityChange?.(true);
    onChange(date);
  };
  const openPicker = () => {
    const parsed = parseTypedDate(text, mode);
    const next = parsed ?? value ?? dayjs().startOf('minute');
    setPickerValue(next);
    setMonth(next.startOf('month'));
    setOpen(true);
  };
  const selectDate = (date: Dayjs) => {
    const next = date
      .hour(pickerValue.hour())
      .minute(pickerValue.minute())
      .second(pickerValue.second());
    setPickerValue(next);
    if (mode === 'date') {
      commit(next.startOf('day'));
      setOpen(false);
      inputRef.current?.focus();
    }
  };
  const closePicker = () => {
    setOpen(false);
    inputRef.current?.focus();
  };
  const content = (
    <Picker
      id={popupId}
      data-test="basic-date-picker-popup"
      aria-label={
        mode === 'datetime' ? t('Choose date and time') : t('Choose date')
      }
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          closePicker();
        }
      }}
    >
      <div
        className={`picker-panels${mode === 'datetime' ? ' with-time' : ''}`}
      >
        <CalendarMonth
          month={month}
          onMonthChange={setMonth}
          onSelect={selectDate}
          start={pickerValue}
        />
        {mode === 'datetime' && (
          <div className="time-panel">
            <div className="time-labels">
              <span>{t('Hours')}</span>
              <span>{t('Minutes')}</span>
            </div>
            <div className="time-columns">
              {(['hour', 'minute'] as const).map(unit => (
                <TimeColumn
                  key={unit}
                  unit={unit}
                  value={pickerValue.get(unit)}
                  onChange={index =>
                    setPickerValue(previous => previous.set(unit, index))
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <Button
          buttonStyle="link"
          onClick={() => {
            const next = dayjs().startOf(
              mode === 'datetime' ? 'minute' : 'day',
            );
            setPickerValue(next);
            setMonth(next.startOf('month'));
            if (mode === 'date') {
              commit(next);
              closePicker();
            }
          }}
        >
          {mode === 'datetime' ? t('Now') : t('Today')}
        </Button>
        <Button
          buttonStyle="primary"
          onClick={() => {
            commit(mode === 'date' ? pickerValue.startOf('day') : pickerValue);
            closePicker();
          }}
        >
          {t('Done')}
        </Button>
      </div>
    </Picker>
  );
  return (
    <Field data-test={`basic-${mode}-picker`}>
      <Popover
        open={open}
        trigger="click"
        onOpenChange={next => {
          if (!next) setOpen(false);
        }}
        content={content}
        placement="bottomLeft"
        destroyOnHidden
        styles={{ container: { maxWidth: 'calc(100vw - 24px)' } }}
      >
        <Input
          ref={inputRef}
          aria-label={label}
          value={text}
          placeholder={
            mode === 'datetime' ? t('DD/MM/YYYY HH:mm') : t('DD/MM/YYYY')
          }
          autoComplete="off"
          status={invalid ? 'error' : status}
          aria-invalid={invalid || status === 'error'}
          aria-describedby={invalid ? `${popupId}-error` : undefined}
          allowClear={{
            clearIcon: <Icons.CloseCircleOutlined aria-label={t('Clear')} />,
          }}
          onChange={event => {
            const nextText = event.target.value;
            setText(nextText);
            if (!nextText.trim()) {
              commit(null);
              return;
            }
            const parsed = parseTypedDate(nextText, mode);
            const valid = !!parsed;
            setInvalid(!valid);
            onValidityChange?.(valid);
            if (parsed) onChange(parsed);
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openPicker();
            }
            if (event.key === 'Escape' && open) {
              event.stopPropagation();
              closePicker();
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const parsed = parseTypedDate(text, mode);
              if (parsed || !text.trim()) commit(parsed);
            }
          }}
          suffix={
            <button
              type="button"
              className="picker-icon"
              aria-label={t('Open picker for %s', label)}
              aria-expanded={open}
              aria-controls={open ? popupId : undefined}
              onMouseDown={event => event.preventDefault()}
              onClick={event => {
                event.stopPropagation();
                if (open) closePicker();
                else openPicker();
              }}
            >
              <Icons.CalendarOutlined />
            </button>
          }
        />
      </Popover>
      {invalid && (
        <span className="input-error" id={`${popupId}-error`}>
          {t('Enter a valid date using %s.', format)}
        </span>
      )}
    </Field>
  );
}

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
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Dayjs } from 'dayjs';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

interface CalendarMonthProps {
  month: Dayjs;
  onMonthChange: (month: Dayjs) => void;
  onSelect: (date: Dayjs) => void;
  start?: Dayjs | null;
  end?: Dayjs | null;
  onHover?: (date: Dayjs | null) => void;
}

const Month = styled.section`
  min-width: 0;
  .month-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.marginSM}px;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }
  .weekdays,
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .weekdays {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    text-align: center;
    margin-bottom: ${({ theme }) => theme.marginXS}px;
  }
  .day,
  .outside-month {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 0;
    margin: 1px 0 !important;
    border: 0;
    border-radius: ${({ theme }) => theme.borderRadiusSM}px;
    font-weight: normal;
    color: ${({ theme }) => theme.colorText};
    background: transparent;
  }
  .outside-month {
    color: ${({ theme }) => theme.colorTextDisabled};
  }
  .day.in-range {
    background: ${({ theme }) => theme.colorPrimaryBg};
    border-radius: 0;
  }
  .day.endpoint {
    background: ${({ theme }) => theme.colorPrimary};
    color: ${({ theme }) => theme.colorTextLightSolid};
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    border-radius: ${({ theme }) => theme.borderRadiusSM}px;
  }
  .day.today:not(.endpoint) {
    box-shadow: inset 0 0 0 1px ${({ theme }) => theme.colorPrimaryBorder};
  }
  .day:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colorPrimary};
    outline-offset: 2px;
  }
`;

/** One month panel shared by date, date-time and range pickers. */
export default function CalendarMonth({
  month,
  onMonthChange,
  onSelect,
  start,
  end,
  onHover,
}: CalendarMonthProps) {
  const [focusedDay, setFocusedDay] = useState(start ?? month);
  const panelRef = useRef<HTMLElement>(null);
  const focusRequested = useRef(false);
  useEffect(() => {
    if (focusRequested.current) {
      panelRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-date="${focusedDay.format('YYYY-MM-DD')}"]`,
        )
        ?.focus();
      focusRequested.current = false;
    }
  }, [focusedDay, month]);

  const moveFocus = (event: KeyboardEvent<HTMLElement>, date: Dayjs) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: Dayjs;
    if (event.key in offsets) next = date.add(offsets[event.key], 'day');
    else if (event.key === 'Home')
      next = date.subtract((date.day() + 6) % 7, 'day');
    else if (event.key === 'End')
      next = date.add(6 - ((date.day() + 6) % 7), 'day');
    else if (event.key === 'PageUp') next = date.subtract(1, 'month');
    else if (event.key === 'PageDown') next = date.add(1, 'month');
    else return;
    event.preventDefault();
    focusRequested.current = true;
    setFocusedDay(next);
    if (!next.isSame(month, 'month')) onMonthChange(next.startOf('month'));
  };
  const firstCell = month
    .startOf('month')
    .subtract((month.startOf('month').day() + 6) % 7, 'day');
  const tabDay = focusedDay.isSame(month, 'month')
    ? focusedDay
    : month.startOf('month');
  return (
    <Month
      className="month"
      ref={panelRef}
      aria-label={month.format('MMMM YYYY')}
    >
      <div className="month-title">
        <Button
          buttonStyle="link"
          buttonSize="small"
          aria-label={t('Previous month')}
          onClick={() => onMonthChange(month.subtract(1, 'month'))}
        >
          <Icons.LeftOutlined />
        </Button>
        <span>{month.format('MMMM YYYY')}</span>
        <Button
          buttonStyle="link"
          buttonSize="small"
          aria-label={t('Next month')}
          onClick={() => onMonthChange(month.add(1, 'month'))}
        >
          <Icons.RightOutlined />
        </Button>
      </div>
      <div className="weekdays" aria-hidden="true">
        {[t('Mo'), t('Tu'), t('We'), t('Th'), t('Fr'), t('Sa'), t('Su')].map(
          label => (
            <span key={label}>{label}</span>
          ),
        )}
      </div>
      <div className="days" onMouseLeave={() => onHover?.(null)}>
        {Array.from({ length: 42 }, (_, index) => {
          const date = firstCell.add(index, 'day');
          if (!date.isSame(month, 'month'))
            return (
              <span className="outside-month" aria-hidden="true" key={index}>
                {date.date()}
              </span>
            );
          const endpoint = !!(
            (start && date.isSame(start, 'day')) ||
            (end && date.isSame(end, 'day'))
          );
          const inRange = !!(
            start &&
            end &&
            !date.isBefore(start, 'day') &&
            !date.isAfter(end, 'day')
          );
          const today = date.isSame(dayjs(), 'day');
          return (
            <Button
              key={index}
              buttonStyle="link"
              className={`day${endpoint ? ' endpoint' : ''}${inRange ? ' in-range' : ''}${today ? ' today' : ''}`}
              aria-label={date.format('YYYY-MM-DD')}
              aria-pressed={inRange || endpoint}
              aria-current={today ? 'date' : undefined}
              data-date={date.format('YYYY-MM-DD')}
              tabIndex={date.isSame(tabDay, 'day') ? 0 : -1}
              onClick={() => {
                setFocusedDay(date);
                onSelect(date);
              }}
              onMouseEnter={() => onHover?.(date)}
              onKeyDown={event => moveFocus(event, date)}
            >
              {date.date()}
            </Button>
          );
        })}
      </div>
    </Month>
  );
}

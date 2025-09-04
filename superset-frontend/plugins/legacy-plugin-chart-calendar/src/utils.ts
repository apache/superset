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

import { getTimeFormatter } from '@superset-ui/core';
import * as d3 from 'd3-time-format';

// Assume that given timestamp is UTC
export const getFormattedUTCTime = (
  ts: number | string,
  timeFormat?: string,
) => {
  const date = new Date(ts);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return getTimeFormatter(timeFormat)(date.getTime() - offset);
};

/**
 * Returns a locale-aware time formatter.
 * Falls back to Superset’s default getTimeFormatter if locale is not available.
 */
export function getLocaleTimeFormatter(format?: string) {
  try {
    // Use browser/OS locale automatically (e.g., Russian if BABEL_DEFAULT_LOCALE=ru)
    const locale = navigator.language || 'en-US';
    const d3Locale = d3.timeFormatLocale(getD3LocaleDefinition(locale));
    return d3Locale.format(format || '%B'); // default: full month name
  } catch (e) {
    // fallback to Superset formatter (English only)
    return getTimeFormatter(format);
  }
}

/**
 * Minimal locale resolver.
 * Extend this to add more locales if needed.
 */
function getD3LocaleDefinition(locale: string) {
  switch (locale) {
    case 'ru':
    case 'ru-RU':
      return {
        dateTime: '%A, %e %B %Y г. %X',
        date: '%d.%m.%Y',
        time: '%H:%M:%S',
        periods: ['', ''],
        days: [
          'Воскресенье','Понедельник','Вторник',
          'Среда','Четверг','Пятница','Суббота',
        ],
        shortDays: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
        months: [
          'Январь','Февраль','Март','Апрель','Май','Июнь',
          'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
        ],
        shortMonths: [
          'Янв','Фев','Мар','Апр','Май','Июн',
          'Июл','Авг','Сен','Окт','Ноя','Дек',
        ],
      };
    default:
      // fallback definition (English)
      return {
        dateTime: '%x, %X',
        date: '%-m/%-d/%Y',
        time: '%-I:%M:%S %p',
        periods: ['AM', 'PM'],
        days: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
        shortDays: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
        months: [
          'January','February','March','April','May','June',
          'July','August','September','October','November','December',
        ],
        shortMonths: [
          'Jan','Feb','Mar','Apr','May','Jun',
          'Jul','Aug','Sep','Oct','Nov','Dec',
        ],
      };
  }
}

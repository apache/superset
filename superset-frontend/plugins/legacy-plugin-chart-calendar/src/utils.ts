/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file for additional information
 * regarding copyright ownership. The ASF licenses this file under the Apache License, Version 2.0.
 */
/* eslint-disable import/no-extraneous-dependencies */

import { getTimeFormatter } from '@superset-ui/core';
import { timeFormatLocale } from 'd3-time-format';

/**
 * Minimal locale resolver for d3-time-format
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
          'Воскресенье',
          'Понедельник',
          'Вторник',
          'Среда',
          'Четверг',
          'Пятница',
          'Суббота',
        ],
        shortDays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        months: [
          'Январь','Февраль','Март','Апрель','Май','Июнь',
          'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
        ],
        shortMonths: [
          'Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг',
          'Сен','Окт','Ноя','Дек',
        ],
      };
    default:
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
          'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug',
          'Sep','Oct','Nov','Dec',
        ],
      };
  }
}

/**
 * Returns a locale-aware time formatter using d3-time-format.
 * Defaults to the browser locale or English if unavailable.
 */
export function getLocaleTimeFormatter(format?: string) {
  try {
    const locale = navigator.language || 'en-US';
    const d3Locale = timeFormatLocale(getD3LocaleDefinition(locale));
    return d3Locale.format(format || '%B'); // default: full month name
  } catch (e) {
    return getTimeFormatter(format);
  }
}

/**
 * Assume that given timestamp is UTC
 */
export const getFormattedUTCTime = (
  ts: number | string,
  timeFormat?: string,
) => {
  const date = new Date(ts);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  const formatter = getLocaleTimeFormatter(timeFormat);
  return formatter(date.getTime() - offset);
};

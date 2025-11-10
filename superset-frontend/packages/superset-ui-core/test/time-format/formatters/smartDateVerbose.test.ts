/*
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

import { TimeLocaleDefinition } from 'd3-time-format';
import {
  TimeFormatter,
  createSmartDateVerboseFormatter,
  SmartDateFormat,
} from '@superset-ui/core';

describe('smartDateVerboseFormatter', () => {
  describe('when locale is default', () => {
    const formatter = createSmartDateVerboseFormatter();

    it('is a function', () => {
      expect(formatter).toBeInstanceOf(TimeFormatter);
    });

    it('shows only year when 1st day of the year', () => {
      expect(formatter(new Date('2020-01-01'))).toBe('2020');
    });

    it('shows month and year when 1st of month', () => {
      expect(formatter(new Date('2020-03-01'))).toBe('Mar 2020');
    });

    it('shows weekday when any day of the month', () => {
      expect(formatter(new Date('2020-03-03'))).toBe('Tue Mar 3');
      expect(formatter(new Date('2020-03-15'))).toBe('Sun Mar 15');
    });
  });
  describe('when locale is not default', () => {
    const formats: SmartDateFormat = {
      smart_date: {
        millisecond: '.%Lms',
        second: ':%Ss',
        minute: '%H:%M',
        hour: '%H h',
        day: '%a %d',
        week: '%d %b',
        month: '%B',
        year: '%Y',
      },
      smart_date_verbose: {
        millisecond: '.%L',
        second: '%a %d %b, %H:%M:%S',
        minute: '%a %d %b, %H:%M',
        hour: '%a %d %b, %Hh',
        day: '%a %d %b',
        week: '%a %d %b',
        month: '%b %Y',
        year: '%Y',
      },
      smart_date_detailed: {
        millisecond: '%d/%m/%Y %H:%M:%S.%L',
        second: '%d/%m/%Y %H:%M:%S',
        minute: '%d/%m/%Y %H:%M',
        hour: '%d/%m/%Y %H:%M',
        day: '%d/%m/%Y',
        week: '%d/%m/%Y',
        month: '%d/%m/%Y',
        year: '%Y',
      },
    };

    const locale: TimeLocaleDefinition = {
      dateTime: '%A, %e de %B de %Y. %X',
      date: '%d/%m/%Y',
      time: '%H:%M:%S',
      periods: ['AM', 'PM'],
      days: [
        'Domingo',
        'Segunda',
        'Terça',
        'Quarta',
        'Quinta',
        'Sexta',
        'Sábado',
      ],
      shortDays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      months: [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ],
      shortMonths: [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ],
    };
    const formatter = createSmartDateVerboseFormatter(locale, formats);

    it('is a function', () => {
      expect(formatter).toBeInstanceOf(TimeFormatter);
    });

    it('shows only year when 1st day of the year', () => {
      expect(formatter(new Date('2020-01-01'))).toBe('2020');
    });

    it('shows month and year when 1st of month', () => {
      expect(formatter(new Date('2020-04-01'))).toBe('Abr 2020');
    });

    it('shows weekday when any day of the month', () => {
      expect(formatter(new Date('2020-03-03'))).toBe('Ter 03 Mar');
      expect(formatter(new Date('2020-03-15'))).toBe('Dom 15 Mar');
    });
  });
});

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
} from '@superset-ui/core';

describe('smartDateVerboseFormatter', () => {
  describe('when locale is default', () => {
    const formatter = createSmartDateVerboseFormatter();

    test('is a function', () => {
      expect(formatter).toBeInstanceOf(TimeFormatter);
    });

    test('shows only year when 1st day of the year', () => {
      expect(formatter(new Date('2020-01-01'))).toBe('2020');
    });

    test('shows month and year when 1st of month', () => {
      expect(formatter(new Date('2020-03-01'))).toBe('Mar 2020');
    });

    test('shows weekday with year when any day of the month', () => {
      expect(formatter(new Date('2020-03-03'))).toBe('Tue Mar 3 2020');
      expect(formatter(new Date('2020-03-15'))).toBe('Sun Mar 15 2020');
    });

    // Regression test for #44149: tooltips on charts spanning multiple years
    // (e.g. a 2014-2026 scatter) must include the year, otherwise points in
    // different years are indistinguishable without looking at the axis.
    test('shows the year for daily-granularity dates', () => {
      expect(formatter(new Date('2014-03-20'))).toBe('Thu Mar 20 2014');
    });

    test('distinguishes the same day of the year across years', () => {
      expect(formatter(new Date('2014-03-20'))).not.toBe(
        formatter(new Date('2026-03-20')),
      );
    });

    // Review feedback on #44212: the sub-day tiers had the same ambiguity, so
    // hourly-or-finer tooltips spanning multiple years also need the year.
    test('shows the year for hourly-granularity dates', () => {
      expect(formatter(new Date('2014-03-20T15:00:00Z'))).toBe(
        'Thu Mar 20 2014, 03 PM',
      );
    });

    test('shows the year for minute-granularity dates', () => {
      expect(formatter(new Date('2014-03-20T15:45:00Z'))).toBe(
        'Thu Mar 20 2014, 03:45 PM',
      );
    });

    test('shows the year for second-granularity dates', () => {
      expect(formatter(new Date('2014-03-20T15:45:12Z'))).toBe(
        'Thu Mar 20 2014, 03:45:12 PM',
      );
    });
  });
  describe('when locale is not default', () => {
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
    const formatter = createSmartDateVerboseFormatter(locale);

    test('is a function', () => {
      expect(formatter).toBeInstanceOf(TimeFormatter);
    });

    test('shows only year when 1st day of the year', () => {
      expect(formatter(new Date('2020-01-01'))).toBe('2020');
    });

    test('shows month and year when 1st of month', () => {
      expect(formatter(new Date('2020-04-01'))).toBe('Abr 2020');
    });

    test('shows weekday with year when any day of the month', () => {
      expect(formatter(new Date('2020-03-03'))).toBe('Ter Mar 3 2020');
      expect(formatter(new Date('2020-03-15'))).toBe('Dom Mar 15 2020');
    });

    test('shows the year for sub-day granularity dates', () => {
      expect(formatter(new Date('2020-03-03T15:00:00Z'))).toBe(
        'Ter Mar 03 2020, 03 PM',
      );
      expect(formatter(new Date('2020-03-03T15:45:00Z'))).toBe(
        'Ter Mar 03 2020, 03:45 PM',
      );
      expect(formatter(new Date('2020-03-03T15:45:12Z'))).toBe(
        'Ter Mar 03 2020, 03:45:12 PM',
      );
    });
  });
});

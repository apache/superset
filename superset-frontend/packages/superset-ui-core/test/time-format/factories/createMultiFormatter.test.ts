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

import { createMultiFormatter } from '@superset-ui/core';
import { TimeLocaleDefinition } from 'd3-time-format';

describe('createMultiFormatter()', () => {
  describe('creates a multi-step formatter', () => {
    describe('when locale is undefined', () => {
      describe('and use local time is false', () => {
        const formatter = createMultiFormatter({
          id: 'my_format',
          useLocalTime: false,
        });
        it('formats millisecond', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual(
            '.100',
          );
        });
        it('formats second', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
        });
        it('format minutes', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('04:22');
        });
        it('format hours', () => {
          expect(formatter(new Date('2018-11-18 11:00 UTC'))).toEqual('11 AM');
        });
        it('format first day of week', () => {
          expect(formatter(new Date('2018-11-18 UTC'))).toEqual('Nov 18');
        });
        it('format other day of week', () => {
          expect(formatter(new Date('2018-11-20 UTC'))).toEqual('Tue 20');
        });
        it('format month', () => {
          expect(formatter(new Date('2018-11-1 UTC'))).toEqual('November');
        });
        it('format year', () => {
          expect(formatter(new Date('2018-1-1 UTC'))).toEqual('2018');
        });
      });
      describe('and use local time is true', () => {
        const formatter = createMultiFormatter({
          id: 'my_format',
          useLocalTime: true,
        });
        it('formats millisecond', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual(
            '.100',
          );
        });
        it('formats second', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
        });
        it('format minutes', () => {
          expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('11:22');
        });
        it('format hours', () => {
          expect(formatter(new Date(2018, 10, 20, 11))).toEqual('11 AM');
        });
        it('format first day of week', () => {
          expect(formatter(new Date(2018, 10, 18))).toEqual('Nov 18');
        });
        it('format other day of week', () => {
          expect(formatter(new Date(2018, 10, 20))).toEqual('Tue 20');
        });
        it('format month', () => {
          expect(formatter(new Date(2018, 10))).toEqual('November');
        });
        it('format year', () => {
          expect(formatter(new Date(2018, 0))).toEqual('2018');
        });
      });
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
    describe('and use local time is false', () => {
      const formatter = createMultiFormatter({
        id: 'my_format',
        useLocalTime: false,
        locale,
      });
      it('formats millisecond', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual(
          '.100',
        );
      });
      it('formats second', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
      });
      it('format minutes', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('04:22');
      });
      it('format hours', () => {
        expect(formatter(new Date('2018-11-18 11:00 UTC'))).toEqual('11 AM');
      });
      it('format first day of week', () => {
        expect(formatter(new Date('2018-11-18 UTC'))).toEqual('Nov 18');
      });
      it('format other day of week', () => {
        expect(formatter(new Date('2018-11-20 UTC'))).toEqual('Ter 20');
      });
      it('format month', () => {
        expect(formatter(new Date('2018-11-1 UTC'))).toEqual('Novembro');
      });
      it('format year', () => {
        expect(formatter(new Date('2018-1-1 UTC'))).toEqual('2018');
      });
    });
    describe('and use local time is true', () => {
      const formatter = createMultiFormatter({
        id: 'my_format',
        useLocalTime: true,
        locale,
      });
      it('formats millisecond', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual(
          '.100',
        );
      });
      it('formats second', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
      });
      it('format minutes', () => {
        expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('11:22');
      });
      it('format hours', () => {
        expect(formatter(new Date(2018, 10, 20, 11))).toEqual('11 AM');
      });
      it('format first day of week', () => {
        expect(formatter(new Date(2018, 10, 18))).toEqual('Nov 18');
      });
      it('format other day of week', () => {
        expect(formatter(new Date(2018, 10, 20))).toEqual('Ter 20');
      });
      it('format month', () => {
        expect(formatter(new Date(2018, 10))).toEqual('Novembro');
      });
      it('format year', () => {
        expect(formatter(new Date(2018, 0))).toEqual('2018');
      });
    });
  });
});

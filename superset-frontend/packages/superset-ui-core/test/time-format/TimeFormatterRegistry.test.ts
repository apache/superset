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
import { TimeFormats, TimeFormatter, PREVIEW_TIME } from '@superset-ui/core';
import TimeFormatterRegistry from '../../src/time-format/TimeFormatterRegistry';
import { DEFAULT_D3_TIME_FORMAT } from '../../src/time-format';

describe('TimeFormatterRegistry', () => {
  let registry: TimeFormatterRegistry;
  beforeEach(() => {
    registry = new TimeFormatterRegistry();
  });
  describe('.get(format)', () => {
    it('creates and returns a new formatter if does not exist', () => {
      const formatter = registry.get(TimeFormats.DATABASE_DATETIME);
      expect(formatter).toBeInstanceOf(TimeFormatter);
      expect(formatter.format(PREVIEW_TIME)).toEqual('2017-02-14 11:22:33');
    });
    it('returns an existing formatter if already exists', () => {
      const formatter = registry.get(TimeFormats.TIME);
      const formatter2 = registry.get(TimeFormats.TIME);
      expect(formatter).toBe(formatter2);
    });
    it('falls back to default format if format is not specified', () => {
      registry.setDefaultKey(TimeFormats.INTERNATIONAL_DATE);
      const formatter = registry.get();
      expect(formatter.format(PREVIEW_TIME)).toEqual('14/02/2017');
    });
    it('falls back to default format if format is null', () => {
      registry.setDefaultKey(TimeFormats.INTERNATIONAL_DATE);
      // @ts-ignore
      const formatter = registry.get(null);
      expect(formatter.format(PREVIEW_TIME)).toEqual('14/02/2017');
    });
    it('falls back to default format if format is undefined', () => {
      registry.setDefaultKey(TimeFormats.INTERNATIONAL_DATE);
      const formatter = registry.get(undefined);
      expect(formatter.format(PREVIEW_TIME)).toEqual('14/02/2017');
    });
    it('falls back to default format if format is empty string', () => {
      registry.setDefaultKey(TimeFormats.INTERNATIONAL_DATE);
      const formatter = registry.get('');
      expect(formatter.format(PREVIEW_TIME)).toEqual('14/02/2017');
    });
    it('removes leading and trailing spaces from format', () => {
      const formatter = registry.get(' %Y ');
      expect(formatter).toBeInstanceOf(TimeFormatter);
      expect(formatter.format(PREVIEW_TIME)).toEqual('2017');
    });
  });
  describe('.format(format, value)', () => {
    it('return the value with the specified format', () => {
      expect(registry.format(TimeFormats.US_DATE, PREVIEW_TIME)).toEqual(
        '02/14/2017',
      );
      expect(registry.format(TimeFormats.TIME, PREVIEW_TIME)).toEqual(
        '11:22:33',
      );
    });
    it('falls back to the default formatter if the format is undefined', () => {
      expect(registry.format(undefined, PREVIEW_TIME)).toEqual(
        '2017-02-14 11:22:33',
      );
    });
  });
  describe('.setD3Format(d3Format)', () => {
    describe('when partial value is specified', () => {
      const timeFormat: Partial<TimeLocaleDefinition> = {
        days: [
          'Domingo',
          'Segunda',
          'Terça',
          'Quarta',
          'Quinta',
          'Sexta',
          'Sábado',
        ],
      };

      beforeEach(() => {
        registry.setD3Format(timeFormat);
      });

      it('sets the specified value and default', () => {
        expect(registry.d3Format).toEqual({
          ...DEFAULT_D3_TIME_FORMAT,
          ...timeFormat,
        });
      });

      it('does not change short days of week name format', () => {
        expect(registry.format('%a', PREVIEW_TIME)).toEqual('Tue');
      });

      it('changes full days of week name format', () => {
        expect(registry.format('%A', PREVIEW_TIME)).toEqual('Terça');
      });

      it('does not change months format', () => {
        expect(registry.format('%b', PREVIEW_TIME)).toEqual('Feb');
        expect(registry.format('%B', PREVIEW_TIME)).toEqual('February');
      });
    });

    describe('when full value is specified', () => {
      const timeFormat: TimeLocaleDefinition = {
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

      beforeEach(() => {
        registry.setD3Format(timeFormat);
      });

      it('sets the specified value ignoring default', () => {
        expect(registry.d3Format).toEqual(timeFormat);
      });

      it('changes days of week format', () => {
        expect(registry.format('%a', PREVIEW_TIME)).toEqual('Ter');
        expect(registry.format('%A', PREVIEW_TIME)).toEqual('Terça');
      });

      it('changes months format', () => {
        expect(registry.format('%b', PREVIEW_TIME)).toEqual('Fev');
        expect(registry.format('%B', PREVIEW_TIME)).toEqual('Fevereiro');
      });
    });
  });
});

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
import { GenericDataType } from '@apache-superset/core/common';
import { getNumberFormatter } from '@superset-ui/core';
import { formatColumnValue } from './formatValue';
import { DataColumnMeta } from '../types';

/**
 * Helper to build a minimal DataColumnMeta for numeric columns.
 */
function makeNumericColumn(config: DataColumnMeta['config'] = {}): DataColumnMeta {
  return {
    key: 'test',
    label: 'test',
    dataType: GenericDataType.Numeric,
    formatter: config.d3NumberFormat
      ? getNumberFormatter(config.d3NumberFormat)
      : undefined,
    config,
  } as DataColumnMeta;
}

describe('formatColumnValue', () => {
  describe('percentage format columns (issue #36189)', () => {
    it('formats a very small negative percentage value correctly', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.8%' });
      const [, result] = formatColumnValue(column, -0.00001229);
      // D3 .8% multiplies by 100 then formats with 8 decimal places
      expect(result).toBe('-0.00122900%');
    });

    it('formats a very small positive percentage value correctly', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.8%' });
      const [, result] = formatColumnValue(column, 0.0001);
      expect(result).toBe('0.01000000%');
    });

    it('does not return the raw value for a small percentage', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.4%' });
      const [, result] = formatColumnValue(column, -0.00001229);
      expect(result).not.toBe('-0.00001229');
    });

    it('formats a normal percentage value correctly', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.2%' });
      const [, result] = formatColumnValue(column, 0.0523);
      expect(result).toBe('5.23%');
    });

    it('formats a percentage value close to zero without loss', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.6%' });
      const [, result] = formatColumnValue(column, 0.000001);
      expect(result).toBe('0.000100%');
    });
  });

  describe('non-percentage small number columns', () => {
    it('still uses small-number formatter for non-percentage small values', () => {
      const smallFmt = getNumberFormatter('.4f');
      const column = {
        key: 'test',
        label: 'test',
        dataType: GenericDataType.Numeric,
        formatter: getNumberFormatter('.2f'),
        config: {
          d3NumberFormat: '.2f',
          d3SmallNumberFormat: '.4f',
        },
      } as DataColumnMeta;
      const [, result] = formatColumnValue(column, 0.0005);
      // small number formatter should be used (Math.abs(0.0005) < 1 and not a % format)
      expect(result).toBe('0.0005');
    });
  });

  describe('edge cases', () => {
    it('renders null as N/A', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.8%' });
      const [, result] = formatColumnValue(column, null);
      expect(result).toBe('N/A');
    });

    it('renders undefined as empty string', () => {
      const column = makeNumericColumn({ d3NumberFormat: '.8%' });
      const [, result] = formatColumnValue(column, undefined);
      expect(result).toBe('');
    });
  });
});

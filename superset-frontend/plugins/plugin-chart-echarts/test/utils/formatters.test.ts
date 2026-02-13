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
import {
  NumberFormats,
  SMART_DATE_ID,
  getTimeFormatter,
} from '@superset-ui/core';
import {
  getPercentFormatter,
  getXAxisFormatter,
  getSmartDateFormatter,
} from '../../src/utils/formatters';

describe('getPercentFormatter', () => {
  const value = 0.6;
  test('should format as percent if no format is specified', () => {
    expect(getPercentFormatter().format(value)).toEqual('60%');
  });
  test('should format as percent if SMART_NUMBER is specified', () => {
    expect(
      getPercentFormatter(NumberFormats.SMART_NUMBER).format(value),
    ).toEqual('60%');
  });
  test('should format using a provided format', () => {
    expect(
      getPercentFormatter(NumberFormats.PERCENT_2_POINT).format(value),
    ).toEqual('60.00%');
  });
});

describe('getXAxisFormatter', () => {
  it('should return smart date formatter when SMART_DATE_ID is specified', () => {
    const formatter = getXAxisFormatter(SMART_DATE_ID);
    expect(formatter).toBeDefined();
    expect(formatter).toBeInstanceOf(Function);
    // The formatter should be the same as getSmartDateFormatter()
    const smartDateFormatter = getSmartDateFormatter();
    expect(formatter).toEqual(smartDateFormatter);
  });

  it('should return undefined when format is not specified', () => {
    const formatter = getXAxisFormatter();
    expect(formatter).toBeUndefined();
  });

  it('should return undefined when format is empty string', () => {
    const formatter = getXAxisFormatter('');
    expect(formatter).toBeUndefined();
  });

  it('should return the appropriate time formatter for a specific format', () => {
    const format = '%Y-%m-%d';
    const formatter = getXAxisFormatter(format);
    expect(formatter).toBeDefined();
    expect(formatter).toBeInstanceOf(Function);
    // Should return the same formatter as getTimeFormatter
    const expectedFormatter = getTimeFormatter(format);
    expect(formatter).toEqual(expectedFormatter);
  });

  it('should return undefined for falsy values', () => {
    const formatter = getXAxisFormatter(null as any);
    expect(formatter).toBeUndefined();
  });
});

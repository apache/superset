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
  fDuration,
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
  extendedDayjs,
} from 'src/utils/dates';

describe('extendedDayjs', () => {
  it('returns dayjs object with extended methods', () => {
    const dayjs = extendedDayjs();
    expect(dayjs).toHaveProperty('utc');
    expect(dayjs).toHaveProperty('calendar');
    expect(dayjs).toHaveProperty('tz');
    expect(dayjs).toHaveProperty('fromNow');
    expect(
      extendedDayjs(
        '05/02/69 1:02:03 PM -05:00',
        'MM/DD/YY H:mm:ss A Z',
      ).toISOString(),
    ).toEqual('1969-05-02T18:02:03.000Z');
    expect(extendedDayjs).toHaveProperty('duration');
    expect(extendedDayjs).toHaveProperty('updateLocale');
  });
});

describe('fDuration', () => {
  it('is a function', () => {
    expect(typeof fDuration).toBe('function');
  });

  it('returns a string', () => {
    expect(typeof fDuration(new Date().getTime(), new Date().getTime())).toBe(
      'string',
    );
  });

  it('returns the expected output', () => {
    const output = fDuration(1496293608897, 1496293623406);
    expect(output).toBe('00:00:14.509');
  });
});

describe('now', () => {
  it('is a function', () => {
    expect(typeof now).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof now()).toBe('number');
  });
});

describe('epochTimeXHoursAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXHoursAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXHoursAgo(1)).toBe('number');
  });
});

describe('epochTimeXDaysAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXDaysAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXDaysAgo(1)).toBe('number');
  });
});

describe('epochTimeXYearsAgo', () => {
  it('is a function', () => {
    expect(typeof epochTimeXYearsAgo).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof epochTimeXYearsAgo(1)).toBe('number');
  });
});

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
} from 'src/utils/dates';

describe('fDuration', () => {
  it('is a function', () => {
    expect(typeof fDuration).toBe('function');
  });

  it('returns a string', () => {
    expect(typeof fDuration(new Date(), new Date())).toBe('string');
  });

  it('returns the expected output', () => {
    const output = fDuration('1496293608897', '1496293623406');
    expect(output).toBe('00:00:14.50');
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

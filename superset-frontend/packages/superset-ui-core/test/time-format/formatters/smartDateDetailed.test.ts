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

import { TimeFormatter, smartDateDetailedFormatter } from '@superset-ui/core';

describe('smartDateDetailedFormatter', () => {
  const formatter = smartDateDetailedFormatter;

  it('is a function', () => {
    expect(formatter).toBeInstanceOf(TimeFormatter);
  });

  it('shows only year when 1st day of the year', () => {
    expect(formatter(new Date('2020-01-01T00:00:00.000+00:00'))).toBe('2020');
  });

  it('shows full date when a regular date', () => {
    expect(formatter(new Date('2020-03-01T00:00:00.000+00:00'))).toBe(
      '2020-03-01',
    );
  });

  it('shows full date including time of day without seconds when hour precision', () => {
    expect(formatter(new Date('2020-03-01T13:00:00.000+00:00'))).toBe(
      '2020-03-01 13:00',
    );
  });

  it('shows full date including time of day when minute precision', () => {
    expect(formatter(new Date('2020-03-10T13:10:00.000+00:00'))).toBe(
      '2020-03-10 13:10',
    );
  });

  it('shows full date including time of day when subsecond precision', () => {
    expect(formatter(new Date('2020-03-10T13:10:00.100+00:00'))).toBe(
      '2020-03-10 13:10:00.100',
    );
  });
});

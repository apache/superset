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

import createTime from '../../../src/time-format/utils/createTime';

describe('createTime(mode, year, month, date, hours, minutes, seconds, milliseconds)', () => {
  describe('mode', () => {
    it('creates UTC time when mode==="utc"', () => {
      const time = createTime('utc', 2020, 5, 15);
      expect(time.getUTCFullYear()).toEqual(2020);
      expect(time.getUTCMonth()).toEqual(5);
      expect(time.getUTCDate()).toEqual(15);
    });
    it('creates local time when mode==="local"', () => {
      const time = createTime('local', 2020, 5, 15);
      expect(time.getFullYear()).toEqual(2020);
      expect(time.getMonth()).toEqual(5);
      expect(time.getDate()).toEqual(15);
    });
  });
  it('sets all the date parts', () => {
    const time = createTime('local', 2020, 5, 15, 1, 2, 3, 4);
    expect(time.getFullYear()).toEqual(2020);
    expect(time.getMonth()).toEqual(5);
    expect(time.getDate()).toEqual(15);
    expect(time.getHours()).toEqual(1);
    expect(time.getMinutes()).toEqual(2);
    expect(time.getSeconds()).toEqual(3);
    expect(time.getMilliseconds()).toEqual(4);
  });
  it('sets default values for date parts', () => {
    const time = createTime('utc', 2020);
    expect(time.getUTCMonth()).toEqual(0);
    expect(time.getUTCDate()).toEqual(1);
    expect(time.getUTCHours()).toEqual(0);
    expect(time.getUTCMinutes()).toEqual(0);
    expect(time.getUTCSeconds()).toEqual(0);
    expect(time.getUTCMilliseconds()).toEqual(0);
  });
});

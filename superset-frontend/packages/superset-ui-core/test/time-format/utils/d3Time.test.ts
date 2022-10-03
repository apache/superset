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

import {
  utcUtils,
  localTimeUtils,
} from '../../../src/time-format/utils/d3Time';

describe('utils', () => {
  describe('utcUtils', () => {
    it('has isNotFirstDayOfWeekStartOnSunday', () => {
      const date = new Date(Date.UTC(2018, 10, 19));
      expect(utcUtils.isNotFirstDayOfWeekStartOnSunday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 18));
      expect(utcUtils.isNotFirstDayOfWeekStartOnSunday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnMonday', () => {
      const date = new Date(Date.UTC(2018, 10, 20));
      expect(utcUtils.isNotFirstDayOfWeekStartOnMonday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 19));
      expect(utcUtils.isNotFirstDayOfWeekStartOnMonday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnTuesday', () => {
      const date = new Date(Date.UTC(2018, 10, 21));
      expect(utcUtils.isNotFirstDayOfWeekStartOnTuesday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 20));
      expect(utcUtils.isNotFirstDayOfWeekStartOnTuesday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnWednesday', () => {
      const date = new Date(Date.UTC(2018, 10, 22));
      expect(utcUtils.isNotFirstDayOfWeekStartOnWednesday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 21));
      expect(utcUtils.isNotFirstDayOfWeekStartOnWednesday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnThursday', () => {
      const date = new Date(Date.UTC(2018, 10, 23));
      expect(utcUtils.isNotFirstDayOfWeekStartOnThursday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 22));
      expect(utcUtils.isNotFirstDayOfWeekStartOnThursday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnFriday', () => {
      const date = new Date(Date.UTC(2018, 10, 24));
      expect(utcUtils.isNotFirstDayOfWeekStartOnFriday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 23));
      expect(utcUtils.isNotFirstDayOfWeekStartOnFriday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnSaturday', () => {
      const date = new Date(Date.UTC(2018, 10, 25));
      expect(utcUtils.isNotFirstDayOfWeekStartOnSaturday(date)).toBeTruthy();
      const date2 = new Date(Date.UTC(2018, 10, 24));
      expect(utcUtils.isNotFirstDayOfWeekStartOnSaturday(date2)).toBeFalsy();
    });
  });
  describe('localTimeUtils', () => {
    it('has isNotFirstDayOfWeekStartOnSunday', () => {
      const date = new Date(2018, 10, 19);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnSunday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 18);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnSunday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnMonday', () => {
      const date = new Date(2018, 10, 20);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnMonday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 19);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnMonday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnTuesday', () => {
      const date = new Date(2018, 10, 21);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnTuesday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 20);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnTuesday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnWednesday', () => {
      const date = new Date(2018, 10, 22);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnWednesday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 21);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnWednesday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnThursday', () => {
      const date = new Date(2018, 10, 23);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnThursday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 22);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnThursday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnFriday', () => {
      const date = new Date(2018, 10, 24);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnFriday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 23);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnFriday(date2),
      ).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnSaturday', () => {
      const date = new Date(2018, 10, 25);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnSaturday(date),
      ).toBeTruthy();
      const date2 = new Date(2018, 10, 24);
      expect(
        localTimeUtils.isNotFirstDayOfWeekStartOnSaturday(date2),
      ).toBeFalsy();
    });
  });
});

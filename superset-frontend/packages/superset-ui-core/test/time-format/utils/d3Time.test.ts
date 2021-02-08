import { utcUtils, localTimeUtils } from '@superset-ui/core/src/time-format/utils/d3Time';

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
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnSunday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 18);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnSunday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnMonday', () => {
      const date = new Date(2018, 10, 20);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnMonday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 19);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnMonday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnTuesday', () => {
      const date = new Date(2018, 10, 21);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnTuesday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 20);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnTuesday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnWednesday', () => {
      const date = new Date(2018, 10, 22);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnWednesday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 21);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnWednesday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnThursday', () => {
      const date = new Date(2018, 10, 23);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnThursday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 22);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnThursday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnFriday', () => {
      const date = new Date(2018, 10, 24);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnFriday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 23);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnFriday(date2)).toBeFalsy();
    });
    it('has isNotFirstDayOfWeekStartOnSaturday', () => {
      const date = new Date(2018, 10, 25);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnSaturday(date)).toBeTruthy();
      const date2 = new Date(2018, 10, 24);
      expect(localTimeUtils.isNotFirstDayOfWeekStartOnSaturday(date2)).toBeFalsy();
    });
  });
});

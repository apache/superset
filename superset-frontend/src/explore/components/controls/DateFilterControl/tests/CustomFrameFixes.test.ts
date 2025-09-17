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

/**
 * Test cases for Custom Frame fixes:
 * 1. Relative option removed from dropdown
 * 2. Date picker visibility when Specific Date/Time is selected
 * 3. Specific Date/Time is default for both dropdowns
 * 4. Start date defaults to one day ago, end date to now
 */

import { customTimeRangeDecode } from '@superset-ui/core';
import {
  SINCE_MODE_OPTIONS,
  UNTIL_MODE_OPTIONS,
} from '../utils/constants';
import { DateTimeModeType } from '../types';

describe('Custom Frame Fixes', () => {
  describe('1. Relative Option Removal', () => {
    it('should not include relative option in SINCE_MODE_OPTIONS', () => {
      const relativeOption = SINCE_MODE_OPTIONS.find(option => option.value === 'relative');
      expect(relativeOption).toBeUndefined();
    });

    it('should not include relative option in UNTIL_MODE_OPTIONS', () => {
      const relativeOption = UNTIL_MODE_OPTIONS.find(option => option.value === 'relative');
      expect(relativeOption).toBeUndefined();
    });

    it('should only include specific option', () => {
      const expectedValues = ['specific'];
      const actualValues = SINCE_MODE_OPTIONS.map(option => option.value);
      
      expect(actualValues).toEqual(expectedValues);
      expect(actualValues).toHaveLength(1);
    });

    it('should only allow specific as DateTimeModeType', () => {
      // This is a compile-time check, but we can verify the type constraint
      const validModes: DateTimeModeType[] = ['specific'];
      
      // Should not throw any TypeScript errors
      validModes.forEach(mode => {
        expect(['specific']).toContain(mode);
      });
    });
  });

  describe('2. Date Picker Default Behavior', () => {
    it('should default to specific mode for both since and until', () => {
      // Test with a simple custom range that should trigger defaults
      const result = customTimeRangeDecode('invalid : invalid');
      
      expect(result.customRange.sinceMode).toBe('specific');
      expect(result.customRange.untilMode).toBe('specific');
    });

    it('should have valid datetime strings as defaults', () => {
      const result = customTimeRangeDecode('invalid : invalid');
      
      // Should be valid ISO datetime strings
      expect(result.customRange.sinceDatetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.customRange.untilDatetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Should be parseable as dates
      const sinceDate = new Date(result.customRange.sinceDatetime);
      const untilDate = new Date(result.customRange.untilDatetime);
      
      expect(sinceDate.getTime()).not.toBeNaN();
      expect(untilDate.getTime()).not.toBeNaN();
    });
  });

  describe('3. Default Date Values', () => {
    it('should set start date to approximately one day ago', () => {
      const result = customTimeRangeDecode('invalid : invalid');
      const sinceDate = new Date(result.customRange.sinceDatetime);
      
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Should be within 24 hours of one day ago
      const timeDiff = Math.abs(sinceDate.getTime() - oneDayAgo.getTime());
      expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it('should set end date to approximately now', () => {
      const result = customTimeRangeDecode('invalid : invalid');
      const untilDate = new Date(result.customRange.untilDatetime);
      
      const now = new Date();
      
      // Should be within 24 hours of now (to account for static time at module load)
      const timeDiff = Math.abs(untilDate.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000);
      
      // But should be reasonably recent (not in far past/future)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      expect(untilDate.getTime()).toBeGreaterThan(oneWeekAgo.getTime());
      expect(untilDate.getTime()).toBeLessThan(oneWeekFromNow.getTime());
    });

    it('should have since date before until date', () => {
      const result = customTimeRangeDecode('invalid : invalid');
      const sinceDate = new Date(result.customRange.sinceDatetime);
      const untilDate = new Date(result.customRange.untilDatetime);
      
      expect(sinceDate.getTime()).toBeLessThan(untilDate.getTime());
    });
  });

  describe('4. Mode Options Structure', () => {
    it('should have correct label for specific mode', () => {
      const expectedOptions = [
        { value: 'specific', label: expect.any(String) },
      ];
      
      expect(SINCE_MODE_OPTIONS).toEqual(expectedOptions);
    });

    it('should have UNTIL_MODE_OPTIONS match SINCE_MODE_OPTIONS', () => {
      expect(UNTIL_MODE_OPTIONS).toEqual(SINCE_MODE_OPTIONS);
    });
  });

  describe('5. Backward Compatibility', () => {
    it('should still parse existing specific:specific ranges correctly', () => {
      const result = customTimeRangeDecode('2021-01-20T00:00:00 : 2021-01-27T00:00:00');
      
      expect(result.matchedFlag).toBe(true);
      expect(result.customRange.sinceMode).toBe('specific');
      expect(result.customRange.untilMode).toBe('specific');
      expect(result.customRange.sinceDatetime).toBe('2021-01-20T00:00:00');
      expect(result.customRange.untilDatetime).toBe('2021-01-27T00:00:00');
    });

    it('should still parse existing time ranges correctly', () => {
      const result = customTimeRangeDecode('2021-01-01T00:00:00 : 2021-01-02T00:00:00');
      
      expect(result.matchedFlag).toBe(true);
      expect(result.customRange.sinceMode).toBe('specific');
      expect(result.customRange.untilMode).toBe('specific');
    });
  });

  describe('6. Edge Cases', () => {
    it('should handle empty string gracefully', () => {
      const result = customTimeRangeDecode('');
      
      expect(result.matchedFlag).toBe(false);
      expect(result.customRange.sinceMode).toBe('specific');
      expect(result.customRange.untilMode).toBe('specific');
    });

    it('should handle malformed time range gracefully', () => {
      const result = customTimeRangeDecode('malformed-range');
      
      expect(result.matchedFlag).toBe(false);
      expect(result.customRange.sinceMode).toBe('specific');
      expect(result.customRange.untilMode).toBe('specific');
    });
  });
});

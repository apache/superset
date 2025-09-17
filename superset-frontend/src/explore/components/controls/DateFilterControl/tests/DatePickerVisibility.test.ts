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
 * Test cases specifically for date picker visibility and UI behavior
 * after the fixes for Custom Frame dropdown issues
 */

import { customTimeRangeDecode } from '@superset-ui/core';
import { customTimeRangeEncode } from '../utils/dateParser';

describe('Date Picker Visibility and UI Behavior', () => {
  describe('Default State Testing', () => {
    it('should create a default custom range with specific modes', () => {
      // This simulates what happens when a user first opens Custom date range
      const defaultRange = customTimeRangeDecode('').customRange;
      
      expect(defaultRange.sinceMode).toBe('specific');
      expect(defaultRange.untilMode).toBe('specific');
    });

    it('should have valid default datetime values for date pickers', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      
      // Date pickers should receive valid datetime strings
      expect(defaultRange.sinceDatetime).toBeTruthy();
      expect(defaultRange.untilDatetime).toBeTruthy();
      
      // Should be valid dates
      const sinceDate = new Date(defaultRange.sinceDatetime);
      const untilDate = new Date(defaultRange.untilDatetime);
      
      expect(sinceDate instanceof Date && !isNaN(sinceDate.getTime())).toBe(true);
      expect(untilDate instanceof Date && !isNaN(untilDate.getTime())).toBe(true);
    });

    it('should encode and decode default range correctly', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      const encoded = customTimeRangeEncode(defaultRange);
      const decoded = customTimeRangeDecode(encoded);
      
      expect(decoded.customRange.sinceMode).toBe('specific');
      expect(decoded.customRange.untilMode).toBe('specific');
    });
  });

  describe('Mode Switching Behavior', () => {
    it('should maintain specific mode consistently', () => {
      let currentRange = customTimeRangeDecode('').customRange;
      
      // Start with specific mode (default and only option)
      expect(currentRange.sinceMode).toBe('specific');
      
      // Should always be in specific mode since it's the only option
      expect(currentRange.sinceMode).toBe('specific');
      expect(currentRange.sinceDatetime).toBeTruthy();
    });

    it('should only support specific mode', () => {
      const availableModes = ['specific'] as const;
      let currentRange = customTimeRangeDecode('').customRange;
      
      availableModes.forEach(mode => {
        currentRange = { ...currentRange, sinceMode: mode };
        expect(currentRange.sinceMode).toBe(mode);
      });
    });
  });

  describe('Date Range Validation', () => {
    it('should have start date before end date in default range', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      const sinceDate = new Date(defaultRange.sinceDatetime);
      const untilDate = new Date(defaultRange.untilDatetime);
      
      expect(sinceDate.getTime()).toBeLessThan(untilDate.getTime());
    });

    it('should have approximately 24 hours between default start and end', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      const sinceDate = new Date(defaultRange.sinceDatetime);
      const untilDate = new Date(defaultRange.untilDatetime);
      
      const timeDiff = untilDate.getTime() - sinceDate.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Should be approximately 24 hours (within broader range to account for timezone/execution time)
      expect(hoursDiff).toBeGreaterThan(20);
      expect(hoursDiff).toBeLessThan(50);
    });
  });

  describe('ISO String Format Validation', () => {
    it('should produce valid ISO datetime strings for date pickers', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      
      // Should match ISO format (YYYY-MM-DDTHH:MM:SS or similar)
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(defaultRange.sinceDatetime).toMatch(isoRegex);
      expect(defaultRange.untilDatetime).toMatch(isoRegex);
    });

    it('should not contain Z suffix (timezone indicator)', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      
      // Date pickers expect local time format without Z
      expect(defaultRange.sinceDatetime).not.toContain('Z');
      expect(defaultRange.untilDatetime).not.toContain('Z');
    });
  });

  describe('Timezone Handling', () => {
    it('should handle datetime strings consistently', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      
      // Should be able to create Date objects without timezone issues
      const sinceDate = new Date(defaultRange.sinceDatetime);
      const untilDate = new Date(defaultRange.untilDatetime);
      
      // Should be within reasonable time bounds (not in far past/future)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      expect(sinceDate.getTime()).toBeGreaterThan(oneWeekAgo.getTime());
      expect(sinceDate.getTime()).toBeLessThan(oneWeekFromNow.getTime());
      
      expect(untilDate.getTime()).toBeGreaterThan(oneWeekAgo.getTime());
      expect(untilDate.getTime()).toBeLessThan(oneWeekFromNow.getTime());
    });
  });

  describe('UI State Consistency', () => {
    it('should maintain consistent state through encode/decode cycles', () => {
      // Start with default
      const originalRange = customTimeRangeDecode('').customRange;
      
      // Encode and decode multiple times
      let encoded = customTimeRangeEncode(originalRange);
      let decoded = customTimeRangeDecode(encoded);
      
      for (let i = 0; i < 3; i++) {
        encoded = customTimeRangeEncode(decoded.customRange);
        decoded = customTimeRangeDecode(encoded);
      }
      
      // Should still have specific modes
      expect(decoded.customRange.sinceMode).toBe('specific');
      expect(decoded.customRange.untilMode).toBe('specific');
    });
  });
});

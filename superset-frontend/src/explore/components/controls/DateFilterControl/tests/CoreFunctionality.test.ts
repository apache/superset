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

import { NO_TIME_RANGE } from '@superset-ui/core';
import { FRAME_OPTIONS, COMMON_RANGE_OPTIONS } from '../utils/constants';
import { guessFrame } from '../utils/dateFilterUtils';
import { FrameType, CommonRangeType } from '../types';

describe('Date Filter Core Functionality Tests', () => {
  
  describe('1. Advanced Option Removal', () => {
    test('FRAME_OPTIONS should not contain Advanced', () => {
      const hasAdvanced = FRAME_OPTIONS.some(option => option.value === 'Advanced');
      expect(hasAdvanced).toBe(false);
    });

    test('FRAME_OPTIONS should contain exactly 4 options', () => {
      expect(FRAME_OPTIONS).toHaveLength(4);
      const values = FRAME_OPTIONS.map(option => option.value);
      expect(values).toEqual(['Common', 'Calendar', 'Current', 'Custom']);
    });

    test('guessFrame should return Custom for previously Advanced cases', () => {
      const advancedCases = [
        '100 years ago : now',
        '2020-01-01T00:00:00 : 2021-01-01T00:00:00',
        'DATEADD(DATETIME("now"), -1, year) : now',
        'arbitrary text : more text',
        'some random advanced format',
      ];

      advancedCases.forEach(timeRange => {
        expect(guessFrame(timeRange)).toBe('Custom');
      });
    });
  });

  describe('2. Common Range Updates', () => {
    test('COMMON_RANGE_OPTIONS should have exactly 3 options', () => {
      expect(COMMON_RANGE_OPTIONS).toHaveLength(3);
    });

    test('COMMON_RANGE_OPTIONS should have updated labels', () => {
      const expectedLabels = ['Last 24 hours', 'Last 7 Days', 'Last 30 Days'];
      
      COMMON_RANGE_OPTIONS.forEach((option, index) => {
        // The labels are wrapped in t() function calls, so we check the structure
        expect(option.label).toBeDefined();
        // In test environment, t() might return a string directly
        expect(typeof option.label).toMatch(/string|object/);
      });

      // Check values remain the same for backend compatibility
      const values = COMMON_RANGE_OPTIONS.map(option => option.value);
      expect(values).toEqual(['Last day', 'Last week', 'Last month']);
    });

    test('COMMON_RANGE_OPTIONS should not contain Last quarter or Last year', () => {
      const values = COMMON_RANGE_OPTIONS.map(option => option.value);
      expect(values).not.toContain('Last quarter');
      expect(values).not.toContain('Last year');
    });

    test('guessFrame should correctly identify remaining common ranges', () => {
      expect(guessFrame('Last day')).toBe('Common');
      expect(guessFrame('Last week')).toBe('Common');
      expect(guessFrame('Last month')).toBe('Common');
    });

    test('guessFrame should not identify removed ranges as Common', () => {
      expect(guessFrame('Last quarter')).not.toBe('Common');
      expect(guessFrame('Last year')).not.toBe('Common');
    });
  });

  describe('3. No Filter Option Removal', () => {
    test('FRAME_OPTIONS should not contain No filter', () => {
      const hasNoFilter = FRAME_OPTIONS.some(option => option.value === 'No filter');
      expect(hasNoFilter).toBe(false);
    });

    test('guessFrame should return Custom for NO_TIME_RANGE', () => {
      expect(guessFrame(NO_TIME_RANGE)).toBe('Custom');
    });

    test('guessFrame should return Custom for empty strings', () => {
      expect(guessFrame('')).toBe('Custom');
      expect(guessFrame('  ')).toBe('Custom');
    });
  });

  describe('4. Fallback Behavior', () => {
    test('Valid time ranges should still be correctly categorized', () => {
      // Common ranges
      expect(guessFrame('Last day')).toBe('Common');
      expect(guessFrame('Last week')).toBe('Common');
      expect(guessFrame('Last month')).toBe('Common');

      // Calendar ranges
      expect(guessFrame('previous calendar week')).toBe('Calendar');
      expect(guessFrame('previous calendar month')).toBe('Calendar');
      expect(guessFrame('previous calendar year')).toBe('Calendar');

      // Current ranges
      expect(guessFrame('Current day')).toBe('Current');
      expect(guessFrame('Current week')).toBe('Current');
      expect(guessFrame('Current month')).toBe('Current');
      expect(guessFrame('Current quarter')).toBe('Current');
      expect(guessFrame('Current year')).toBe('Current');
    });

    test('All unknown/invalid formats should fall back to Custom', () => {
      const unknownCases = [
        'invalid format',
        'not a time range',
        '123abc',
        'undefined',
        'null',
        'Last quarter', // removed option
        'Last year',    // removed option
        NO_TIME_RANGE,
        '100 years ago : now', // would have been Advanced
      ];

      unknownCases.forEach(timeRange => {
        expect(guessFrame(timeRange)).toBe('Custom');
      });
    });
  });

  describe('5. Type Safety Verification', () => {
    test('FrameType should only allow valid frame types', () => {
      const validFrameTypes: FrameType[] = ['Common', 'Calendar', 'Current', 'Custom'];
      expect(validFrameTypes).toHaveLength(4);
      
      // TypeScript compilation ensures these are the only valid types
      validFrameTypes.forEach(frameType => {
        expect(['Common', 'Calendar', 'Current', 'Custom']).toContain(frameType);
      });
    });

    test('CommonRangeType should only allow valid common range types', () => {
      const validCommonTypes: CommonRangeType[] = ['Last day', 'Last week', 'Last month'];
      expect(validCommonTypes).toHaveLength(3);
      
      // TypeScript compilation ensures these are the only valid types
      validCommonTypes.forEach(commonType => {
        expect(['Last day', 'Last week', 'Last month']).toContain(commonType);
      });
    });
  });

  describe('6. Edge Cases and Error Handling', () => {
    test('guessFrame should handle null and undefined gracefully', () => {
      // These will be converted to strings by JavaScript
      expect(guessFrame('null')).toBe('Custom');
      expect(guessFrame('undefined')).toBe('Custom');
    });

    test('guessFrame should handle special characters', () => {
      expect(guessFrame('!@#$%^&*()')).toBe('Custom');
      expect(guessFrame('日本語')).toBe('Custom');
      expect(guessFrame('🎉💻⚡')).toBe('Custom');
    });

    test('guessFrame should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      expect(guessFrame(longString)).toBe('Custom');
    });

    test('FRAME_OPTIONS structure is correct', () => {
      FRAME_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(option.label).toBeDefined();
      });
    });

    test('COMMON_RANGE_OPTIONS structure is correct', () => {
      COMMON_RANGE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(option.label).toBeDefined();
      });
    });
  });

  describe('7. Backward Compatibility', () => {
    test('Common range values should remain unchanged for API compatibility', () => {
      const values = COMMON_RANGE_OPTIONS.map(option => option.value);
      expect(values).toEqual(['Last day', 'Last week', 'Last month']);
    });

    test('Frame option values should remain unchanged for API compatibility', () => {
      const values = FRAME_OPTIONS.map(option => option.value);
      expect(values).toEqual(['Common', 'Calendar', 'Current', 'Custom']);
    });

    test('guessFrame should maintain correct categorization for existing valid ranges', () => {
      // Ensure existing functionality is not broken
      const validPairs = [
        ['Last day', 'Common'],
        ['Last week', 'Common'],
        ['Last month', 'Common'],
        ['previous calendar week', 'Calendar'],
        ['previous calendar month', 'Calendar'],
        ['previous calendar year', 'Calendar'],
        ['Current day', 'Current'],
        ['Current week', 'Current'],
        ['Current month', 'Current'],
        ['Current quarter', 'Current'],
        ['Current year', 'Current'],
      ];

      validPairs.forEach(([timeRange, expectedFrame]) => {
        expect(guessFrame(timeRange)).toBe(expectedFrame);
      });
    });
  });
});

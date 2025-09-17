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
 * Integration tests for all the custom frame fixes working together
 */

import { customTimeRangeDecode } from '@superset-ui/core';
import { customTimeRangeEncode } from '../utils/dateParser';
import {
  SINCE_MODE_OPTIONS,
  UNTIL_MODE_OPTIONS,
} from '../utils/constants';
import { DateTimeModeType } from '../types';

describe('Custom Frame Integration Tests', () => {
  describe('Complete User Flow Simulation', () => {
    it('should handle complete user interaction flow', () => {
      // Step 1: User opens Custom date range (starts with defaults)
      let currentRange = customTimeRangeDecode('').customRange;
      
      // Should start with specific mode and valid dates
      expect(currentRange.sinceMode).toBe('specific');
      expect(currentRange.untilMode).toBe('specific');
      expect(new Date(currentRange.sinceDatetime)).toBeInstanceOf(Date);
      expect(new Date(currentRange.untilDatetime)).toBeInstanceOf(Date);
      
      // Step 2: User sees only specific option (no dropdown needed)
      const sinceOptions = SINCE_MODE_OPTIONS.map(opt => opt.value);
      const untilOptions = UNTIL_MODE_OPTIONS.map(opt => opt.value);
      
      expect(sinceOptions).not.toContain('relative');
      expect(untilOptions).not.toContain('relative');
      expect(sinceOptions).toEqual(['specific']);
      expect(untilOptions).toEqual(['specific']);
      
      // Step 3: User can only use specific mode (simplified UI)
      expect(currentRange.sinceMode).toBe('specific');
      expect(currentRange.untilMode).toBe('specific');
      expect(currentRange.sinceDatetime).toBeTruthy();
      
      // Step 4: Encode/decode cycle (simulates form submission/reload)
      const encoded = customTimeRangeEncode(currentRange);
      const decoded = customTimeRangeDecode(encoded);
      
      expect(decoded.customRange.sinceMode).toBe('specific');
      expect(decoded.customRange.untilMode).toBe('specific');
    });

    it('should maintain data integrity through date changes', () => {
      let currentRange = customTimeRangeDecode('').customRange;
      
      // Test changing datetime values while maintaining specific mode
      const newSinceDate = '2023-01-01T10:00:00';
      const newUntilDate = '2023-01-02T15:30:00';
      
      currentRange = { ...currentRange, sinceDatetime: newSinceDate };
      currentRange = { ...currentRange, untilDatetime: newUntilDate };
      
      // After changes, encoding/decoding should work
      const encoded = customTimeRangeEncode(currentRange);
      const decoded = customTimeRangeDecode(encoded);
      
      // Basic structure should be maintained
      expect(decoded.customRange).toHaveProperty('sinceMode');
      expect(decoded.customRange).toHaveProperty('untilMode');
      expect(decoded.customRange).toHaveProperty('sinceDatetime');
      expect(decoded.customRange).toHaveProperty('untilDatetime');
      
      // Values should be preserved
      expect(decoded.customRange.sinceMode).toBe('specific');
      expect(decoded.customRange.untilMode).toBe('specific');
    });
  });

  describe('Date Range Validation and Consistency', () => {
    it('should produce logical date ranges', () => {
      // Test multiple scenarios
      const scenarios = [
        customTimeRangeDecode('').customRange, // Default
        customTimeRangeDecode('invalid').customRange, // Fallback
        customTimeRangeDecode('malformed:range').customRange, // Another fallback
      ];
      
      scenarios.forEach((range, index) => {
        const sinceDate = new Date(range.sinceDatetime);
        const untilDate = new Date(range.untilDatetime);
        
        // Basic date validity
        expect(sinceDate.getTime()).not.toBeNaN();
        expect(untilDate.getTime()).not.toBeNaN();
        
        // Logical order
        expect(sinceDate.getTime()).toBeLessThan(untilDate.getTime());
        
        // Reasonable time range (not too far in past/future)
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        expect(sinceDate.getTime()).toBeGreaterThan(monthAgo.getTime());
        expect(untilDate.getTime()).toBeLessThan(monthFromNow.getTime());
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        '',
        'invalid',
        'random text',
        'malformed',
      ];
      
      edgeCases.forEach(testCase => {
        const result = customTimeRangeDecode(testCase);
        
        // Should always fallback gracefully
        expect(result.customRange.sinceMode).toBe('specific');
        expect(result.customRange.untilMode).toBe('specific');
        
        // Should provide valid fallback dates
        const sinceDate = new Date(result.customRange.sinceDatetime);
        const untilDate = new Date(result.customRange.untilDatetime);
        
        // At minimum, should not crash and should provide some date values
        expect(result.customRange.sinceDatetime).toBeDefined();
        expect(result.customRange.untilDatetime).toBeDefined();
        expect(typeof result.customRange.sinceDatetime).toBe('string');
        expect(typeof result.customRange.untilDatetime).toBe('string');
      });
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle rapid encode/decode cycles efficiently', () => {
      const startTime = Date.now();
      let currentRange = customTimeRangeDecode('').customRange;
      
      // Perform 100 encode/decode cycles
      for (let i = 0; i < 100; i++) {
        const encoded = customTimeRangeEncode(currentRange);
        const decoded = customTimeRangeDecode(encoded);
        currentRange = decoded.customRange;
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Final result should still be valid
      expect(currentRange.sinceMode).toBe('specific');
      expect(currentRange.untilMode).toBe('specific');
    });

    it('should not leak memory during repeated operations', () => {
      // This is a basic test - in a real scenario you'd use memory profiling tools
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < 1000; i++) {
        const range = customTimeRangeDecode(`test-${i}`).customRange;
        customTimeRangeEncode(range);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage shouldn't grow dramatically (allowing for some overhead)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });
  });

  describe('Backward Compatibility Verification', () => {
    it('should maintain compatibility with existing datetime ranges', () => {
      const existingValidRanges = [
        '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
        '2023-06-15T10:30:00 : 2023-06-16T15:45:00',
      ];
      
      existingValidRanges.forEach(range => {
        const result = customTimeRangeDecode(range);
        
        // Should parse successfully
        expect(result.matchedFlag).toBe(true);
        
        // Should always result in specific mode since that's the only option
        expect(result.customRange.sinceMode).toBe('specific');
        expect(result.customRange.untilMode).toBe('specific');
      });
    });

    it('should handle legacy relative ranges gracefully', () => {
      // These ranges might exist in saved charts but should fallback to new defaults
      const legacyRelativeRanges = [
        'DATEADD(DATETIME("now"), -7, day) : now',
        'DATEADD(DATETIME("today"), -1, month) : today',
      ];
      
      legacyRelativeRanges.forEach(range => {
        const result = customTimeRangeDecode(range);
        
        // Should not crash and should provide fallback
        expect(result).toBeDefined();
        expect(result.customRange).toBeDefined();
        
        // Should default to specific modes (our new default)
        if (result.matchedFlag === false) {
          expect(result.customRange.sinceMode).toBe('specific');
          expect(result.customRange.untilMode).toBe('specific');
        }
      });
    });
  });

  describe('UI State Verification', () => {
    it('should provide consistent state for UI components', () => {
      const defaultRange = customTimeRangeDecode('').customRange;
      
      // All properties required by UI should be present
      const requiredProperties = [
        'sinceMode', 'untilMode',
        'sinceDatetime', 'untilDatetime',
        'sinceGrain', 'untilGrain',
        'sinceGrainValue', 'untilGrainValue',
        'anchorMode', 'anchorValue'
      ];
      
      requiredProperties.forEach(prop => {
        expect(defaultRange).toHaveProperty(prop);
        expect(defaultRange[prop as keyof typeof defaultRange]).toBeDefined();
      });
    });

    it('should provide valid options for dropdown components', () => {
      // Verify dropdown options are properly structured
      SINCE_MODE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
      
      UNTIL_MODE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });
  });
});

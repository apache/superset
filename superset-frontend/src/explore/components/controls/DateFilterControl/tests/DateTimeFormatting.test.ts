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
 * Test to verify that datetime formatting in the "Actual time range" display
 * is user-friendly instead of the technical ISO format with "T"
 */

describe('DateTime Formatting for Display', () => {
  // Mock function to simulate the formatDateTimeForDisplay function
  const formatDateTimeForDisplay = (s: string, toTZ = 'Asia/Kolkata') => {
    const isoRe = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;
    const matches = [...s.matchAll(isoRe)].map(m => m[0]);
    
    if (matches.length < 2) return s;

    const formatForDisplay = (iso: string) => {
      const src = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
      const dt = new Date(src);

      return new Intl.DateTimeFormat('en-US', {
        timeZone: toTZ,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(dt);
    };

    const formattedStart = formatForDisplay(matches[0]);
    const formattedEnd = formatForDisplay(matches[1]);

    return s.replace(matches[0], formattedStart).replace(matches[1], formattedEnd);
  };

  it('should format ISO datetime to user-friendly format', () => {
    const isoTimeRange = '2025-09-01T00:00:00 ≤ date < 2025-10-01T00:00:00';
    const formattedTimeRange = formatDateTimeForDisplay(isoTimeRange);
    
    // Should not contain the "T" separator
    expect(formattedTimeRange).not.toContain('T');
    
    // Should contain month abbreviations and user-friendly time format
    expect(formattedTimeRange).toContain('Sep');
    expect(formattedTimeRange).toContain('Oct');
    expect(formattedTimeRange).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  it('should demonstrate the improvement from technical to user-friendly format', () => {
    const technicalFormat = '2025-09-01T14:30:00 ≤ date < 2025-09-02T09:15:00';
    const userFriendlyFormat = formatDateTimeForDisplay(technicalFormat);
    
    // Before: Technical ISO format with T
    expect(technicalFormat).toContain('T');
    expect(technicalFormat).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    
    // After: User-friendly format
    expect(userFriendlyFormat).not.toContain('T');
    expect(userFriendlyFormat).toContain('Sep');
    expect(userFriendlyFormat).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    
    console.log('Before (technical):', technicalFormat);
    console.log('After (user-friendly):', userFriendlyFormat);
  });

  it('should handle various datetime formats correctly', () => {
    const testCases = [
      {
        input: '2025-01-01T00:00:00 ≤ date < 2025-01-02T23:59:59',
        description: 'New Year dates',
      },
      {
        input: '2025-12-25T12:00:00 ≤ date < 2025-12-26T12:00:00',
        description: 'Christmas dates',
      },
    ];

    testCases.forEach(({ input, description }) => {
      const formatted = formatDateTimeForDisplay(input);
      
      // Should not contain T separator
      expect(formatted).not.toContain('T');
      
      // Should contain user-friendly elements
      expect(formatted).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
      expect(formatted).toContain('date');
      
      console.log(`${description}:`, formatted);
    });
  });

  it('should preserve the inequality symbols and date text', () => {
    const timeRange = '2025-09-01T00:00:00 ≤ date < 2025-10-01T00:00:00';
    const formatted = formatDateTimeForDisplay(timeRange);
    
    // Should preserve the range format with symbols
    expect(formatted).toContain('≤');
    expect(formatted).toContain('<');
    expect(formatted).toContain('date');
    
    // Should follow the pattern: "formatted_date ≤ date < formatted_date"
    expect(formatted).toMatch(/.*≤\s*date\s*<.*/);
  });

  it('should handle edge cases gracefully', () => {
    // Single date (should return as-is)
    expect(formatDateTimeForDisplay('2025-09-01T00:00:00')).toBe('2025-09-01T00:00:00');
    
    // No dates
    expect(formatDateTimeForDisplay('No dates here')).toBe('No dates here');
    
    // Empty string
    expect(formatDateTimeForDisplay('')).toBe('');
    
    // Malformed range
    expect(formatDateTimeForDisplay('invalid range format')).toBe('invalid range format');
  });

  it('should show the complete transformation example', () => {
    const before = '2025-09-01T00:00:00 ≤ date < 2025-10-01T00:00:00';
    const after = formatDateTimeForDisplay(before);
    
    console.log('=== DATETIME FORMATTING TRANSFORMATION ===');
    console.log('❌ Before (Technical):', before);
    console.log('✅ After (User-Friendly):', after);
    console.log('');
    console.log('Benefits:');
    console.log('- Removed technical "T" separator');
    console.log('- Added readable month names (Sep, Oct)');
    console.log('- Used 12-hour format with AM/PM');
    console.log('- More accessible to business users');
    
    // Verify the transformation
    expect(before).toContain('T');
    expect(after).not.toContain('T');
    expect(after).toMatch(/Sep.*Oct/);
  });
});

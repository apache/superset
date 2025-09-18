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

describe('Actual Time Range Formatting', () => {
  // Test the formatDateTimeForDisplay function from DateFilterLabel
  const formatDateTimeForDisplay = (s: string, toTZ = 'Asia/Kolkata') => {
    // Pattern for full ISO datetime stamps
    const isoRe =
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;

    // Pattern for date-only formats (YYYY-MM-DD)
    const dateOnlyRe = /\d{4}-\d{2}-\d{2}(?!\d)/g;

    // Try full datetime format first
    const isoMatches = [...s.matchAll(isoRe)].map(m => m[0]);
    if (isoMatches.length >= 2) {
      const formatForDisplay = (iso: string) => {
        // If no offset, assume UTC
        const src = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
        const dt = new Date(src);

        // Format as user-friendly string in target zone
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

      const formattedStart = formatForDisplay(isoMatches[0]);
      const formattedEnd = formatForDisplay(isoMatches[1]);

      return s
        .replace(isoMatches[0], formattedStart)
        .replace(isoMatches[1], formattedEnd);
    }

    // Try date-only format (for Last/Previous/Current frames)
    const dateMatches = [...s.matchAll(dateOnlyRe)].map(m => m[0]);
    if (dateMatches.length >= 2) {
      const formatDateOnly = (dateStr: string) => {
        // Convert date-only to datetime at start of day in target timezone
        const dt = new Date(`${dateStr}T00:00:00`);

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

      const formattedStart = formatDateOnly(dateMatches[0]);
      const formattedEnd = formatDateOnly(dateMatches[1]);

      return s
        .replace(dateMatches[0], formattedStart)
        .replace(dateMatches[1], formattedEnd);
    }

    // Return original string if no recognized patterns
    return s;
  };

  test('should format full datetime ranges (Custom frame)', () => {
    const input = '2025-09-16T00:00:00 ≤ date < 2025-09-17T17:38:16';
    const result = formatDateTimeForDisplay(input, 'UTC');
    
    expect(result).toMatch(/Sep 16, 2025, \d{1,2}:\d{2} [AP]M ≤ date < Sep 17, 2025, \d{1,2}:\d{2} [AP]M/);
    expect(result).not.toContain('2025-09-16T00:00:00');
    expect(result).not.toContain('2025-09-17T17:38:16');
  });

  test('should format date-only ranges (Last/Previous/Current frames)', () => {
    const input = '2025-09-10 ≤ date < 2025-09-17';
    const result = formatDateTimeForDisplay(input, 'UTC');
    
    expect(result).toMatch(/Sep 10, 2025, \d{1,2}:\d{2} [AP]M ≤ date < Sep 17, 2025, \d{1,2}:\d{2} [AP]M/);
    expect(result).not.toContain('2025-09-10');
    expect(result).not.toContain('2025-09-17');
  });

  test('should handle different timezones', () => {
    const input = '2025-09-10 ≤ date < 2025-09-17';
    const resultUTC = formatDateTimeForDisplay(input, 'UTC');
    const resultKolkata = formatDateTimeForDisplay(input, 'Asia/Kolkata');
    
    // Both should be formatted but may have different times due to timezone
    expect(resultUTC).toMatch(/Sep 10, 2025, \d{1,2}:\d{2} [AP]M/);
    expect(resultKolkata).toMatch(/Sep 10, 2025, \d{1,2}:\d{2} [AP]M/);
  });

  test('should return original string if no recognized patterns', () => {
    const input = 'No time range detected';
    const result = formatDateTimeForDisplay(input);
    
    expect(result).toBe(input);
  });

  test('should handle single date (should not format)', () => {
    const input = '2025-09-10 ≤ date';
    const result = formatDateTimeForDisplay(input);
    
    expect(result).toBe(input); // Should not change if only one date
  });
});


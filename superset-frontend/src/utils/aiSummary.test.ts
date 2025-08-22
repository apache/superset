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

import {
  generateSummary,
  extractRawDataSample,
  extractLightweightData,
  ChartSummaryInput,
} from './aiSummary';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

describe('aiSummary utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.search = '';
  });

  describe('extractRawDataSample', () => {
    it('should extract data sample from query data', () => {
      const queriesData = [
        {
          data: [
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 },
          ],
        },
      ];

      const result = extractRawDataSample(queriesData);
      expect(result).toEqual([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]);
    });

    it('should limit to 200 rows', () => {
      const largeDataset = Array.from({ length: 300 }, (_, i) => ({
        id: i,
        value: `value_${i}`,
      }));
      const queriesData = [{ data: largeDataset }];

      const result = extractRawDataSample(queriesData);
      expect(result).toHaveLength(200);
      expect(result?.[0]).toEqual({ id: 0, value: 'value_0' });
      expect(result?.[199]).toEqual({ id: 199, value: 'value_199' });
    });

    it('should return null for invalid data', () => {
      expect(extractRawDataSample([])).toBeNull();
      expect(extractRawDataSample([{ data: 'not an array' }])).toBeNull();
      expect(extractRawDataSample([{}])).toBeNull();
    });
  });

  describe('extractLightweightData', () => {
    it('should extract and summarize data structure', () => {
      const queriesData = [
        {
          data: [
            { name: 'John', age: 30, active: true },
            { name: 'Jane', age: 25, active: false },
          ],
        },
      ];

      const result = extractLightweightData(queriesData);
      expect(result).toEqual([
        { name: 'John', age: 30, active: true },
        { name: 'Jane', age: 25, active: false },
      ]);
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(150);
      const queriesData = [
        {
          data: [{ description: longString }],
        },
      ];

      const result = extractLightweightData(queriesData);
      expect(Array.isArray(result) && result[0]?.description).toHaveLength(120);
    });
  });

  describe('generateSummary', () => {
    const mockSuccessResponse = {
      ok: true,
      json: async () => ({
        data: {
          result: {
            insight: 'This chart shows sales data trends over time.',
          },
        },
      }),
    };

    it('should send title and description to API', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

      const input: ChartSummaryInput = {
        vizType: 'line',
        title: 'Sales Over Time',
        description: 'Monthly sales data for Q1 2024',
        dataSample: [{ month: 'Jan', sales: 1000 }],
      };

      const result = await generateSummary(input);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.intelligence.fynd.com/service/panel/analytics/ai/sql-helper/explain-chart',
        expect.objectContaining({
          method: 'POST',
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chart_data: {
              vizType: 'line',
              dataSample: [{ month: 'Jan', sales: 1000 }],
              title: 'Sales Over Time',
              description: 'Monthly sales data for Q1 2024',
            },
          }),
          credentials: 'include',
        }),
      );

      expect(result).toBe('This chart shows sales data trends over time.');
    });

    it('should handle undefined title and description', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);

      const input: ChartSummaryInput = {
        vizType: 'bar',
        dataSample: [{ category: 'A', value: 100 }],
      };

      await generateSummary(input);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            chart_data: {
              vizType: 'bar',
              dataSample: [{ category: 'A', value: 100 }],
              title: undefined,
              description: undefined,
            },
          }),
        }),
      );
    });

    it('should include URL query parameters', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);
      window.location.search = '?currency_code=USD&timezone=UTC&country_code=US&country=United States';

      const input: ChartSummaryInput = {
        vizType: 'pie',
        title: 'Revenue Distribution',
        description: 'Revenue by region',
        dataSample: [{ region: 'North', revenue: 5000 }],
      };

      await generateSummary(input);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            chart_data: {
              vizType: 'pie',
              dataSample: [{ region: 'North', revenue: 5000 }],
              title: 'Revenue Distribution',
              description: 'Revenue by region',
              currency_code: 'USD',
              timezone: 'UTC',
              country_code: 'US',
              country: 'United States',
            },
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any);

      const input: ChartSummaryInput = {
        vizType: 'table',
        title: 'Error Test',
        description: 'This should fail',
      };

      await expect(generateSummary(input)).rejects.toThrow('AI endpoint error 500');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { result: {} } }),
      } as any);

      const input: ChartSummaryInput = {
        vizType: 'table',
        title: 'Invalid Response Test',
      };

      await expect(generateSummary(input)).rejects.toThrow('Invalid AI response');
    });

    it('should respect timeout option', async () => {
      const mockAbortController = {
        signal: { aborted: false },
        abort: jest.fn(),
      };
      jest.spyOn(global, 'AbortController').mockImplementation(() => mockAbortController as any);
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        if (delay === 5000) {
          // Call the abort function immediately for testing
          setTimeout(callback, 0);
        }
        return 123 as any;
      });

      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const input: ChartSummaryInput = {
        vizType: 'bar',
        title: 'Timeout Test',
      };

      try {
        await generateSummary(input, { timeoutMs: 5000 });
      } catch (error) {
        // Expected to throw due to abort
      }

      expect(mockAbortController.abort).toHaveBeenCalled();
    });
  });
});

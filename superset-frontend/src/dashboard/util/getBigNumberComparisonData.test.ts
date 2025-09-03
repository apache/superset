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

import { getBigNumberComparisonData } from './getBigNumberComparisonData';

// Mock console methods to avoid noise in tests
const originalConsole = console;
beforeAll(() => {
  console.group = jest.fn();
  console.log = jest.fn();
  console.groupEnd = jest.fn();
});

afterAll(() => {
  console.group = originalConsole.group;
  console.log = originalConsole.log;
  console.groupEnd = originalConsole.groupEnd;
});

describe('getBigNumberComparisonData', () => {
  describe('Input validation', () => {
    it('should return null when queriesResponse is null or undefined', () => {
      expect(getBigNumberComparisonData(null, {})).toBeNull();
      expect(getBigNumberComparisonData(undefined, {})).toBeNull();
      expect(getBigNumberComparisonData([], {})).toBeNull();
    });

    it('should return null when formData is null or undefined', () => {
      const queriesResponse = [{ data: [{ 'Gross Sale': 100 }], colnames: ['Gross Sale'] }];
      expect(getBigNumberComparisonData(queriesResponse, null)).toBeNull();
      expect(getBigNumberComparisonData(queriesResponse, undefined)).toBeNull();
    });

    it('should return null when data is empty', () => {
      const queriesResponse = [{ data: [], colnames: [] }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale' };
      expect(getBigNumberComparisonData(queriesResponse, formData)).toBeNull();
    });

    it('should return null for non-BigNumber charts', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 80 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'table', metric: 'Gross Sale', time_compare: 'inherit' };
      expect(getBigNumberComparisonData(queriesResponse, formData)).toBeNull();
    });
  });

  describe('BigNumber chart detection', () => {
    it('should process big_number_total charts', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 80 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      expect(result).not.toBeNull();
    });

    it('should process big_number charts', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 80 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      expect(result).not.toBeNull();
    });
  });

  describe('Time comparison detection', () => {
    const baseQueriesResponse = [{ 
      data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 80 }], 
      colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
    }];

    it('should detect time_compare from formData.time_compare', () => {
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: '1 day ago' };
      const result = getBigNumberComparisonData(baseQueriesResponse, formData);
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(0.25); // (100-80)/80 = 0.25
    });

    it('should detect time_compare from extra_form_data', () => {
      const formData = { 
        viz_type: 'big_number_total', 
        metric: 'Gross Sale',
        extra_form_data: { time_compare: '1 day ago' }
      };
      const result = getBigNumberComparisonData(baseQueriesResponse, formData);
      expect(result).not.toBeNull();
    });

    it('should force inherit when time offset columns exist but no time_compare', () => {
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale' };
      const result = getBigNumberComparisonData(baseQueriesResponse, formData);
      expect(result).not.toBeNull();
    });

    it('should return null when time_compare is custom', () => {
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'custom' };
      const result = getBigNumberComparisonData(baseQueriesResponse, formData);
      expect(result).toBeNull();
    });
  });

  describe('Percentage calculation', () => {
    it('should calculate positive percentage change correctly', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 120, 'Gross Sale__1 day ago': 100 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(0.2); // (120-100)/100 = 0.2
      expect(result?.comparisonIndicator).toBe('positive');
      expect(result?.currentValue).toBe(120);
      expect(result?.previousPeriodValue).toBe(100);
    });

    it('should calculate negative percentage change correctly', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 80, 'Gross Sale__1 day ago': 100 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(-0.2); // (80-100)/100 = -0.2
      expect(result?.comparisonIndicator).toBe('negative');
    });

    it('should handle neutral change (no change)', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 100 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(0);
      expect(result?.comparisonIndicator).toBe('neutral');
    });
  });

  describe('Edge cases', () => {
    it('should handle previous period value of 0 with positive current value', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': 0 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(1); // 100% change (maximum)
      expect(result?.comparisonIndicator).toBe('positive');
    });

    it('should handle current value of 0 with non-zero previous value', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 0, 'Gross Sale__1 day ago': 100 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(-1); // -100% change (complete loss)
      expect(result?.comparisonIndicator).toBe('negative');
    });

    it('should handle both values being 0', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 0, 'Gross Sale__1 day ago': 0 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.percentageChange).toBe(0);
      expect(result?.comparisonIndicator).toBe('neutral');
    });

    it('should return null when no time offset columns found', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100 }], 
        colnames: ['Gross Sale'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).toBeNull();
    });

    it('should return null when current value is null', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': null, 'Gross Sale__1 day ago': 100 }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).toBeNull();
    });

    it('should return null when previous period value is null', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': null }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).toBeNull();
    });
  });

  describe('Metric handling', () => {
    it('should handle string metric values by parsing them', () => {
      const queriesResponse = [{ 
        data: [{ 'Gross Sale': 100, 'Gross Sale__1 day ago': '80' }], 
        colnames: ['Gross Sale', 'Gross Sale__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', metric: 'Gross Sale', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.previousPeriodValue).toBe(80);
      expect(result?.percentageChange).toBe(0.25);
    });

    it('should use default metric name when not provided', () => {
      const queriesResponse = [{ 
        data: [{ 'value': 100, 'value__1 day ago': 80 }], 
        colnames: ['value', 'value__1 day ago'] 
      }];
      const formData = { viz_type: 'big_number_total', time_compare: 'inherit' };
      const result = getBigNumberComparisonData(queriesResponse, formData);
      
      expect(result).not.toBeNull();
      expect(result?.currentValue).toBe(100);
    });
  });
});

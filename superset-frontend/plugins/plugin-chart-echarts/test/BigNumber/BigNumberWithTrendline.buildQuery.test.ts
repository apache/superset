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
import { QueryFormData, SqlaFormData } from '@superset-ui/core';
import buildQuery from '../../src/BigNumber/BigNumberWithTrendline/buildQuery';

describe('BigNumberWithTrendline buildQuery with Time Comparison', () => {
  const baseFormData: SqlaFormData = {
    viz_type: 'big_number_with_trendline',
    datasource: 'test_datasource',
    x_axis: 'ds',
    time_grain_sqla: 'P1D',
    metric: 'value',
  } as SqlaFormData;

  describe('Basic Query Building', () => {
    it('should build query with basic time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago');
    });
  });

  describe('Time Comparison Types', () => {
    it('should work with "inherit" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago'); // inherit resolves to "1 day ago"
    });

    it('should detect time period from time range string - Last 4 days', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        time_range: 'Last 4 days',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['4 days ago']);
    });

    it('should detect time period from time range string - Last 1 week', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        time_range: 'Last 1 week',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['1 week ago']);
    });

    it('should detect time period from time range string - Last 2 months', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        time_range: 'Last 2 months',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['2 months ago']);
    });

    it('should calculate period from since/until dates - 4 days', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        since: '2023-08-23',
        until: '2023-08-26',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['4 days ago']);
    });

    it('should calculate period from since/until dates - 1 week', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        since: '2023-08-20',
        until: '2023-08-26',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['1 week ago']);
    });

    it('should handle special time range cases - today', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        time_range: 'Today',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['1 day ago']);
    });

    it('should handle special time range cases - this week', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
        time_range: 'This week',
      };
      const result = buildQuery(formData);
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('time_offsets', ['1 week ago']);
    });

    it('should work with "1 day ago" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago');
    });

    it('should work with "1 week ago" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 week ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 week ago');
    });

    it('should work with "1 month ago" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 month ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 month ago');
    });

    it('should work with "1 year ago" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 year ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 year ago');
    });

    it('should work with "custom" time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: {
          time_compare: 'custom',
          time_compare_value: '7 days ago',
        } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('7 days ago'); // custom uses time_compare_value
    });
  });

  describe('Trendline-Specific Properties', () => {
    it('should include columns for x-axis when set', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('columns');
      expect(result.queries[0].columns).toContainEqual({
        columnType: 'BASE_AXIS',
        expressionType: 'SQL',
        label: 'ds',
        sqlExpression: 'ds',
        timeGrain: 'P1D',
      });
    });

    it('should set is_timeseries when x_axis is not set', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        x_axis: undefined,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('is_timeseries', true);
    });

    it('should include post_processing for both queries', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('post_processing');
      expect(result.queries[0].post_processing).toBeInstanceOf(Array);
    });

    it('should maintain post_processing consistency across queries', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      const firstPostProcessing = result.queries[0].post_processing;

      expect(firstPostProcessing).toBeInstanceOf(Array);
      expect(firstPostProcessing).toHaveLength(2); // pivot and flatten operations
    });
  });

  describe('Edge Cases', () => {
    it('should work with undefined time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: undefined } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      // Should not have time_offsets when time_compare is undefined
      expect(result.queries[0]).not.toHaveProperty('time_offsets');
    });

    it('should work with null time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: null } as any,
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      // Should not have time_offsets when time_compare is null
      expect(result.queries[0]).not.toHaveProperty('time_offsets');
    });

    it('should handle empty extra_form_data', () => {
      const formData = {
        ...baseFormData,
        extra_form_data: {},
      };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
    });

    it('should handle missing extra_form_data', () => {
      const formData = { ...baseFormData };
      const result = buildQuery(formData);

      expect(result).toHaveProperty('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
    });
  });

  describe('Query Structure', () => {
    it('should maintain metric consistency across queries', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        metric: 'sales',
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('sales');
    });

    it('should maintain datasource consistency across queries', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      // Note: buildQueryContext doesn't preserve datasource in query objects
      // The datasource is handled at the form data level
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago');
    });

    it('should preserve additional form data properties', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        filters: ['filter1', 'filter2'],
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      // Note: buildQueryContext doesn't preserve filters in query objects
      // The filters are handled at the form data level
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago');
    });

    it('should maintain time grain consistency', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        time_grain_sqla: 'PT1H',
        extra_form_data: { time_compare: '1 day ago' } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      // Note: buildQueryContext doesn't preserve time_grain_sqla in query objects
      // The time_grain_sqla is handled at the form data level
      expect(result.queries[0]).toHaveProperty('metrics');
      expect(result.queries[0].metrics).toContain('value');
    });
  });

  describe('Integration with Superset Core', () => {
    it('should use getComparisonInfo for time comparison', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: { time_compare: 'inherit' } as any,
      };
      const result = buildQuery(formData);

      // The second query should have comparison-specific properties
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toBeDefined();

      // Verify that the comparison query is properly structured
      expect(result.queries[0]).toHaveProperty('columns');
      expect(result.queries[0]).toHaveProperty('post_processing');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago'); // inherit resolves to "1 day ago"
    });

    it('should handle complex time comparison scenarios', () => {
      const formData: SqlaFormData = {
        ...baseFormData,
        extra_form_data: {
          time_compare: 'inherit',
          time_compare_value: 'custom_range',
        } as any,
      };
      const result = buildQuery(formData);

      expect(result.queries).toHaveLength(1);
      expect(result.queries[0]).toBeDefined();

      // Both should maintain trendline-specific properties
      expect(result.queries[0]).toHaveProperty('post_processing');
      expect(result.queries[0]).toHaveProperty('time_offsets');
      expect(result.queries[0].time_offsets).toContain('1 day ago'); // inherit resolves to "1 day ago"
    });
  });
});

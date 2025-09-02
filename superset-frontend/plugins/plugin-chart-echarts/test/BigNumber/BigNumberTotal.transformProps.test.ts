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
  DatasourceType,
  supersetTheme,
  TimeGranularity,
  QueryFormData,
  QueryData,
} from '@superset-ui/core';
import transformProps from '../../src/BigNumber/BigNumberTotal/transformProps';
import { BigNumberVizProps } from '../../src/BigNumber/types';

const formData: QueryFormData = {
  metric: 'value',
  viz_type: 'big_number_total',
  yAxisFormat: '.3s',
  datasource: 'test_datasource',
  headerFontSize: 0.3,
  subheaderFontSize: 0.125,
  subheader: 'Test subheader',
  forceTimestampFormatting: false,
  currencyFormat: undefined,
};

function generateProps(
  data: any[],
  comparisonData: any[] = [],
  extraFormData = {},
  extraQueryData: any = {},
): any {
  const queriesData = [
    {
      data,
      colnames: ['value'],
      coltypes: ['DOUBLE'],
      ...extraQueryData,
    },
  ];

  // Add comparison data if provided - now as time-offset columns in the same query
  if (comparisonData.length > 0) {
    // Get the time comparison value from extraFormData
    const timeCompare = (extraFormData as any)?.extra_form_data?.time_compare ||
                       (extraFormData as any)?.time_compare;
    
    if (timeCompare && timeCompare !== 'NoComparison') {
      // Resolve the actual time offset string
      let resolvedTimeOffset: string;
      if (timeCompare === 'inherit') {
        resolvedTimeOffset = '1 day ago';
      } else if (timeCompare === 'custom') {
        resolvedTimeOffset = (extraFormData as any)?.time_compare_value || 'custom_range';
      } else {
        resolvedTimeOffset = timeCompare;
      }

      // Get the metric name from the formData (default to 'value' if not specified)
      const metricName = (extraFormData as any)?.metric || 'value';
      
      // Create time-offset column name using the actual metric name
      const timeOffsetColumn = `${metricName}__${resolvedTimeOffset}`;
      
      // Update the first query to include both current and comparison data
      queriesData[0] = {
        data: data.map((row, index) => ({
          ...row,
          [timeOffsetColumn]: comparisonData[index]?.[metricName] ?? null,
        })),
        colnames: [metricName, timeOffsetColumn],
        coltypes: ['DOUBLE', 'DOUBLE'],
        ...extraQueryData,
      };
    }
  }

  return {
    width: 200,
    height: 200,
    formData: { ...formData, ...extraFormData },
    queriesData,
    datasource: {
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
      verboseMap: {},
      columnFormats: {},
      currencyFormats: {},
    },
    theme: supersetTheme,
    rawFormData: { ...formData, ...extraFormData },
    hooks: {},
    initialValues: {},
  };
}

describe('BigNumberTotal transformProps with Time Comparison', () => {
  describe('Basic Functionality', () => {
    it('should transform basic props correctly without time comparison', () => {
      const props = generateProps([{ value: 1234567.89 }]);
      const result = transformProps(props);

      expect(result).toMatchObject({
        width: 200,
        height: 200,
        bigNumber: 1234567.89,
      });
    });

    it('should handle empty data gracefully', () => {
      const props = generateProps([]);
      const result = transformProps(props);

      expect(result).toMatchObject({
        width: 200,
        height: 200,
        bigNumber: null,
      });
    });
  });

  describe('Time Comparison - Positive Changes', () => {
    it('should handle 50% increase correctly', () => {
      const props = generateProps(
        [{ value: 1500 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1500,
        previousPeriodValue: 1000,
        percentageChange: 0.5, // (1500 - 1000) / 1000 = 0.5
        comparisonIndicator: 'positive',
      });
    });

    it('should handle 100% increase correctly', () => {
      const props = generateProps(
        [{ value: 2000 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 2000,
        previousPeriodValue: 1000,
        percentageChange: 1.0, // (2000 - 1000) / 1000 = 1.0
        comparisonIndicator: 'positive',
      });
    });

    it('should handle large percentage increases', () => {
      const props = generateProps(
        [{ value: 10000 }], // current period
        [{ value: 100 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 10000,
        previousPeriodValue: 100,
        percentageChange: 99, // (10000 - 100) / 100 = 99
        comparisonIndicator: 'positive',
      });
    });
  });

  describe('Time Comparison - Negative Changes', () => {
    it('should handle 20% decrease correctly', () => {
      const props = generateProps(
        [{ value: 800 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 800,
        previousPeriodValue: 1000,
        percentageChange: -0.2, // (800 - 1000) / 1000 = -0.2
        comparisonIndicator: 'negative',
      });
    });

    it('should handle 50% decrease correctly', () => {
      const props = generateProps(
        [{ value: 500 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 500,
        previousPeriodValue: 1000,
        percentageChange: -0.5, // (500 - 1000) / 1000 = -0.5
        comparisonIndicator: 'negative',
      });
    });

    it('should handle 90% decrease correctly', () => {
      const props = generateProps(
        [{ value: 100 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 100,
        previousPeriodValue: 1000,
        percentageChange: -0.9, // (100 - 1000) / 1000 = -0.9
        comparisonIndicator: 'negative',
      });
    });
  });

  describe('Time Comparison - No Change', () => {
    it('should handle no change correctly', () => {
      const props = generateProps(
        [{ value: 1000 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: 1000,
        percentageChange: 0, // (1000 - 1000) / 1000 = 0
        comparisonIndicator: 'neutral',
      });
    });

    it('should handle very small changes as neutral', () => {
      const props = generateProps(
        [{ value: 1000.001 }], // current period
        [{ value: 1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000.001,
        previousPeriodValue: 1000,
        percentageChange: 9.999999999763531e-7, // Very small change
        comparisonIndicator: 'positive',
      });
    });
  });

  describe('Time Comparison - Edge Cases', () => {
    it('should handle zero previous period value', () => {
      const props = generateProps(
        [{ value: 1000 }], // current period
        [{ value: 0 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: 0,
        percentageChange: undefined,
        comparisonIndicator: undefined,
      });
    });

    it('should handle null previous period value', () => {
      const props = generateProps(
        [{ value: 1000 }], // current period
        [{ value: null }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: null,
        percentageChange: undefined,
        comparisonIndicator: undefined,
      });
    });

    it('should handle empty comparison data', () => {
      const props = generateProps(
        [{ value: 1000 }], // current period
        [], // empty comparison data
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: null,
        percentageChange: undefined,
        comparisonIndicator: undefined,
      });
    });

    it('should handle negative values correctly', () => {
      const props = generateProps(
        [{ value: -500 }], // current period
        [{ value: -1000 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: -500,
        previousPeriodValue: -1000,
        percentageChange: 0.5, // (-500 - (-1000)) / 1000 = 0.5
        comparisonIndicator: 'positive',
      });
    });
  });

  describe('Time Comparison - Different Time Periods', () => {
    it('should work with "inherit" time comparison', () => {
      const props = generateProps(
        [{ value: 2000 }], // current period
        [{ value: 1500 }], // previous period
        { extra_form_data: { time_compare: 'inherit' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 2000,
        previousPeriodValue: 1500,
        percentageChange: 0.3333333333333333, // (2000 - 1500) / 1500
        comparisonIndicator: 'positive',
      });
    });

    it('should work with "1 week ago" time comparison', () => {
      const props = generateProps(
        [{ value: 3000 }], // current period
        [{ value: 2500 }], // previous period
        { extra_form_data: { time_compare: '1 week ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 3000,
        previousPeriodValue: 2500,
        percentageChange: 0.2, // (3000 - 2500) / 2500 = 0.2
        comparisonIndicator: 'positive',
      });
    });

    it('should work with "1 month ago" time comparison', () => {
      const props = generateProps(
        [{ value: 4000 }], // current period
        [{ value: 3500 }], // previous period
        { extra_form_data: { time_compare: '1 month ago' } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 4000,
        previousPeriodValue: 3500,
        percentageChange: 0.14285714285714285, // (4000 - 3500) / 3500
        comparisonIndicator: 'positive',
      });
    });
  });

  describe('No Time Comparison', () => {
    it('should handle no time comparison correctly', () => {
      const props = generateProps([{ value: 1000 }]);
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: null,
        percentageChange: undefined,
        comparisonIndicator: undefined,
      });
    });

    it('should handle undefined time comparison', () => {
      const props = generateProps(
        [{ value: 1000 }],
        [{ value: 800 }],
        { extra_form_data: { time_compare: undefined } }
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1000,
        previousPeriodValue: null,
        percentageChange: undefined,
        comparisonIndicator: undefined,
      });
    });
  });

  describe('Data Format Handling', () => {
    it('should handle different metric names', () => {
      const customFormData = { 
        ...formData, 
        metric: 'sales',
        extra_form_data: { time_compare: '1 day ago' }
      };
      const props = generateProps(
        [{ sales: 1500 }], // current period
        [{ sales: 1000 }], // previous period
        customFormData
      );
      const result = transformProps(props);

      expect(result).toMatchObject({
        bigNumber: 1500,
        previousPeriodValue: 1000,
        percentageChange: 0.5,
        comparisonIndicator: 'positive',
      });
    });

    it('should handle multiple data rows', () => {
      const props = generateProps(
        [{ value: 1500 }, { value: 1600 }], // current period
        [{ value: 1000 }, { value: 1100 }], // previous period
        { extra_form_data: { time_compare: '1 day ago' } }
      );
      const result = transformProps(props);

      // Should use the first row for comparison
      expect(result).toMatchObject({
        bigNumber: 1500,
        previousPeriodValue: 1000,
        percentageChange: 0.5,
        comparisonIndicator: 'positive',
      });
    });
  });
});

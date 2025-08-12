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

import { applyDatasetChartDefaults } from './hydrateExplore';

describe('applyDatasetChartDefaults', () => {
  const mockDataset = {
    metrics: [
      { metric_name: 'count', verbose_name: 'Count' },
      { metric_name: 'sum_amount', verbose_name: 'Sum Amount' },
    ],
    columns: [
      { column_name: 'year', is_dttm: true, groupby: true },
      { column_name: 'month', is_dttm: true, groupby: true },
      { column_name: 'category', is_dttm: false, groupby: true },
      { column_name: 'amount', is_dttm: false, groupby: false },
    ],
    extra: JSON.stringify({
      default_chart_metadata: {
        default_metric: 'count',
        default_dimension: 'category',
        default_temporal_column: 'year',
        default_time_grain: 'P1D',
        default_time_range: 'Last week',
        default_row_limit: 100,
        default_filters: [
          {
            expressionType: 'SIMPLE',
            subject: 'category',
            operator: 'IN',
            comparator: ['A', 'B'],
          },
        ],
      },
    }),
  };

  const baseFormData = {
    datasource: '1__table',
    viz_type: 'line',
  };

  describe('when creating a new chart', () => {
    it('applies all defaults to new chart', () => {
      // Set time_range to match the default time filter so it gets replaced
      const formDataWithDefaultTime = {
        ...baseFormData,
        time_range: 'No filter',
      };

      const result = applyDatasetChartDefaults(
        formDataWithDefaultTime,
        mockDataset,
        true,
        'No filter',
      );

      expect(result.metrics).toEqual(['count']);
      expect(result.groupby).toEqual(['category']);
      expect(result.granularity_sqla).toEqual('year');
      expect(result.time_grain_sqla).toEqual('P1D');
      expect(result.time_range).toEqual('Last week');
      expect(result.row_limit).toEqual(100);
      expect(result.adhoc_filters).toEqual([
        {
          expressionType: 'SIMPLE',
          subject: 'category',
          operator: 'IN',
          comparator: ['A', 'B'],
        },
      ]);
    });

    it('validates metric exists before applying', () => {
      const datasetWithInvalidMetric = {
        ...mockDataset,
        extra: JSON.stringify({
          default_chart_metadata: {
            default_metric: 'non_existent_metric',
          },
        }),
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithInvalidMetric,
        true,
      );

      expect(result.metrics).toBeUndefined();
    });

    it('validates dimension is groupable before applying', () => {
      const datasetWithNonGroupableDefault = {
        ...mockDataset,
        extra: JSON.stringify({
          default_chart_metadata: {
            default_dimension: 'amount', // not groupable
          },
        }),
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithNonGroupableDefault,
        true,
      );

      expect(result.groupby).toBeUndefined();
    });

    it('validates temporal column is datetime before applying', () => {
      const datasetWithNonTemporalDefault = {
        ...mockDataset,
        extra: JSON.stringify({
          default_chart_metadata: {
            default_temporal_column: 'category', // not a datetime column
          },
        }),
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithNonTemporalDefault,
        true,
      );

      expect(result.granularity_sqla).toBeUndefined();
    });

    it('does not override existing values', () => {
      const formDataWithExistingValues = {
        ...baseFormData,
        metrics: ['existing_metric'],
        groupby: ['existing_dimension'],
        granularity_sqla: 'existing_temporal',
        time_grain_sqla: 'existing_grain',
        time_range: 'existing_range',
        row_limit: 500,
        adhoc_filters: [{ existing: 'filter' }],
      };

      const result = applyDatasetChartDefaults(
        formDataWithExistingValues,
        mockDataset,
        true,
      );

      expect(result.metrics).toEqual(['existing_metric']);
      expect(result.groupby).toEqual(['existing_dimension']);
      expect(result.granularity_sqla).toEqual('existing_temporal');
      expect(result.time_grain_sqla).toEqual('existing_grain');
      expect(result.time_range).toEqual('existing_range');
      expect(result.row_limit).toEqual(500);
      expect(result.adhoc_filters).toEqual([{ existing: 'filter' }]);
    });

    it('handles time range with default time filter', () => {
      const formDataWithDefaultTime = {
        ...baseFormData,
        time_range: 'Last day',
      };

      const result = applyDatasetChartDefaults(
        formDataWithDefaultTime,
        mockDataset,
        true,
        'Last day',
      );

      // Should apply the dataset's default time range since form data matches the default
      expect(result.time_range).toEqual('Last week');
    });
  });

  describe('when editing an existing chart', () => {
    it('does not apply defaults to existing chart', () => {
      const result = applyDatasetChartDefaults(
        baseFormData,
        mockDataset,
        false, // not a new chart
      );

      expect(result).toEqual(baseFormData);
    });
  });

  describe('error handling', () => {
    it('handles malformed JSON in extra field', () => {
      const datasetWithBadJson = {
        ...mockDataset,
        extra: 'not valid json{',
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithBadJson,
        true,
      );

      expect(result).toEqual(baseFormData);
    });

    it('handles missing extra field', () => {
      const datasetWithoutExtra = {
        ...mockDataset,
        extra: null,
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithoutExtra,
        true,
      );

      expect(result).toEqual(baseFormData);
    });

    it('handles extra as object instead of string', () => {
      const datasetWithObjectExtra = {
        ...mockDataset,
        extra: {
          default_chart_metadata: {
            default_metric: 'count',
          },
        },
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithObjectExtra,
        true,
      );

      expect(result.metrics).toEqual(['count']);
    });

    it('handles missing dataset', () => {
      const result = applyDatasetChartDefaults(baseFormData, null, true);

      expect(result).toEqual(baseFormData);
    });

    it('handles dataset without columns or metrics', () => {
      const minimalDataset = {
        extra: JSON.stringify({
          default_chart_metadata: {
            default_metric: 'count',
            default_dimension: 'category',
          },
        }),
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        minimalDataset,
        true,
      );

      // Should not apply defaults since we can't validate them
      expect(result.metrics).toBeUndefined();
      expect(result.groupby).toBeUndefined();
    });
  });

  describe('filter application', () => {
    it('applies filters when no existing filters', () => {
      const result = applyDatasetChartDefaults(baseFormData, mockDataset, true);

      expect(result.adhoc_filters).toHaveLength(1);
      expect(result.adhoc_filters[0]).toMatchObject({
        expressionType: 'SIMPLE',
        subject: 'category',
      });
    });

    it('does not apply filters when existing filters present', () => {
      const formDataWithFilters = {
        ...baseFormData,
        adhoc_filters: [{ existing: 'filter' }],
      };

      const result = applyDatasetChartDefaults(
        formDataWithFilters,
        mockDataset,
        true,
      );

      expect(result.adhoc_filters).toEqual([{ existing: 'filter' }]);
    });

    it('handles empty default filters array', () => {
      const datasetWithEmptyFilters = {
        ...mockDataset,
        extra: JSON.stringify({
          default_chart_metadata: {
            default_filters: [],
          },
        }),
      };

      const result = applyDatasetChartDefaults(
        baseFormData,
        datasetWithEmptyFilters,
        true,
      );

      expect(result.adhoc_filters).toBeUndefined();
    });
  });
});

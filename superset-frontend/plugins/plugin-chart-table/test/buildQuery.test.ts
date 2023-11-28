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
import { QueryMode, TimeGranularity } from '@superset-ui/core';
import * as supersetCoreModule from '@superset-ui/core';
import buildQuery from '../src/buildQuery';
import { TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  viz_type: 'table',
  datasource: '11__table',
};

describe('plugin-chart-table', () => {
  describe('buildQuery', () => {
    it('should add post-processing and ignore duplicate metrics', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.aggregate,
        metrics: ['aaa', 'aaa'],
        percent_metrics: ['bbb', 'bbb'],
      }).queries[0];
      expect(query.metrics).toEqual(['aaa', 'bbb']);
      expect(query.post_processing).toEqual([
        {
          operation: 'contribution',
          options: {
            columns: ['bbb'],
            rename_columns: ['%bbb'],
          },
        },
      ]);
    });

    it('should not add metrics in raw records mode', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.raw,
        columns: ['a'],
        metrics: ['aaa', 'aaa'],
        percent_metrics: ['bbb', 'bbb'],
      }).queries[0];
      expect(query.metrics).toBeUndefined();
      expect(query.post_processing).toEqual([]);
    });

    it('should not add post-processing when there is no percent metric', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.aggregate,
        metrics: ['aaa'],
        percent_metrics: [],
      }).queries[0];
      expect(query.metrics).toEqual(['aaa']);
      expect(query.post_processing).toEqual([]);
    });

    it('should not add post-processing in raw records mode', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.raw,
        metrics: ['aaa'],
        columns: ['rawcol'],
        percent_metrics: ['ccc'],
      }).queries[0];
      expect(query.metrics).toBeUndefined();
      expect(query.columns).toEqual(['rawcol']);
      expect(query.post_processing).toEqual([]);
    });
    it('should prefer extra_form_data.time_grain_sqla over formData.time_grain_sqla', () => {
      Object.defineProperty(supersetCoreModule, 'hasGenericChartAxes', {
        value: true,
      });
      const query = buildQuery({
        ...basicFormData,
        groupby: ['col1'],
        query_mode: QueryMode.aggregate,
        time_grain_sqla: TimeGranularity.MONTH,
        extra_form_data: { time_grain_sqla: TimeGranularity.QUARTER },
        temporal_columns_lookup: { col1: true },
      }).queries[0];
      expect(query.columns?.[0]).toEqual({
        timeGrain: TimeGranularity.QUARTER,
        columnType: 'BASE_AXIS',
        sqlExpression: 'col1',
        label: 'col1',
        expressionType: 'SQL',
      });
    });
    it('should fallback to formData.time_grain_sqla if extra_form_data.time_grain_sqla is not set', () => {
      Object.defineProperty(supersetCoreModule, 'hasGenericChartAxes', {
        value: true,
      });
      const query = buildQuery({
        ...basicFormData,
        time_grain_sqla: TimeGranularity.MONTH,
        groupby: ['col1'],
        query_mode: QueryMode.aggregate,
        temporal_columns_lookup: { col1: true },
      }).queries[0];
      expect(query.columns?.[0]).toEqual({
        timeGrain: TimeGranularity.MONTH,
        columnType: 'BASE_AXIS',
        sqlExpression: 'col1',
        label: 'col1',
        expressionType: 'SQL',
      });
    });
  });
});

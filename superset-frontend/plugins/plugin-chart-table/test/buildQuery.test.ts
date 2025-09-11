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
import buildQuery from '../src/buildQuery';
import { TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  viz_type: 'table',
  datasource: '11__table',
};

const extraQueryFormData: TableChartFormData = {
  ...basicFormData,
  time_grain_sqla: TimeGranularity.MONTH,
  groupby: ['col1'],
  query_mode: QueryMode.Aggregate,
  show_totals: true,
  metrics: ['aaa', 'aaa'],
  adhoc_filters: [
    {
      expressionType: 'SQL',
      sqlExpression: "status IN ('In Process')",
      clause: 'WHERE',
      subject: null,
      operator: null,
      comparator: null,
      isExtra: false,
      isNew: false,
      datasourceWarning: false,
      filterOptionName: 'filter_v8m9t9oq5re_ndzk6g5am7',
    } as any,
  ],
};
describe('plugin-chart-table', () => {
  describe('buildQuery', () => {
    it('should add post-processing and ignore duplicate metrics', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.Aggregate,
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
        query_mode: QueryMode.Raw,
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
        query_mode: QueryMode.Aggregate,
        metrics: ['aaa'],
        percent_metrics: [],
      }).queries[0];
      expect(query.metrics).toEqual(['aaa']);
      expect(query.post_processing).toEqual([]);
    });

    it('should not add post-processing in raw records mode', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.Raw,
        metrics: ['aaa'],
        columns: ['rawcol'],
        percent_metrics: ['ccc'],
      }).queries[0];
      expect(query.metrics).toBeUndefined();
      expect(query.columns).toEqual(['rawcol']);
      expect(query.post_processing).toEqual([]);
    });
    it('should prefer extra_form_data.time_grain_sqla over formData.time_grain_sqla', () => {
      const query = buildQuery({
        ...basicFormData,
        groupby: ['col1'],
        query_mode: QueryMode.Aggregate,
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
      const query = buildQuery({
        ...basicFormData,
        time_grain_sqla: TimeGranularity.MONTH,
        groupby: ['col1'],
        query_mode: QueryMode.Aggregate,
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
    it('should include time_grain_sqla in extras if temporal colum is used and keep the rest', () => {
      const { queries } = buildQuery({
        ...extraQueryFormData,
        temporal_columns_lookup: { col1: true },
      });
      // Extras in regular query
      expect(queries[0].extras?.time_grain_sqla).toEqual(TimeGranularity.MONTH);
      expect(queries[0].extras?.where).toEqual("(status IN ('In Process'))");
      // Extras in summary query
      expect(queries[1].extras?.time_grain_sqla).toEqual(TimeGranularity.MONTH);
      expect(queries[1].extras?.where).toEqual("(status IN ('In Process'))");
    });
    it('should not include time_grain_sqla in extras if temporal colum is not used and keep the rest', () => {
      const { queries } = buildQuery(extraQueryFormData);
      // Extras in regular query
      expect(queries[0].extras?.time_grain_sqla).toBeUndefined();
      expect(queries[0].extras?.where).toEqual("(status IN ('In Process'))");
      // Extras in summary query
      expect(queries[1].extras?.time_grain_sqla).toBeUndefined();
      expect(queries[1].extras?.where).toEqual("(status IN ('In Process'))");
    });
  });
});

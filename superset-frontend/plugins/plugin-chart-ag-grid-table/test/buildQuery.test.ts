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
import { AdhocColumn, QueryMode, VizType } from '@superset-ui/core';
import buildQuery from '../src/buildQuery';
import { TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  viz_type: VizType.Table,
  datasource: '11__table',
  query_mode: QueryMode.Aggregate,
  groupby: ['state'],
  metrics: ['count'],
};

const createAdhocColumn = (
  sqlExpression: string,
  label: string,
): AdhocColumn => ({
  sqlExpression,
  label,
  expressionType: 'SQL',
});

describe('plugin-chart-ag-grid-table', () => {
  describe('buildQuery - sort mapping for server pagination', () => {
    it('should map string column colId to backend identifier', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
        },
        {
          ownState: {
            sortBy: [{ key: 'state', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['state', true]]);
    });

    it('should map AdhocColumn colId by sqlExpression', () => {
      const adhocColumn = createAdhocColumn('degree_type', 'Highest Degree');

      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
          groupby: [adhocColumn],
        },
        {
          ownState: {
            sortBy: [{ key: 'degree_type', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['degree_type', true]]);
    });

    it('should map AdhocColumn colId by label', () => {
      const adhocColumn = createAdhocColumn('degree_type', 'Highest Degree');

      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
          groupby: [adhocColumn],
        },
        {
          ownState: {
            sortBy: [{ key: 'Highest Degree', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['degree_type', true]]);
    });

    it('should map string metric colId to backend identifier', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
          metrics: ['SUM(revenue)'],
        },
        {
          ownState: {
            sortBy: [{ key: 'SUM(revenue)', desc: true }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['SUM(revenue)', false]]);
    });

    it('should map percent metric with % prefix', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
          metrics: ['revenue'],
          percent_metrics: ['revenue'],
        },
        {
          ownState: {
            sortBy: [{ key: '%revenue', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['revenue', true]]);
    });

    it('should handle desc sort direction correctly', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
        },
        {
          ownState: {
            sortBy: [{ key: 'state', desc: true }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['state', false]]);
    });
  });

  describe('buildQuery - CSV export with sortModel', () => {
    it('should use sortModel for download queries', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
        },
        {
          ownState: {
            sortModel: [{ colId: 'state', sort: 'asc' }],
            sortBy: [{ key: 'other', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([
        ['state', true],
        ['count', false],
      ]);
    });

    it('should map sortModel with desc direction', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
        },
        {
          ownState: {
            sortModel: [{ colId: 'state', sort: 'desc' }],
          },
        },
      ).queries[0];

      expect(query.orderby?.[0]).toEqual(['state', false]);
    });

    it('should handle multi-column sort from sortModel', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', 'city'],
          result_format: 'csv',
        },
        {
          ownState: {
            sortModel: [
              { colId: 'state', sort: 'asc', sortIndex: 0 },
              { colId: 'city', sort: 'desc', sortIndex: 1 },
            ],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([
        ['state', true],
        ['city', false],
      ]);
    });
  });

  describe('buildQuery - stable sort tie-breaker', () => {
    it('should add default orderby as tie-breaker for single-column CSV export', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
          metrics: ['count'],
        },
        {
          ownState: {
            sortModel: [{ colId: 'state', sort: 'asc' }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([
        ['state', true],
        ['count', false],
      ]);
    });

    it('should not add tie-breaker if primary sort matches default orderby', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
          metrics: ['count'],
        },
        {
          ownState: {
            sortModel: [{ colId: 'count', sort: 'desc' }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['count', false]]);
    });

    it('should not add tie-breaker for multi-column sorts', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', 'city'],
          result_format: 'csv',
        },
        {
          ownState: {
            sortModel: [
              { colId: 'state', sort: 'asc' },
              { colId: 'city', sort: 'desc' },
            ],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([
        ['state', true],
        ['city', false],
      ]);
    });

    it('should not add tie-breaker for non-download queries with server pagination', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          server_pagination: true,
        },
        {
          ownState: {
            sortBy: [{ key: 'state', desc: false }],
          },
        },
      ).queries[0];

      expect(query.orderby).toEqual([['state', true]]);
    });
  });

  describe('buildQuery - filter handling for CSV export', () => {
    it('should apply AG Grid filters for download queries', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
        },
        {
          ownState: {
            filters: [
              {
                col: 'state',
                op: 'IN',
                val: ['CA', 'NY'],
              },
            ],
          },
        },
      ).queries[0];

      expect(query.filters).toContainEqual({
        col: 'state',
        op: 'IN',
        val: ['CA', 'NY'],
      });
    });

    it('should append AG Grid filters to existing filters', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
          adhoc_filters: [
            {
              expressionType: 'SIMPLE',
              subject: 'country',
              operator: '==',
              comparator: 'USA',
              clause: 'WHERE',
            },
          ],
        },
        {
          ownState: {
            filters: [
              {
                col: 'state',
                op: 'IN',
                val: ['CA', 'NY'],
              },
            ],
          },
        },
      ).queries[0];

      expect(query.filters?.length).toBeGreaterThan(1);
      expect(query.filters).toContainEqual({
        col: 'state',
        op: 'IN',
        val: ['CA', 'NY'],
      });
    });

    it('should not apply filters for non-download queries', () => {
      const query = buildQuery(basicFormData, {
        ownState: {
          filters: [
            {
              col: 'state',
              op: 'IN',
              val: ['CA', 'NY'],
            },
          ],
        },
      }).queries[0];

      expect(query.filters).not.toContainEqual({
        col: 'state',
        op: 'IN',
        val: ['CA', 'NY'],
      });
    });

    it('should handle empty filters array', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          result_format: 'csv',
        },
        {
          ownState: {
            filters: [],
          },
        },
      ).queries[0];

      expect(query.filters).toBeDefined();
    });
  });

  describe('buildQuery - column reordering for CSV export', () => {
    it('should reorder columns based on columnOrder', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', 'city', 'country'],
          result_format: 'csv',
        },
        {
          ownState: {
            columnOrder: ['city', 'country', 'state', 'count'],
          },
        },
      ).queries[0];

      expect(query.columns).toEqual(['city', 'country', 'state']);
    });

    it('should reorder metrics based on columnOrder', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          metrics: ['count', 'revenue', 'profit'],
          result_format: 'csv',
        },
        {
          ownState: {
            columnOrder: ['state', 'profit', 'count', 'revenue'],
          },
        },
      ).queries[0];

      expect(query.metrics).toEqual(['profit', 'count', 'revenue']);
    });

    it('should preserve unmatched columns at the end', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', 'city', 'country'],
          result_format: 'csv',
        },
        {
          ownState: {
            columnOrder: ['city'],
          },
        },
      ).queries[0];

      expect(query.columns?.[0]).toEqual('city');
      expect(query.columns).toContain('state');
      expect(query.columns).toContain('country');
    });

    it('should match AdhocColumn by sqlExpression in columnOrder', () => {
      const adhocColumn = createAdhocColumn('degree_type', 'Highest Degree');

      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', adhocColumn],
          result_format: 'csv',
        },
        {
          ownState: {
            columnOrder: ['degree_type', 'state'],
          },
        },
      ).queries[0];

      expect(query.columns?.[0]).toMatchObject({
        sqlExpression: 'degree_type',
      });
    });

    it('should not reorder for non-download queries', () => {
      const query = buildQuery(
        {
          ...basicFormData,
          groupby: ['state', 'city'],
        },
        {
          ownState: {
            columnOrder: ['city', 'state'],
          },
        },
      ).queries[0];

      expect(query.columns).toEqual(['state', 'city']);
    });
  });

  describe('buildQuery - metrics handling in different query modes', () => {
    test('should not include metrics in raw records mode', () => {
      const query = buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Raw,
        all_columns: ['state', 'city'],
      }).queries[0];

      expect(query.metrics).toBeUndefined();
    });

    test('should set metrics to empty array in aggregate mode when no metrics specified', () => {
      const query = buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Aggregate,
        groupby: ['state'],
      }).queries[0];

      expect(query.metrics).toEqual([]);
    });
  });
});

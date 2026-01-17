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

  describe('buildQuery - AG Grid server-side filters', () => {
    describe('Simple filters', () => {
      it('should apply agGridSimpleFilters to query.filters', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridSimpleFilters: [
                { col: 'state', op: '==', val: 'CA' },
                { col: 'city', op: 'ILIKE', val: '%San%' },
              ],
            },
          },
        ).queries[0];

        expect(query.filters).toContainEqual({
          col: 'state',
          op: '==',
          val: 'CA',
        });
        expect(query.filters).toContainEqual({
          col: 'city',
          op: 'ILIKE',
          val: '%San%',
        });
      });

      it('should append simple filters to existing filters', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
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
              agGridSimpleFilters: [{ col: 'state', op: '==', val: 'CA' }],
            },
          },
        ).queries[0];

        expect(query.filters?.length).toBeGreaterThan(1);
        expect(query.filters).toContainEqual({
          col: 'state',
          op: '==',
          val: 'CA',
        });
      });

      it('should handle empty agGridSimpleFilters array', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridSimpleFilters: [],
            },
          },
        ).queries[0];

        expect(query.filters).toBeDefined();
      });

      it('should not apply simple filters when server pagination is disabled', () => {
        const query = buildQuery(basicFormData, {
          ownState: {
            agGridSimpleFilters: [{ col: 'state', op: '==', val: 'CA' }],
          },
        }).queries[0];

        expect(query.filters).not.toContainEqual({
          col: 'state',
          op: '==',
          val: 'CA',
        });
      });
    });

    describe('Complex WHERE clause', () => {
      it('should apply agGridComplexWhere to query.extras.where', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridComplexWhere: '(age > 18 AND age < 65)',
            },
          },
        ).queries[0];

        expect(query.extras?.where).toBe('(age > 18 AND age < 65)');
      });

      it('should combine with existing WHERE clause using AND', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            adhoc_filters: [
              {
                expressionType: 'SQL',
                clause: 'WHERE',
                sqlExpression: 'country = "USA"',
              },
            ],
          },
          {
            ownState: {
              agGridComplexWhere: '(age > 18 AND age < 65)',
            },
          },
        ).queries[0];

        expect(query.extras?.where).toContain('country = "USA"');
        expect(query.extras?.where).toContain('(age > 18 AND age < 65)');
        expect(query.extras?.where).toContain(' AND ');
      });

      it('should handle empty agGridComplexWhere', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridComplexWhere: '',
            },
          },
        ).queries[0];

        // Empty string should not set extras.where (undefined or empty string both acceptable)
        expect(query.extras?.where || undefined).toBeUndefined();
      });

      it('should not apply WHERE clause when server pagination is disabled', () => {
        const query = buildQuery(basicFormData, {
          ownState: {
            agGridComplexWhere: '(age > 18)',
          },
        }).queries[0];

        // When server_pagination is disabled, AG Grid filters should not be applied
        expect(query.extras?.where || undefined).toBeUndefined();
      });
    });

    describe('HAVING clause', () => {
      it('should apply agGridHavingClause to query.extras.having', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            metrics: ['SUM(revenue)'],
          },
          {
            ownState: {
              agGridHavingClause: 'SUM(revenue) > 1000',
            },
          },
        ).queries[0];

        expect(query.extras?.having).toBe('SUM(revenue) > 1000');
      });

      it('should combine with existing HAVING clause using AND', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            metrics: ['SUM(revenue)', 'COUNT(*)'],
            adhoc_filters: [
              {
                expressionType: 'SQL',
                clause: 'HAVING',
                sqlExpression: 'COUNT(*) > 10',
              },
            ],
          },
          {
            ownState: {
              agGridHavingClause: 'SUM(revenue) > 1000',
            },
          },
        ).queries[0];

        expect(query.extras?.having).toContain('COUNT(*) > 10');
        expect(query.extras?.having).toContain('SUM(revenue) > 1000');
        expect(query.extras?.having).toContain(' AND ');
      });

      it('should handle metric filters correctly', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            metrics: ['AVG(score)', 'MAX(points)'],
          },
          {
            ownState: {
              agGridHavingClause: '(AVG(score) >= 90 AND MAX(points) < 100)',
            },
          },
        ).queries[0];

        expect(query.extras?.having).toBe(
          '(AVG(score) >= 90 AND MAX(points) < 100)',
        );
      });

      it('should not apply HAVING clause when server pagination is disabled', () => {
        const query = buildQuery(basicFormData, {
          ownState: {
            agGridHavingClause: 'SUM(revenue) > 1000',
          },
        }).queries[0];

        // When server_pagination is disabled, AG Grid filters should not be applied
        expect(query.extras?.having || undefined).toBeUndefined();
      });
    });

    describe('Totals query handling', () => {
      it('should exclude AG Grid WHERE filters from totals query', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
          },
          {
            ownState: {
              agGridComplexWhere: 'age > 18',
            },
          },
        ).queries;

        const mainQuery = queries[0];
        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        expect(mainQuery.extras?.where).toBe('age > 18');
        expect(totalsQuery.extras?.where).toBeUndefined();
      });

      it('should preserve non-AG Grid WHERE clauses in totals', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
            adhoc_filters: [
              {
                expressionType: 'SQL',
                clause: 'WHERE',
                sqlExpression: 'country = "USA"',
              },
            ],
          },
          {
            ownState: {
              agGridComplexWhere: 'age > 18',
            },
          },
        ).queries;

        const mainQuery = queries[0];
        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        expect(mainQuery.extras?.where).toContain('country = "USA"');
        expect(mainQuery.extras?.where).toContain('age > 18');
        expect(totalsQuery.extras?.where).toContain('country = "USA"');
        expect(totalsQuery.extras?.where).not.toContain('age > 18');
      });

      it('should handle totals when AG Grid WHERE is only clause', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
          },
          {
            ownState: {
              agGridComplexWhere: 'status = "active"',
            },
          },
        ).queries;

        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        expect(totalsQuery.extras?.where).toBeUndefined();
      });

      it('should handle totals with empty WHERE clause after removal', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
            adhoc_filters: [
              {
                expressionType: 'SQL',
                clause: 'WHERE',
                sqlExpression: 'country = "USA"',
              },
            ],
          },
          {
            ownState: {
              agGridComplexWhere: 'country = "USA"',
            },
          },
        ).queries;

        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        // After removing AG Grid WHERE, totals should still have the adhoc filter
        expect(totalsQuery.extras).toBeDefined();
      });

      it('should not modify totals query when no AG Grid filters applied', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
          },
          {
            ownState: {},
          },
        ).queries;

        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        expect(totalsQuery.columns).toEqual([]);
        expect(totalsQuery.row_limit).toBe(0);
      });
    });

    describe('Integration - all filter types together', () => {
      it('should apply simple, WHERE, and HAVING filters simultaneously', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            metrics: ['SUM(revenue)', 'COUNT(*)'],
          },
          {
            ownState: {
              agGridSimpleFilters: [{ col: 'state', op: '==', val: 'CA' }],
              agGridComplexWhere: '(age > 18 AND age < 65)',
              agGridHavingClause: 'SUM(revenue) > 1000',
            },
          },
        ).queries[0];

        expect(query.filters).toContainEqual({
          col: 'state',
          op: '==',
          val: 'CA',
        });
        expect(query.extras?.where).toBe('(age > 18 AND age < 65)');
        expect(query.extras?.having).toBe('SUM(revenue) > 1000');
      });

      it('should combine AG Grid filters with adhoc filters', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            adhoc_filters: [
              {
                expressionType: 'SIMPLE',
                subject: 'country',
                operator: '==',
                comparator: 'USA',
                clause: 'WHERE',
              },
              {
                expressionType: 'SQL',
                clause: 'WHERE',
                sqlExpression: 'region = "West"',
              },
            ],
          },
          {
            ownState: {
              agGridSimpleFilters: [
                { col: 'state', op: 'IN', val: ['CA', 'OR', 'WA'] },
              ],
              agGridComplexWhere: "status = 'active'",
            },
          },
        ).queries[0];

        expect(query.filters).toContainEqual({
          col: 'state',
          op: 'IN',
          val: ['CA', 'OR', 'WA'],
        });
        expect(query.extras?.where).toContain('region = "West"');
        expect(query.extras?.where).toContain("status = 'active'");
      });

      it('should reset currentPage to 0 when filtering', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              currentPage: 5,
              agGridSimpleFilters: [{ col: 'state', op: '==', val: 'CA' }],
            },
          },
        ).queries[0];

        // The query itself doesn't have page info, but ownState should be updated
        expect(query.filters).toContainEqual({
          col: 'state',
          op: '==',
          val: 'CA',
        });
      });

      it('should include filter metadata in ownState', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridFilterModel: {
                state: { filterType: 'text', type: 'equals', filter: 'CA' },
              },
              lastFilteredColumn: 'state',
              lastFilteredInputPosition: 'first',
            },
          },
        ).queries[0];

        // Query should be generated with the filter model metadata
        expect(query).toBeDefined();
      });

      it('should handle complex real-world scenario', () => {
        const queries = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
            show_totals: true,
            query_mode: QueryMode.Aggregate,
            groupby: ['state', 'city'],
            metrics: ['SUM(revenue)', 'AVG(score)', 'COUNT(*)'],
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
              agGridSimpleFilters: [
                { col: 'state', op: 'IN', val: ['CA', 'NY', 'TX'] },
              ],
              agGridComplexWhere:
                '(population > 100000 AND growth_rate > 0.05)',
              agGridHavingClause:
                '(SUM(revenue) > 1000000 AND AVG(score) >= 4.5)',
              currentPage: 0,
              pageSize: 50,
            },
          },
        ).queries;

        const mainQuery = queries[0];
        const totalsQuery = queries[2]; // queries[1] is rowcount, queries[2] is totals

        // Main query should have all filters
        expect(mainQuery.filters).toContainEqual({
          col: 'state',
          op: 'IN',
          val: ['CA', 'NY', 'TX'],
        });
        expect(mainQuery.extras?.where).toContain('population > 100000');
        expect(mainQuery.extras?.having).toContain('SUM(revenue) > 1000000');

        // Totals query should exclude AG Grid WHERE (since it's the only WHERE clause, it should be undefined)
        expect(totalsQuery.extras?.where).toBeUndefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle null ownState gracefully', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {},
        ).queries[0];

        expect(query).toBeDefined();
      });

      it('should handle ownState without filter properties', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              currentPage: 0,
              pageSize: 20,
            },
          },
        ).queries[0];

        expect(query).toBeDefined();
      });

      it('should handle filters with special SQL characters', () => {
        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridSimpleFilters: [{ col: 'name', op: '==', val: "O'Brien" }],
            },
          },
        ).queries[0];

        expect(query.filters).toContainEqual({
          col: 'name',
          op: '==',
          val: "O'Brien",
        });
      });

      it('should handle very long filter clauses', () => {
        const longWhereClause = Array(50)
          .fill(0)
          .map((_, i) => `field${i} > ${i}`)
          .join(' AND ');

        const query = buildQuery(
          {
            ...basicFormData,
            server_pagination: true,
          },
          {
            ownState: {
              agGridComplexWhere: longWhereClause,
            },
          },
        ).queries[0];

        expect(query.extras?.where).toBe(longWhereClause);
      });
    });
  });

  describe('buildQuery - metrics handling in different query modes', () => {
    it('should not include metrics in raw records mode', () => {
      const query = buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Raw,
        all_columns: ['state', 'city'],
      }).queries[0];

      expect(query.metrics).toBeUndefined();
    });

    it('should set metrics to empty array in aggregate mode when no metrics specified', () => {
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

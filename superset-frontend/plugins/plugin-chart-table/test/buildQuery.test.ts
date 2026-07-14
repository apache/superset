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
import { QueryMode, TimeGranularity, VizType } from '@superset-ui/core';
import buildQuery, {
  buildQuery as buildQueryUncached,
} from '../src/buildQuery';
import { TableChartFormData } from '../src/types';

const basicFormData: TableChartFormData = {
  viz_type: VizType.Table,
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
    test('should add post-processing and ignore duplicate metrics', () => {
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

    test('should not add metrics in raw records mode', () => {
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

    test('should not add post-processing when there is no percent metric', () => {
      const query = buildQuery({
        ...basicFormData,
        query_mode: QueryMode.Aggregate,
        metrics: ['aaa'],
        percent_metrics: [],
      }).queries[0];
      expect(query.metrics).toEqual(['aaa']);
      expect(query.post_processing).toEqual([]);
    });

    test('should not add post-processing in raw records mode', () => {
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
    test('should prefer extra_form_data.time_grain_sqla over formData.time_grain_sqla', () => {
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
    test('should fallback to formData.time_grain_sqla if extra_form_data.time_grain_sqla is not set', () => {
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
    test('should include time_grain_sqla in extras if temporal colum is used and keep the rest', () => {
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

    describe('Percent Metric Calculation Modes', () => {
      const baseFormDataWithPercents: TableChartFormData = {
        ...basicFormData,
        query_mode: QueryMode.Aggregate,
        metrics: ['count'],
        percent_metrics: ['sum_sales'],
        groupby: ['category'],
      };

      test('should default to row_limit mode with single query', () => {
        const { queries } = buildQuery(baseFormDataWithPercents);

        expect(queries).toHaveLength(1);
        expect(queries[0].metrics).toEqual(['count', 'sum_sales']);
        expect(queries[0].post_processing).toEqual([
          {
            operation: 'contribution',
            options: {
              columns: ['sum_sales'],
              rename_columns: ['%sum_sales'],
            },
          },
        ]);
      });

      test('should create extra query in all_records mode', () => {
        const formData = {
          ...baseFormDataWithPercents,
          percent_metric_calculation: 'all_records',
        };

        const { queries } = buildQuery(formData);

        expect(queries).toHaveLength(2);

        expect(queries[0].post_processing).toEqual([
          {
            operation: 'contribution',
            options: {
              columns: ['sum_sales'],
              rename_columns: ['%sum_sales'],
            },
          },
        ]);

        expect(queries[1]).toMatchObject({
          columns: [],
          metrics: ['sum_sales'],
          post_processing: [],
          row_limit: 0,
          row_offset: 0,
          orderby: [],
          is_timeseries: false,
        });
      });

      test('should work with show_totals in all_records mode', () => {
        const formData = {
          ...baseFormDataWithPercents,
          percent_metric_calculation: 'all_records',
          show_totals: true,
        };

        const { queries } = buildQuery(formData);

        expect(queries).toHaveLength(3);
        expect(queries[1].metrics).toEqual(['sum_sales']);
        expect(queries[2].metrics).toEqual(['count', 'sum_sales']);
      });

      test('should handle empty percent_metrics in all_records mode', () => {
        const formData = {
          ...basicFormData,
          query_mode: QueryMode.Aggregate,
          metrics: ['count'],
          percent_metrics: [],
          percent_metric_calculation: 'all_records',
          groupby: ['category'],
        };

        const { queries } = buildQuery(formData);

        expect(queries).toHaveLength(1);
        expect(queries[0].post_processing).toEqual([]);
      });

      test('should reapply contribution op to totals query in row_limit mode', () => {
        // Regression test for #37627: with a percent metric and Show Summary
        // (show_totals) enabled, the totals query must rename percent-metric
        // columns (`metric` -> `%metric`) so the footer can look them up.
        // Otherwise the totals row renders 0.000%.
        const formData = {
          ...baseFormDataWithPercents,
          show_totals: true,
        };

        const { queries } = buildQuery(formData);

        // row_limit mode + show_totals -> [main, totals].
        expect(queries).toHaveLength(2);

        const contributionRule = {
          operation: 'contribution',
          options: {
            columns: ['sum_sales'],
            rename_columns: ['%sum_sales'],
          },
        };

        expect(queries[1]).toMatchObject({
          columns: [],
          post_processing: [contributionRule],
        });
      });

      test('should omit time-comparison op from totals post_processing', () => {
        // The totals query must reuse ONLY the contribution rule; the
        // time-comparison operator from the main query must not run against
        // the single-row totals query.
        const formData = {
          ...baseFormDataWithPercents,
          show_totals: true,
          time_compare: ['1 year ago'],
          comparison_type: 'values',
        };

        const { queries } = buildQuery(formData);

        // row_limit mode + show_totals -> [main, totals].
        expect(queries).toHaveLength(2);

        const totalsQuery = queries[1];

        // Exactly one op (contribution) — the time-comparison operator from the
        // main query must not be carried over to the single-row totals query.
        expect(totalsQuery.post_processing).toHaveLength(1);
        expect(totalsQuery.post_processing?.[0]).toMatchObject({
          operation: 'contribution',
        });
        // The reused rule matches the main query's contribution rule verbatim.
        expect(totalsQuery.post_processing?.[0]).toEqual(
          queries[0].post_processing?.find(
            op => op?.operation === 'contribution',
          ),
        );
      });

      test('should leave totals post_processing empty without percent metrics', () => {
        const formData = {
          ...basicFormData,
          query_mode: QueryMode.Aggregate,
          metrics: ['count'],
          percent_metrics: [],
          groupby: ['category'],
          show_totals: true,
        };

        const { queries } = buildQuery(formData);

        expect(queries).toHaveLength(2);
        expect(queries[1].post_processing).toEqual([]);
      });
    });

    describe('Testing for server pagination with search filter', () => {
      const baseFormDataWithServerPagination: TableChartFormData = {
        ...basicFormData,
        query_mode: QueryMode.Aggregate,
        metrics: ['count'],
        server_pagination: true,
        search_filter: 'A',
        groupby: ['category'],
      };

      const ownState = {
        searchText: 'A',
        searchColumn: 'category',
      };

      test('includes search filter in query payload when server pagination is enabled', () => {
        const { queries } = buildQuery(baseFormDataWithServerPagination, {
          ownState,
        });

        expect(queries[0].filters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              col: `${ownState.searchColumn}`,
              op: 'ILIKE',
              val: `${ownState.searchText}%`,
            }),
          ]),
        );
      });

      test('does not include search filter when not provided', () => {
        const { queries } = buildQuery(
          {
            ...baseFormDataWithServerPagination,
            server_pagination: false,
          },
          { ownState },
        );

        expect(queries[0].filters?.some(f => f.op === 'ILIKE')).toBeFalsy();
      });

      test('uses user row limit when it is lower than server page size', () => {
        const { queries } = buildQuery(
          {
            ...baseFormDataWithServerPagination,
            row_limit: 10,
            server_page_length: 20,
            slice_id: 101,
          },
          {
            ownState: {
              currentPage: 0,
              pageSize: 20,
            },
          },
        );

        expect(queries[0]).toMatchObject({
          row_limit: 10,
          row_offset: 0,
        });
      });

      test('limits server page size by remaining rows inside user row limit', () => {
        const { queries } = buildQuery(
          {
            ...baseFormDataWithServerPagination,
            row_limit: 120,
            server_page_length: 50,
            slice_id: 102,
          },
          {
            ownState: {
              currentPage: 2,
              pageSize: 50,
              sortBy: [{ key: 'category', desc: true }],
            },
          },
        );

        expect(queries[0]).toMatchObject({
          orderby: [['category', false]],
          row_limit: 20,
          row_offset: 100,
        });
        expect(queries[1]).toMatchObject({
          is_rowcount: true,
          row_limit: 120,
          row_offset: 0,
        });
      });

      test('clamps pages beyond the row limit instead of emitting row_limit: 0', () => {
        const { queries } = buildQuery(
          {
            ...baseFormDataWithServerPagination,
            row_limit: 120,
            server_page_length: 50,
            slice_id: 103,
          },
          {
            ownState: {
              // Page 5 is well past the cap; offset would be 250 > 120, which
              // previously made row_limit collapse to 0 ("no limit").
              currentPage: 5,
              pageSize: 50,
            },
          },
        );

        expect(queries[0].row_limit).not.toBe(0);
        expect(queries[0]).toMatchObject({
          row_limit: 20,
          row_offset: 100,
        });
      });

      test('restores the full first-page row limit after a filter change reset', () => {
        // Uncached export lets us seed cachedChanges directly; the default
        // export overrides extras with its own closure.
        const { queries } = buildQueryUncached(
          {
            ...baseFormDataWithServerPagination,
            row_limit: 120,
            server_page_length: 50,
            slice_id: 104,
          },
          {
            // User was on the capped last page (row_limit would be 20)...
            ownState: {
              currentPage: 2,
              pageSize: 50,
            },
            // ...then an external filter changed, so the cached filters differ
            // from the current ones and pagination resets to page 0.
            extras: {
              cachedChanges: {
                104: [{ col: 'category', op: '==', val: 'previous' }],
              },
            },
          },
        );

        expect(queries[0].row_limit).not.toBe(0);
        expect(queries[0]).toMatchObject({
          row_limit: 50,
          row_offset: 0,
        });
      });

      test('persists the user page size, not the capped limit, on filter reset', () => {
        const setDataMask = jest.fn();
        buildQueryUncached(
          {
            ...baseFormDataWithServerPagination,
            row_limit: 120,
            server_page_length: 50,
            slice_id: 106,
          },
          {
            // On the capped last page, the per-request row_limit is 20.
            ownState: {
              currentPage: 2,
              pageSize: 50,
            },
            extras: {
              cachedChanges: {
                106: [{ col: 'category', op: '==', val: 'previous' }],
              },
            },
            hooks: { setDataMask, setCachedChanges: jest.fn() },
          },
        );

        // The persisted page size must stay 50, not collapse to the capped 20.
        expect(setDataMask).toHaveBeenCalledWith(
          expect.objectContaining({
            ownState: expect.objectContaining({
              currentPage: 0,
              pageSize: 50,
            }),
          }),
        );
      });

      test('falls back to the page size when no row limit is configured', () => {
        const { queries } = buildQuery(
          {
            ...baseFormDataWithServerPagination,
            row_limit: undefined,
            server_page_length: 50,
            slice_id: 105,
          },
          {
            ownState: {
              currentPage: 3,
              pageSize: 50,
            },
          },
        );

        expect(queries[0]).toMatchObject({
          row_limit: 50,
          row_offset: 150,
        });
      });
    });
  });
});

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
/**
 * Unit tests for Table Chart's buildQuery logic
 * Refactored for readability and maintainability
 */

import { QueryMode } from '@superset-ui/core';
import buildQuery, { getQueryMode, cachedBuildQuery } from './buildQuery';
import { TableChartFormData } from './types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  buildQueryContext: jest.fn((formData, callback) => {
    const baseQueryObject = {
      datasource: formData.datasource,
      metrics: formData.metrics || [],
      columns: formData.columns || [],
      filters: formData.filters || [],
      extras: {},
      orderby: [],
    };

    const result = callback(baseQueryObject);

    if (Array.isArray(result)) {
      return { queries: result };
    }

    return { queries: [result] };
  }),
  ensureIsArray: jest.fn(value =>
    Array.isArray(value) ? value : value ? [value] : [],
  ),
  getMetricLabel: jest.fn(metric =>
    typeof metric === 'string' ? metric : metric.label,
  ),
  isPhysicalColumn: jest.fn(col => typeof col === 'string'),
  removeDuplicates: jest.fn(<T>(arr: T[], fn?: (item: T) => any): T[] => {
    if (fn) {
      return arr.filter(
        (item, index, self) =>
          index === self.findIndex(t => fn(t) === fn(item)),
      );
    }
    return Array.from(new Set(arr));
  }),
  QueryMode: {
    Aggregate: 'aggregate',
    Raw: 'raw',
  },
}));

jest.mock('@superset-ui/chart-controls', () => ({
  isTimeComparison: jest.fn(() => false),
  timeCompareOperator: jest.fn(() => ({ operation: 'timeCompare' })),
}));

jest.mock('./DataTable/utils/externalAPIs', () => ({
  updateTableOwnState: jest.fn(),
}));

const baseFormData: TableChartFormData = {
  datasource: '1__table',
  viz_type: 'table',
  metrics: ['count'],
  columns: ['category'],
  slice_id: 123,
};

beforeEach(() => jest.clearAllMocks());

describe('getQueryMode', () => {
  it.each([
    [{ query_mode: QueryMode.Raw }, QueryMode.Raw],
    [{ query_mode: QueryMode.Aggregate }, QueryMode.Aggregate],
    [{ all_columns: ['col1'] }, QueryMode.Raw],
    [{ all_columns: [] }, QueryMode.Aggregate],
    [{}, QueryMode.Aggregate],
  ])('returns correct mode for %p', (input, expected) => {
    expect(getQueryMode({ ...baseFormData, ...input })).toBe(expected);
  });
});

describe('Aggregate Query', () => {
  it('uses correct metrics and columns', () => {
    const { queries } = buildQuery(baseFormData);
    expect(queries[0].metrics).toEqual(['count']);
    expect(queries[0].columns).toEqual(['category']);
  });

  it('adds default orderby if none provided', () => {
    const { queries } = buildQuery(baseFormData);
    expect(queries[0].orderby).toEqual([['count', false]]);
  });

  it('uses timeseries_limit_metric for ordering if provided', () => {
    const formData = {
      ...baseFormData,
      timeseries_limit_metric: 'sum_metric',
      order_desc: true,
    };
    const { queries } = buildQuery(formData);
    expect(queries[0].orderby).toEqual([['sum_metric', false]]);
  });

  it('adds contribution post-processing for percent_metrics', () => {
    const formData = { ...baseFormData, percent_metrics: ['count'] };
    const { queries } = buildQuery(formData);
    expect(queries[0].post_processing).toContainEqual({
      operation: 'contribution',
      options: { columns: ['count'], rename_columns: ['%count'] },
    });
  });
});

describe('Extra Queries', () => {
  it('adds totals query if show_totals is enabled', () => {
    const formData = { ...baseFormData, show_totals: true };
    const { queries } = buildQuery(formData);
    expect(queries.length).toBeGreaterThan(1);
    expect(queries[1].post_processing).toEqual([]);
  });

  it('adds extra query for all_records percent_metrics', () => {
    const formData = {
      ...baseFormData,
      percent_metrics: ['count'],
      percent_metric_calculation: 'all_records',
    };
    const { queries } = buildQuery(formData);
    expect(queries.length).toBeGreaterThan(1);
    expect(queries[1].metrics).toEqual(['count']);
  });
});

describe('Server Pagination', () => {
  it('uses pageSize and currentPage from ownState', () => {
    const formData = { ...baseFormData, server_pagination: true };
    const { queries } = buildQuery(formData, {
      ownState: { pageSize: 10, currentPage: 2 },
    });
    expect(queries[0].row_limit).toBe(10);
    expect(queries[0].row_offset).toBe(20);
  });

  it('adds row count query', () => {
    const formData = {
      ...baseFormData,
      server_pagination: true,
      row_limit: 100,
    };
    const { queries } = buildQuery(formData);
    expect(queries.some(q => q.is_rowcount)).toBe(true);
  });
});

describe('cachedBuildQuery', () => {
  it('generates valid buildQuery with cache', () => {
    const cached = cachedBuildQuery();
    const { queries } = cached(baseFormData);
    expect(queries).toBeDefined();
  });
});

describe('Percent metric calculation mode', () => {
  it('adds only one query in "row_limit" mode', () => {
    const formData = {
      ...baseFormData,
      percent_metrics: ['count'],
      percent_metric_calculation: 'row_limit',
    };

    const result = buildQuery(formData);
    const { queries } = result;

    expect(queries).toHaveLength(1);
    expect(queries[0].post_processing).toContainEqual({
      operation: 'contribution',
      options: {
        columns: ['count'],
        rename_columns: ['%count'],
      },
    });
  });

  it('adds an extra totals query in "all_records" mode', () => {
    const formData = {
      ...baseFormData,
      percent_metrics: ['count'],
      percent_metric_calculation: 'all_records',
    };

    const result = buildQuery(formData);
    const { queries } = result;

    expect(queries).toHaveLength(2);

    expect(queries[0].post_processing).toContainEqual({
      operation: 'contribution',
      options: {
        columns: ['count'],
        rename_columns: ['%count'],
      },
    });

    const totalsQuery = queries[1];
    expect(totalsQuery.metrics).toEqual(['count']);
    expect(totalsQuery.columns).toEqual([]);
    expect(totalsQuery.post_processing).toEqual([]);
    expect(totalsQuery.row_limit).toBe(0);
  });
});

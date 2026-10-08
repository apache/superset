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
import { buildQueryContext, VizType } from '@superset-ui/core';
import * as queryModule from '../../src/query/normalizeTimeColumn';

test('semantic queries omit a positive limit without final series columns', () => {
  const formData = {
    datasource: '5__semantic_view',
    viz_type: VizType.Table,
    metrics: ['revenue'],
    series_limit: 2,
  };
  const context = buildQueryContext(formData, baseQuery => [
    { ...baseQuery, series_columns: [] },
  ]);

  expect(context.queries[0].series_limit).toBe(0);
  expect(context.form_data?.series_limit).toBe(2);
  expect(
    buildQueryContext({ ...formData, datasource: '5__table' }, baseQuery => [
      { ...baseQuery, series_columns: [] },
    ]).queries[0].series_limit,
  ).toBe(2);
  expect(
    buildQueryContext(formData, baseQuery => [
      { ...baseQuery, series_columns: ['product'] },
    ]).queries[0].series_limit,
  ).toBe(2);
  expect(
    buildQueryContext(formData, baseQuery => [
      {
        ...baseQuery,
        is_timeseries: true,
        metrics: [],
        columns: ['product'],
        series_columns: [],
      },
    ]).queries[0].series_limit,
  ).toBe(0);
  expect(
    buildQueryContext(formData, baseQuery => [
      { ...baseQuery, is_timeseries: true, columns: [], series_columns: [] },
    ]).queries[0].series_limit,
  ).toBe(0);
});

describe('buildQueryContext', () => {
  test('should build datasource for table sources and apply defaults', () => {
    const queryContext = buildQueryContext({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: VizType.Table,
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    // A non-forced request carries no idempotency nonce.
    expect(queryContext.force_nonce).toBeUndefined();
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
  });
  test('should carry force_nonce when set on the form data', () => {
    const queryContext = buildQueryContext({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: VizType.Table,
      force: true,
      force_nonce: 'nonce-123',
    });
    expect(queryContext.force).toBe(true);
    expect(queryContext.force_nonce).toBe('nonce-123');
  });
  test('should build datasource for table sources with columns', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        granularity_sqla: 'ds',
        viz_type: VizType.Table,
        source: 'source_column',
        source_category: 'source_category_column',
        target: 'target_column',
        target_category: 'target_category_column',
      },
      {
        queryFields: {
          source: 'columns',
          source_category: 'columns',
          target: 'columns',
          target_category: 'columns',
        },
      },
    );
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
    expect(queryContext.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: [
            'source_column',
            'source_category_column',
            'target_column',
            'target_category_column',
          ],
        }),
      ]),
    );
  });
  test('should build datasource for table sources and process with custom function', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        granularity_sqla: 'ds',
        viz_type: VizType.Table,
        source: 'source_column',
        source_category: 'source_category_column',
        target: 'target_column',
        target_category: 'target_category_column',
      },
      function addExtraColumn(queryObject) {
        return [{ ...queryObject, columns: ['dummy_column'] }];
      },
    );
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
    expect(queryContext.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columns: ['dummy_column'],
        }),
      ]),
    );
  });
  // todo(Yongjie): move these test case into buildQueryObject.test.ts
  test('should remove undefined value in post_processing', () => {
    const queryContext = buildQueryContext(
      {
        datasource: '5__table',
        viz_type: VizType.Table,
      },
      () => [
        {
          post_processing: [
            undefined,
            undefined,
            {
              operation: 'flatten',
            },
            undefined,
          ],
        },
      ],
    );
    expect(queryContext.queries[0].post_processing).toEqual([
      {
        operation: 'flatten',
      },
    ]);
  });
  test('should call normalizeTimeColumn if has x_axis', () => {
    const spyNormalizeTimeColumn = jest.spyOn(
      queryModule,
      'normalizeTimeColumn',
    );

    buildQueryContext(
      {
        datasource: '5__table',
        viz_type: VizType.Table,
        x_axis: 'axis',
      },
      () => [{}],
    );
    expect(spyNormalizeTimeColumn).toHaveBeenCalled();
    spyNormalizeTimeColumn.mockRestore();
  });
});

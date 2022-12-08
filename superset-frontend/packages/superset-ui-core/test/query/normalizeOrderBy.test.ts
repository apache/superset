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
import { normalizeOrderBy, QueryObject } from '@superset-ui/core';

describe('normalizeOrderBy', () => {
  it('should not change original queryObject when orderby populated', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
    };
    expect(normalizeOrderBy(query)).toEqual(query);
  });

  it('has series_limit_metric in queryObject', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      series_limit_metric: {
        expressionType: 'SIMPLE',
        column: {
          id: 1,
          column_name: 'sales',
        },
        aggregate: 'SUM',
      },
      order_desc: true,
    };
    const expectedQueryObject = normalizeOrderBy(query);
    expect(expectedQueryObject).not.toHaveProperty('series_limit_metric');
    expect(expectedQueryObject).not.toHaveProperty('order_desc');
    expect(expectedQueryObject).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      orderby: [
        [
          {
            expressionType: 'SIMPLE',
            column: {
              id: 1,
              column_name: 'sales',
            },
            aggregate: 'SUM',
          },
          false,
        ],
      ],
    });
  });

  it('should transform legacy_order_by in queryObject', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      legacy_order_by: {
        expressionType: 'SIMPLE',
        column: {
          id: 1,
          column_name: 'sales',
        },
        aggregate: 'SUM',
      },
      order_desc: true,
    };
    const expectedQueryObject = normalizeOrderBy(query);
    expect(expectedQueryObject).not.toHaveProperty('legacy_order_by');
    expect(expectedQueryObject).not.toHaveProperty('order_desc');
    expect(expectedQueryObject).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      orderby: [
        [
          {
            expressionType: 'SIMPLE',
            column: {
              id: 1,
              column_name: 'sales',
            },
            aggregate: 'SUM',
          },
          false,
        ],
      ],
    });
  });

  it('has metrics in queryObject', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      order_desc: true,
    };
    const expectedQueryObject = normalizeOrderBy(query);
    expect(expectedQueryObject).not.toHaveProperty('series_limit_metric');
    expect(expectedQueryObject).not.toHaveProperty('order_desc');
    expect(expectedQueryObject).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      metrics: ['count(*)'],
      orderby: [['count(*)', false]],
    });
  });

  it('should not change', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
    };
    expect(normalizeOrderBy(query)).toEqual(query);
  });

  it('remove empty orderby', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      orderby: [],
    };
    expect(normalizeOrderBy(query)).not.toHaveProperty('orderby');
  });

  it('remove orderby with an empty array', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      orderby: [[]],
    };
    expect(normalizeOrderBy(query)).not.toHaveProperty('orderby');
  });

  it('remove orderby with an empty metric', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      orderby: [['', true]],
    };
    expect(normalizeOrderBy(query)).not.toHaveProperty('orderby');
  });

  it('remove orderby with an empty adhoc metric', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      orderby: [[{}, true]],
    };
    expect(normalizeOrderBy(query)).not.toHaveProperty('orderby');
  });

  it('remove orderby with an non-boolean type', () => {
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      time_range: '1 year ago : 2013',
      // @ts-ignore
      orderby: [['count(*)', 'true']],
    };
    expect(normalizeOrderBy(query)).not.toHaveProperty('orderby');
  });
});

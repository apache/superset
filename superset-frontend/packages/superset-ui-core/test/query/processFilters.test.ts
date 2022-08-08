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
import processFilters from '../../src/query/processFilters';

describe('processFilters', () => {
  it('should handle non-array adhoc_filters', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
      }),
    ).toEqual(
      expect.objectContaining({
        extras: { having: '', having_druid: [], where: '' },
        filters: [],
      }),
    );
  });

  it('should merge simple adhoc_filters and filters', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
        filters: [
          {
            col: 'name',
            op: '==',
            val: 'Aaron',
          },
        ],
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            clause: 'WHERE',
            subject: 'gender',
            operator: 'IS NOT NULL',
          },
        ],
      }),
    ).toEqual({
      extras: {
        having: '',
        having_druid: [],
        where: '',
      },
      filters: [
        {
          col: 'name',
          op: '==',
          val: 'Aaron',
        },
        {
          col: 'gender',
          op: 'IS NOT NULL',
        },
      ],
    });
  });

  it('should handle an empty array', () => {
    expect(
      processFilters({
        where: '1 = 1',
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
        adhoc_filters: [],
      }),
    ).toEqual({
      filters: [],
      extras: {
        having: '',
        having_druid: [],
        where: '(1 = 1)',
      },
    });
  });

  it('should put adhoc_filters into the correct group and format accordingly', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            clause: 'WHERE',
            subject: 'milk',
            operator: 'IS NOT NULL',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'WHERE',
            subject: 'milk',
            operator: '==',
            comparator: 'almond',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'HAVING',
            subject: 'sweetness',
            operator: '>',
            comparator: '0',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'HAVING',
            subject: 'sweetness',
            operator: '<=',
            comparator: '50',
          },
          {
            expressionType: 'SQL',
            clause: 'WHERE',
            sqlExpression: "tea = 'jasmine'",
          },
          {
            expressionType: 'SQL',
            clause: 'WHERE',
            sqlExpression: "cup = 'large' -- comment",
          },
          {
            expressionType: 'SQL',
            clause: 'HAVING',
            sqlExpression: 'ice = 25 OR ice = 50',
          },
          {
            expressionType: 'SQL',
            clause: 'HAVING',
            sqlExpression: 'waitTime <= 180 -- comment',
          },
        ],
      }),
    ).toEqual({
      extras: {
        having: '(ice = 25 OR ice = 50) AND (waitTime <= 180 -- comment\n)',
        having_druid: [
          {
            col: 'sweetness',
            op: '>',
            val: '0',
          },
          {
            col: 'sweetness',
            op: '<=',
            val: '50',
          },
        ],
        where: "(tea = 'jasmine') AND (cup = 'large' -- comment\n)",
      },
      filters: [
        {
          col: 'milk',
          op: 'IS NOT NULL',
        },
        {
          col: 'milk',
          op: '==',
          val: 'almond',
        },
      ],
    });
  });
});

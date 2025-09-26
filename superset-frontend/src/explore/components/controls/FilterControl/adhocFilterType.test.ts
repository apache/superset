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
import {
  AdhocFilterSimple,
  AdhocFilterSql,
  AdhocFilterType,
} from './adhocFilterType';
import { Clauses, ExpressionTypes } from './types';

describe('adhocFilterType', () => {
  test('should accept simple adhoc filter type', () => {
    const simpleFilter: AdhocFilterSimple = {
      expressionType: ExpressionTypes.Simple,
      clause: Clauses.Where,
      subject: 'column_name',
      comparator: 'test_value',
    };

    expect(simpleFilter.expressionType).toBe(ExpressionTypes.Simple);
    expect(simpleFilter.clause).toBe(Clauses.Where);
    expect(simpleFilter.subject).toBe('column_name');
    expect(simpleFilter.comparator).toBe('test_value');
  });

  test('should accept SQL adhoc filter type', () => {
    const sqlFilter: AdhocFilterSql = {
      expressionType: ExpressionTypes.Sql,
      clause: Clauses.Having,
      sqlExpression: 'COUNT(*) > 5',
    };

    expect(sqlFilter.expressionType).toBe(ExpressionTypes.Sql);
    expect(sqlFilter.clause).toBe(Clauses.Having);
    expect(sqlFilter.sqlExpression).toBe('COUNT(*) > 5');
  });

  test('should accept both simple and SQL filters as AdhocFilterType', () => {
    const simpleFilter: AdhocFilterType = {
      expressionType: ExpressionTypes.Simple,
      clause: Clauses.Where,
      subject: 'column_name',
      comparator: ['value1', 'value2'],
    };

    const sqlFilter: AdhocFilterType = {
      expressionType: ExpressionTypes.Sql,
      clause: Clauses.Having,
      sqlExpression: 'AVG(sales) > 1000',
    };

    expect(simpleFilter.expressionType).toBe(ExpressionTypes.Simple);
    expect(sqlFilter.expressionType).toBe(ExpressionTypes.Sql);
  });

  test('should handle array comparator for simple filters', () => {
    const filterWithArrayComparator: AdhocFilterSimple = {
      expressionType: ExpressionTypes.Simple,
      clause: Clauses.Where,
      subject: 'category',
      comparator: ['A', 'B', 'C'],
    };

    expect(Array.isArray(filterWithArrayComparator.comparator)).toBe(true);
    expect(filterWithArrayComparator.comparator).toEqual(['A', 'B', 'C']);
  });

  test('should handle optional properties', () => {
    const filterWithOptionalProps: AdhocFilterSimple = {
      expressionType: ExpressionTypes.Simple,
      clause: Clauses.Where,
      subject: 'column_name',
      comparator: 'test_value',
      operator: 'EQUALS',
      operatorId: 'EQUALS',
      isExtra: true,
      isNew: false,
      datasourceWarning: false,
      deck_slices: [1, 2, 3],
      layerFilterScope: 'global',
      filterOptionName: 'custom_filter_name',
    };

    expect(filterWithOptionalProps.operator).toBe('EQUALS');
    expect(filterWithOptionalProps.isExtra).toBe(true);
    expect(filterWithOptionalProps.deck_slices).toEqual([1, 2, 3]);
  });
});

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
import AdhocMetric, {
  EXPRESSION_TYPES,
} from '../../../src/explore/AdhocMetric';
import { AGGREGATES } from '../../../src/explore/constants';

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

describe('AdhocMetric', () => {
  it('sets label, hasCustomLabel and optionName in constructor', () => {
    const adhocMetric = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    expect(adhocMetric.optionName.length).toBeGreaterThan(10);
    expect(adhocMetric).toEqual({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      fromFormData: false,
      label: 'SUM(value)',
      hasCustomLabel: false,
      optionName: adhocMetric.optionName,
      sqlExpression: null,
    });
  });

  it('can create altered duplicates', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({
      aggregate: AGGREGATES.AVG,
    });

    expect(adhocMetric1.column).toBe(adhocMetric2.column);
    expect(adhocMetric1.column).toBe(valueColumn);

    expect(adhocMetric1.aggregate).toBe(AGGREGATES.SUM);
    expect(adhocMetric2.aggregate).toBe(AGGREGATES.AVG);
  });

  it('can verify equality', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({});

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.equals(adhocMetric2)).toBe(true);
  });

  it('can verify inequality', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      label: 'old label',
      hasCustomLabel: true,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({ label: 'new label' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.equals(adhocMetric2)).toBe(false);

    const adhocMetric3 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'COUNT(*)',
      label: 'old label',
      hasCustomLabel: true,
    });
    const adhocMetric4 = adhocMetric3.duplicateWith({
      sqlExpression: 'COUNT(1)',
    });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric3.equals(adhocMetric4)).toBe(false);
  });

  it('updates label if hasCustomLabel is false', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({
      aggregate: AGGREGATES.AVG,
    });

    expect(adhocMetric2.label).toBe('AVG(value)');
  });

  it('keeps label if hasCustomLabel is true', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({
      aggregate: AGGREGATES.AVG,
    });

    expect(adhocMetric2.label).toBe('label1');
  });

  it('can determine if it is valid', () => {
    const adhocMetric1 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.isValid()).toBe(true);

    const adhocMetric2 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: null,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric2.isValid()).toBe(false);

    const adhocMetric3 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'COUNT(*)',
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric3.isValid()).toBe(true);

    const adhocMetric4 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric4.isValid()).toBe(false);

    const adhocMetric5 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric5.isValid()).toBe(false);
  });

  it('can translate back from sql expressions to simple expressions when possible', () => {
    const adhocMetric = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(my_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    expect(adhocMetric.inferSqlExpressionColumn()).toBe('my_column');
    expect(adhocMetric.inferSqlExpressionAggregate()).toBe('AVG');

    const adhocMetric2 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(SUM(my_column)) / MAX(other_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    expect(adhocMetric2.inferSqlExpressionColumn()).toBeNull();
    expect(adhocMetric2.inferSqlExpressionAggregate()).toBeNull();
  });

  it('will infer columns and aggregates when converting to a simple expression', () => {
    const adhocMetric = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(my_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    const adhocMetric2 = adhocMetric.duplicateWith({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      aggregate: AGGREGATES.SUM,
    });
    expect(adhocMetric2.aggregate).toBe(AGGREGATES.SUM);
    expect(adhocMetric2.column.column_name).toBe('my_column');

    const adhocMetric3 = adhocMetric.duplicateWith({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
    });
    expect(adhocMetric3.aggregate).toBe(AGGREGATES.AVG);
    expect(adhocMetric3.column.column_name).toBe('value');
  });
});

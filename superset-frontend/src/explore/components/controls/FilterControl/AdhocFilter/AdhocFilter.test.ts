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
  convertFilter,
  SimpleAdhocFilter,
  TimeGranularity,
} from '@superset-ui/core';
import AdhocFilter, {
  fromCoreAdhocFilter,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { simpleFilterToAdhoc } from 'src/utils/simpleFilterToAdhoc';
import { Operators } from 'src/explore/constants';
import { ExpressionTypes, Clauses } from '../types';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('AdhocFilter', () => {
  test('sets filterOptionName in constructor', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: Clauses.Where,
    });
    expect(adhocFilter.filterOptionName.length).toBeGreaterThan(10);
    expect(adhocFilter).toEqual({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      datasourceWarning: false,
      comparator: '10',
      clause: Clauses.Where,
      filterOptionName: adhocFilter.filterOptionName,
      sqlExpression: null,
      isExtra: false,
      isNew: false,
    });
  });

  test('can create altered duplicates', () => {
    const adhocFilter1 = new AdhocFilter({
      isNew: true,
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: Clauses.Where,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({ operator: '<' });

    expect(adhocFilter1.subject).toBe(adhocFilter2.subject);
    expect(adhocFilter1.comparator).toBe(adhocFilter2.comparator);
    expect(adhocFilter1.clause).toBe(adhocFilter2.clause);
    expect(adhocFilter1.expressionType).toBe(adhocFilter2.expressionType);

    expect(adhocFilter1.operator).toBe('>');
    expect(adhocFilter2.operator).toBe('<');

    // duplicated clone should not be new
    expect(adhocFilter1.isNew).toBe(true);
    expect(adhocFilter2.isNew).toStrictEqual(false);
  });

  test('can verify equality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: Clauses.Where,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({});

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1 === adhocFilter2).toBe(false);
  });

  test('can verify inequality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: Clauses.Where,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({ operator: '<' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).toBe(false);

    const adhocFilter3 = new AdhocFilter({
      expressionType: ExpressionTypes.Sql,
      sqlExpression: 'value > 10',
      clause: Clauses.Where,
    });
    const adhocFilter4 = adhocFilter3.duplicateWith({
      sqlExpression: 'value = 5',
    });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.equals(adhocFilter4)).toBe(false);
  });

  test('can determine if it is valid', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.isValid()).toBe(true);

    const adhocFilter2 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '>',
      comparator: null,
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter2.isValid()).toBe(false);

    const adhocFilter3 = new AdhocFilter({
      expressionType: ExpressionTypes.Sql,
      sqlExpression: 'some expression',
      clause: null,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.isValid()).toBe(false);

    const adhocFilter4 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: 'IN',
      comparator: [],
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter4.isValid()).toBe(false);

    const adhocFilter5 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: 'IN',
      comparator: ['val1'],
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter5.isValid()).toBe(true);

    const adhocFilter6 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '==',
      comparator: 1,
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter6.isValid()).toBe(true);

    const adhocFilter7 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '==',
      comparator: 0,
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter7.isValid()).toBe(true);

    const adhocFilter8 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '==',
      comparator: null,
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter8.isValid()).toBe(false);

    const adhocFilter9 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: 'IS NULL',
      clause: Clauses.Where,
    });
    expect(adhocFilter9.isValid()).toBe(true);
    const adhocFilter10 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: 'IS NOT NULL',
      clause: Clauses.Where,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter10.isValid()).toBe(true);
  });

  test('is invalid when a comparator-taking operator has no comparator', () => {
    // A comparator that was never set, or that was cleared through the value
    // Select's clear affordance, is `undefined` rather than `null` or `[]`.
    const adhocFilter1 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'is_intro',
      operator: 'IN',
      comparator: undefined,
      clause: Clauses.Where,
    });
    expect(adhocFilter1.isValid()).toBe(false);

    const adhocFilter2 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'is_intro',
      operator: '==',
      comparator: undefined,
      clause: Clauses.Where,
    });
    expect(adhocFilter2.isValid()).toBe(false);

    // `false` is a legitimate boolean comparator, not a missing value
    const adhocFilter3 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'is_intro',
      operator: '==',
      comparator: false,
      clause: Clauses.Where,
    });
    expect(adhocFilter3.isValid()).toBe(true);
  });

  test('can translate from simple expressions to sql expressions', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operator: '==',
      comparator: '10',
      clause: Clauses.Where,
    });
    expect(adhocFilter1.translateToSql()).toBe('value = 10');

    const adhocFilter2 = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'SUM(value)',
      operator: '!=',
      comparator: '5',
      clause: Clauses.Having,
    });
    expect(adhocFilter2.translateToSql()).toBe('SUM(value) <> 5');
  });
  test('sets comparator to undefined when operator is IS_NULL', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'SUM(value)',
      operator: 'IS NULL',
      operatorId: Operators.IsNull,
      comparator: '5',
      clause: Clauses.Having,
    });
    expect(adhocFilter.comparator).toBe(undefined);
  });
  test('sets comparator to undefined when operator is IS_NOT_NULL', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'SUM(value)',
      operator: 'IS NOT NULL',
      operatorId: Operators.IsNotNull,
      comparator: '5',
      clause: Clauses.Having,
    });
    expect(adhocFilter.comparator).toBe(undefined);
  });
  test('sets comparator to undefined when operator is IS_TRUE', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: 'IS TRUE',
      operatorId: Operators.IsTrue,
      comparator: '5',
      clause: Clauses.Having,
    });
    expect(adhocFilter.comparator).toBe(undefined);
  });
  test('sets comparator to undefined when operator is IS_FALSE', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: 'IS FALSE',
      operatorId: Operators.IsFalse,
      comparator: '5',
      clause: Clauses.Having,
    });
    expect(adhocFilter.comparator).toBe(undefined);
  });
  // Charts saved before #32701 persisted `==` as the operation for IS_TRUE and
  // IS_FALSE, alongside a boolean comparator. `translateToSql` and the backend
  // both key off `operator`, so dropping the comparator would render such a
  // filter as `col =` and query it as `col IS NULL`.
  test('keeps the legacy boolean comparator for IS_TRUE', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: '==',
      operatorId: Operators.IsTrue,
      comparator: true,
      clause: Clauses.Where,
    });
    expect(adhocFilter.operator).toBe('==');
    expect(adhocFilter.comparator).toBe(true);
    expect(adhocFilter.translateToSql()).toBe("col = 'TRUE'");
  });
  test('keeps the legacy boolean comparator for IS_FALSE', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: '==',
      operatorId: Operators.IsFalse,
      comparator: false,
      clause: Clauses.Where,
    });
    expect(adhocFilter.operator).toBe('==');
    expect(adhocFilter.comparator).toBe(false);
    expect(adhocFilter.translateToSql()).toBe("col = 'FALSE'");
  });
  test('restores the boolean even when the stored comparator is missing', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: '==',
      operatorId: Operators.IsTrue,
      clause: Clauses.Where,
    });
    expect(adhocFilter.comparator).toBe(true);
  });
  test('keeps a legacy boolean filter intact when the control re-posts it', () => {
    const stored = {
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: '==',
      operatorId: Operators.IsTrue,
      comparator: true,
      clause: Clauses.Where,
    };
    // DndFilterSelect wraps props.value and hands those instances to onChange
    const posted = JSON.parse(JSON.stringify(new AdhocFilter(stored)));
    expect(posted.operator).toBe('==');
    expect(posted.comparator).toBe(true);
    expect(posted.operatorId).toBe(Operators.IsTrue);
  });
  test('leaves a genuine equality filter on a boolean value alone', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'col',
      operator: '==',
      operatorId: Operators.Equals,
      comparator: true,
      clause: Clauses.Where,
    });
    expect(adhocFilter.operator).toBe('==');
    expect(adhocFilter.comparator).toBe(true);
    expect(adhocFilter.translateToSql()).toBe("col = 'TRUE'");
  });
  test('sets the label properly if subject is a string', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'order_date',
    });
    expect(adhocFilter.getDefaultLabel()).toBe('order_date');
  });
  test('sets the label properly if subject is an object with the column_date property', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: {
        column_name: 'year',
      },
    });
    expect(adhocFilter.getDefaultLabel()).toBe('year');
  });
  test('sets the label to empty is there is no column_name in the object', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: {
        unknown: 'year',
      },
    });
    expect(adhocFilter.getDefaultLabel()).toBe('');
  });
  test('sets the label to empty is there is no subject', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: undefined,
    });
    expect(adhocFilter.getDefaultLabel()).toBe('');
  });
  test('uses the column verbose_name in the label when one is given', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'num',
      operator: '>',
      comparator: '500',
      clause: Clauses.Where,
    });
    expect(
      adhocFilter.getDefaultLabel([
        { column_name: 'num', verbose_name: 'total_count' },
      ]),
    ).toBe('total_count > 500');
  });
  test('falls back to the column_name when no verbose_name is set', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'num',
      operator: '>',
      comparator: '500',
      clause: Clauses.Where,
    });
    expect(
      adhocFilter.getDefaultLabel([{ column_name: 'num', verbose_name: '' }]),
    ).toBe('num > 500');
    expect(adhocFilter.getDefaultLabel([])).toBe('num > 500');
    expect(adhocFilter.getDefaultLabel()).toBe('num > 500');
  });
});

test('Explore filter duplicates preserve grains but bucket edits clear them', () => {
  const filter = new AdhocFilter({
    expressionType: 'SIMPLE',
    subject: 'ts',
    operator: '==',
    comparator: '2026-08-01',
    timeGrain: TimeGranularity.MONTH,
  });
  expect(filter.duplicateWith({})).toMatchObject({
    timeGrain: TimeGranularity.MONTH,
  });
  expect(filter.duplicateWith({ comparator: '2026-09-01' })).not.toHaveProperty(
    'timeGrain',
    TimeGranularity.MONTH,
  );
  expect(
    filter.equals(filter.duplicateWith({ timeGrain: TimeGranularity.YEAR })),
  ).toBe(false);
  expect(filter.duplicateWith({ subject: 'category' })).not.toHaveProperty(
    'timeGrain',
    'P1M',
  );
});

test('a grained adhoc column subject uses its label', () => {
  const filter = new AdhocFilter({
    expressionType: 'SIMPLE',
    subject: {
      sqlExpression: 'CAST(order_date AS TIMESTAMP)',
      label: 'order_date',
      expressionType: 'SQL',
      columnType: 'BASE_AXIS',
      timeGrain: TimeGranularity.MONTH,
    },
    operator: '==',
    comparator: '2021-01-01T00:00:00',
    timeGrain: TimeGranularity.MONTH,
  });
  expect(filter.getDefaultLabel()).toBe(
    "[P1M] order_date = '2021-01-01T00:00:00'",
  );
  expect(filter.translateToSql()).toBe(
    "CAST(order_date AS TIMESTAMP) = '2021-01-01T00:00:00'",
  );
});

test('editing a drilled adhoc bucket drops the grain from the column', () => {
  const column = {
    sqlExpression: 'CAST(order_date AS TIMESTAMP)',
    label: 'bucket_date',
    expressionType: 'SQL' as const,
  };
  const created = simpleFilterToAdhoc({
    col: column,
    op: '==',
    val: '2021-01-01T00:00:00',
    grain: TimeGranularity.MONTH,
  });
  const filter = fromCoreAdhocFilter(created);
  const edited = filter.duplicateWith({
    comparator: '2021-01-15T00:00:00',
  });
  expect(edited.timeGrain).toBeUndefined();
  expect(edited.subject).toEqual(column);
  expect(convertFilter(edited as unknown as SimpleAdhocFilter)).toEqual({
    col: column,
    op: '==',
    val: '2021-01-15T00:00:00',
  });
});

test('a grained drill filter displays its grain and drops it on operator or SQL edits', () => {
  const filter = new AdhocFilter({
    expressionType: 'SIMPLE',
    subject: 'ts',
    operator: '==',
    comparator: '2026-08-01',
    timeGrain: TimeGranularity.MONTH,
  });
  expect(filter.getDefaultLabel()).toContain('[P1M]');
  expect(filter.getTooltipTitle()).toContain('[P1M]');
  expect(filter.duplicateWith({ operator: '>' })).not.toHaveProperty(
    'timeGrain',
    TimeGranularity.MONTH,
  );
  expect(
    filter.duplicateWith({ expressionType: ExpressionTypes.Sql }),
  ).not.toHaveProperty('timeGrain', TimeGranularity.MONTH);
});

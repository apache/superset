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
import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { Operators } from 'src/explore/constants';

describe('AdhocFilter', () => {
  it('sets filterOptionName in constructor', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    expect(adhocFilter.filterOptionName.length).toBeGreaterThan(10);
    expect(adhocFilter).toEqual({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
      filterOptionName: adhocFilter.filterOptionName,
      sqlExpression: null,
      isExtra: false,
      isNew: false,
    });
  });

  it('can create altered duplicates', () => {
    const adhocFilter1 = new AdhocFilter({
      isNew: true,
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
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

  it('can verify equality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({});

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1 === adhocFilter2).toBe(false);
  });

  it('can verify inequality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({ operator: '<' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).toBe(false);

    const adhocFilter3 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'value > 10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter4 = adhocFilter3.duplicateWith({
      sqlExpression: 'value = 5',
    });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.equals(adhocFilter4)).toBe(false);
  });

  it('can determine if it is valid', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.isValid()).toBe(true);

    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: null,
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter2.isValid()).toBe(false);

    const adhocFilter3 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'some expression',
      clause: null,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.isValid()).toBe(false);

    const adhocFilter4 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'IN',
      comparator: [],
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter4.isValid()).toBe(false);

    const adhocFilter5 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'IN',
      comparator: ['val1'],
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter5.isValid()).toBe(true);

    const adhocFilter6 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '==',
      comparator: 1,
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter6.isValid()).toBe(true);

    const adhocFilter7 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '==',
      comparator: 0,
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter7.isValid()).toBe(true);

    const adhocFilter8 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '==',
      comparator: null,
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter8.isValid()).toBe(false);

    const adhocFilter9 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'IS NULL',
      clause: CLAUSES.WHERE,
    });
    expect(adhocFilter9.isValid()).toBe(true);
    const adhocFilter10 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'IS NOT NULL',
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter10.isValid()).toBe(true);
  });

  it('can translate from simple expressions to sql expressions', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '==',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    expect(adhocFilter1.translateToSql()).toBe('value = 10');

    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'SUM(value)',
      operator: '!=',
      comparator: '5',
      clause: CLAUSES.HAVING,
    });
    expect(adhocFilter2.translateToSql()).toBe('SUM(value) <> 5');
  });
  it('sets comparator to null when operator is IS_NULL', () => {
    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'SUM(value)',
      operator: 'IS NULL',
      operatorId: Operators.IS_NULL,
      comparator: '5',
      clause: CLAUSES.HAVING,
    });
    expect(adhocFilter2.comparator).toBe(null);
  });
  it('sets comparator to null when operator is IS_NOT_NULL', () => {
    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'SUM(value)',
      operator: 'IS NOT NULL',
      operatorId: Operators.IS_NOT_NULL,
      comparator: '5',
      clause: CLAUSES.HAVING,
    });
    expect(adhocFilter2.comparator).toBe(null);
  });
});

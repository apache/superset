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
  CUSTOM_OPERATORS,
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import { getSimpleSQLExpression } from 'src/explore/exploreUtils';

export const EXPRESSION_TYPES = {
  SIMPLE: 'SIMPLE',
  SQL: 'SQL',
};

export const CLAUSES = {
  HAVING: 'HAVING',
  WHERE: 'WHERE',
};

const OPERATORS_TO_SQL = {
  '==': '=',
  '!=': '<>',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  IN: 'IN',
  'NOT IN': 'NOT IN',
  LIKE: 'LIKE',
  ILIKE: 'ILIKE',
  REGEX: 'REGEX',
  'IS NOT NULL': 'IS NOT NULL',
  'IS NULL': 'IS NULL',
  'IS TRUE': 'IS TRUE',
  'IS FALSE': 'IS FALSE',
  'LATEST PARTITION': ({ datasource }) =>
    `= '{{ presto.latest_partition('${datasource.schema}.${datasource.datasource_name}') }}'`,
};

const CUSTOM_OPERATIONS = [...CUSTOM_OPERATORS].map(
  op => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
);

function translateToSql(adhocMetric, { useSimple } = {}) {
  if (adhocMetric.expressionType === EXPRESSION_TYPES.SIMPLE || useSimple) {
    const { subject, comparator } = adhocMetric;
    const operator =
      adhocMetric.operator &&
      CUSTOM_OPERATIONS.indexOf(adhocMetric.operator) >= 0
        ? OPERATORS_TO_SQL[adhocMetric.operator](adhocMetric)
        : OPERATORS_TO_SQL[adhocMetric.operator];
    return getSimpleSQLExpression(subject, operator, comparator);
  }
  if (adhocMetric.expressionType === EXPRESSION_TYPES.SQL) {
    return adhocMetric.sqlExpression;
  }
  return '';
}

export default class AdhocFilter {
  constructor(adhocFilter) {
    this.expressionType = adhocFilter.expressionType || EXPRESSION_TYPES.SIMPLE;
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      this.subject = adhocFilter.subject;
      this.operator = adhocFilter.operator?.toUpperCase();
      this.operatorId = adhocFilter.operatorId;
      this.comparator = adhocFilter.comparator;
      if (
        [Operators.IS_TRUE, Operators.IS_FALSE].indexOf(
          adhocFilter.operatorId,
        ) >= 0
      ) {
        this.comparator = adhocFilter.operatorId === Operators.IS_TRUE;
      }
      if (
        [Operators.IS_NULL, Operators.IS_NOT_NULL].indexOf(
          adhocFilter.operatorId,
        ) >= 0
      ) {
        this.comparator = null;
      }
      this.clause = adhocFilter.clause || CLAUSES.WHERE;
      this.sqlExpression = null;
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      this.sqlExpression =
        typeof adhocFilter.sqlExpression === 'string'
          ? adhocFilter.sqlExpression
          : translateToSql(adhocFilter, { useSimple: true });
      this.clause = adhocFilter.clause;
      if (
        adhocFilter.operator &&
        CUSTOM_OPERATIONS.indexOf(adhocFilter.operator) >= 0
      ) {
        this.subject = adhocFilter.subject;
        this.operator = adhocFilter.operator;
        this.operatorId = adhocFilter.operatorId;
      } else {
        this.subject = null;
        this.operator = null;
      }
      this.comparator = null;
    }
    this.isExtra = !!adhocFilter.isExtra;
    this.isNew = !!adhocFilter.isNew;

    this.filterOptionName =
      adhocFilter.filterOptionName ||
      `filter_${Math.random()
        .toString(36)
        .substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }

  duplicateWith(nextFields) {
    return new AdhocFilter({
      ...this,
      // all duplicated fields are not new (i.e. will not open popup automatically)
      isNew: false,
      ...nextFields,
    });
  }

  equals(adhocFilter) {
    return (
      adhocFilter.expressionType === this.expressionType &&
      adhocFilter.sqlExpression === this.sqlExpression &&
      adhocFilter.operator === this.operator &&
      adhocFilter.operatorId === this.operatorId &&
      adhocFilter.comparator === this.comparator &&
      adhocFilter.subject === this.subject
    );
  }

  isValid() {
    const nullCheckOperators = [Operators.IS_NOT_NULL, Operators.IS_NULL].map(
      op => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
    );
    const truthCheckOperators = [Operators.IS_TRUE, Operators.IS_FALSE].map(
      op => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
    );
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      if (nullCheckOperators.indexOf(this.operator) >= 0) {
        return !!(this.operator && this.subject);
      }
      if (truthCheckOperators.indexOf(this.operator) >= 0) {
        return !!(this.subject && this.comparator !== null);
      }
      if (this.operator && this.subject && this.clause) {
        if (Array.isArray(this.comparator)) {
          if (this.comparator.length > 0) {
            // A non-empty array of values ('IN' or 'NOT IN' clauses)
            return true;
          }
        } else if (this.comparator !== null) {
          // A value has been selected or typed
          return true;
        }
      }
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      return !!(this.sqlExpression && this.clause);
    }
    return false;
  }

  getDefaultLabel() {
    const label = this.translateToSql();
    return label.length < 43 ? label : `${label.substring(0, 40)}...`;
  }

  getTooltipTitle() {
    return this.translateToSql();
  }

  translateToSql() {
    return translateToSql(this);
  }
}
